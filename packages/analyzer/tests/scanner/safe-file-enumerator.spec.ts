import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { SafeFileEnumerator } from '../../src/scanner/safe-file-enumerator';
import { ScanLimitsPolicy, ScanLimits } from '../../src/scanner/limits';

describe('SafeFileEnumerator', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'safe-enum-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('skips dangerous/noisy directories', async () => {
    await fs.mkdir(path.join(tmpDir, '.git'));
    await fs.mkdir(path.join(tmpDir, 'node_modules'));
    await fs.mkdir(path.join(tmpDir, 'src'));
    
    await fs.writeFile(path.join(tmpDir, '.git', 'config'), 'content');
    await fs.writeFile(path.join(tmpDir, 'node_modules', 'index.js'), 'content');
    await fs.writeFile(path.join(tmpDir, 'src', 'main.ts'), 'content');

    const enumerator = new SafeFileEnumerator(tmpDir);
    const result = await enumerator.enumerate();

    expect(result.allFiles.length).toBe(1);
    expect(result.allFiles[0].endsWith('main.ts')).toBe(true);
    expect(result.tsFiles.length).toBe(1);
  });

  it('skips binary/archive files', async () => {
    await fs.writeFile(path.join(tmpDir, 'image.png'), 'content');
    await fs.writeFile(path.join(tmpDir, 'archive.zip'), 'content');
    await fs.writeFile(path.join(tmpDir, 'main.ts'), 'content');

    const enumerator = new SafeFileEnumerator(tmpDir);
    const result = await enumerator.enumerate();

    expect(result.allFiles.length).toBe(1);
    expect(result.allFiles[0].endsWith('main.ts')).toBe(true);
    expect(result.diagnostics.some(d => d.code === 'BINARY_SKIPPED')).toBe(true);
  });

  it('skips files exceeding MAX_FILE_SIZE_KB', async () => {
    const limits: ScanLimits = {
      MAX_REPO_SIZE_MB: 100,
      MAX_FILE_COUNT: 1000,
      MAX_TS_FILE_COUNT: 1000,
      MAX_FILE_SIZE_KB: 1, // 1 KB
      CLONE_TIMEOUT_MS: 10000,
      SCAN_TIMEOUT_MS: 10000,
    };
    const policy = new ScanLimitsPolicy(limits);

    const largeContent = 'a'.repeat(2048); // 2 KB
    await fs.writeFile(path.join(tmpDir, 'large.ts'), largeContent);
    await fs.writeFile(path.join(tmpDir, 'small.ts'), 'tiny');

    const enumerator = new SafeFileEnumerator(tmpDir, policy);
    const result = await enumerator.enumerate();

    expect(result.allFiles.length).toBe(1);
    expect(result.allFiles[0].endsWith('small.ts')).toBe(true);
    expect(result.diagnostics.some(d => d.code === 'FILE_TOO_LARGE')).toBe(true);
  });

  it('skips all symlinks by default, including those pointing outside root', async () => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outside-test-'));
    await fs.writeFile(path.join(outsideDir, 'secret.txt'), 'secret');

    await fs.writeFile(path.join(tmpDir, 'main.ts'), 'content');
    try {
      await fs.symlink(outsideDir, path.join(tmpDir, 'outside_link'), 'dir');
    } catch {
      // Symlinks might fail on Windows without admin, ignore if so
      return;
    }

    const enumerator = new SafeFileEnumerator(tmpDir);
    const result = await enumerator.enumerate();

    expect(result.diagnostics.some(d => d.code === 'SYMLINK_SKIPPED')).toBe(true);
    expect(result.allFiles.some(f => f.includes('secret.txt'))).toBe(false);

    await fs.rm(outsideDir, { recursive: true, force: true });
  });

  it('enforces MAX_FILE_COUNT and MAX_TS_FILE_COUNT', async () => {
    const limits: ScanLimits = {
      MAX_REPO_SIZE_MB: 100,
      MAX_FILE_COUNT: 3,
      MAX_TS_FILE_COUNT: 2,
      MAX_FILE_SIZE_KB: 100,
      CLONE_TIMEOUT_MS: 10000,
      SCAN_TIMEOUT_MS: 10000,
    };
    const policy = new ScanLimitsPolicy(limits);

    await fs.writeFile(path.join(tmpDir, '1.ts'), 'content');
    await fs.writeFile(path.join(tmpDir, '2.ts'), 'content');
    await fs.writeFile(path.join(tmpDir, '3.ts'), 'content'); // will exceed TS file count

    const enumerator = new SafeFileEnumerator(tmpDir, policy);
    const result = await enumerator.enumerate();

    expect(result.isPartial).toBe(true);
    expect(result.diagnostics.some(d => d.code === 'TS_FILE_LIMIT_EXCEEDED')).toBe(true);
  });

  it('enforces MAX_REPO_SIZE_MB across enumerated files', async () => {
    const limits: ScanLimits = {
      MAX_REPO_SIZE_MB: 0.001,
      MAX_FILE_COUNT: 1000,
      MAX_TS_FILE_COUNT: 1000,
      MAX_FILE_SIZE_KB: 100,
      CLONE_TIMEOUT_MS: 10000,
      SCAN_TIMEOUT_MS: 10000,
    };
    const policy = new ScanLimitsPolicy(limits);

    await fs.writeFile(path.join(tmpDir, 'one.ts'), 'a'.repeat(800));
    await fs.writeFile(path.join(tmpDir, 'two.ts'), 'b'.repeat(800));

    const enumerator = new SafeFileEnumerator(tmpDir, policy);
    const result = await enumerator.enumerate();

    expect(result.isPartial).toBe(true);
    expect(result.diagnostics.some(d => d.code === 'REPO_LIMIT_EXCEEDED')).toBe(true);
  });
});
