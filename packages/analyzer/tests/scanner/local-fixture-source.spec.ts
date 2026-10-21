import { mkdtemp, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GitRepositoryFetcher } from '../../src/git/git-repository-fetcher';

describe('test-only local source acquisition', () => {
  let root: string;
  const initialEnv = { ...process.env };

  beforeEach(async () => {
    Object.assign(process.env, { NODE_ENV: 'test' });
    root = await realpath(await mkdtemp(join(tmpdir(), 'ba-local-source-')));
    await mkdir(join(root, 'source with spaces'));
    await writeFile(join(root, 'source with spaces', 'sample.ts'), 'export const example = true;');
  });

  afterEach(async () => {
    process.env = { ...initialEnv };
    const name = relative(await realpath(tmpdir()), root);
    if (!name.startsWith('ba-local-source-') || /[/\\]/.test(name)) throw new Error('Unsafe local fixture cleanup.');
    await rm(root, { recursive: true, force: true });
  });

  it.each(['path', 'url'])('copies a %s source containing spaces on the host platform', async kind => {
    const source = join(root, 'source with spaces');
    const target = join(root, 'checkout');
    const result = await GitRepositoryFetcher.fetch({ url: kind === 'url' ? pathToFileURL(source).toString() : source,
      targetDir: target });
    expect(await readFile(join(target, 'sample.ts'), 'utf8')).toBe('export const example = true;');
    expect(result.commitSha).toBe('mock-commit-sha');
  });
});
