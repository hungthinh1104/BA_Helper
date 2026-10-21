import { mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative } from 'node:path';
import { buildGraph, scanFixture, scanProject } from '../../src';

describe('canonical source paths', () => {
  let parent: string, tempParent: string, root: string, alias: string;
  const service = 'src/payment.service.ts', test = 'src/payment.spec.ts';

  beforeEach(() => {
    tempParent = mkdtempSync(join(tmpdir(), 'ba-canonical-'));
    parent = realpathSync.native(tempParent);
    root = join(parent, 'physical'); alias = join(parent, 'alias');
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, service), `import { Injectable } from '@nestjs/common';
@Injectable() export class PaymentService { refund() { return true; } }`);
    writeFileSync(join(root, test), `import { PaymentService } from './payment.service';
test('refunds once', () => { const payment = new PaymentService(); payment.refund(); });`);
    symlinkSync(root, alias, process.platform === 'win32' ? 'junction' : 'dir');
  });

  afterEach(() => {
    const name = relative(realpathSync.native(tmpdir()), parent);
    if (!name.startsWith('ba-canonical-') || /[/\\]/.test(name)) throw new Error('Unsafe fixture cleanup.');
    rmSync(parent, { recursive: true, force: true });
  });

  it.each(['root', 'files'] as const)('keeps identities and graph links when the %s uses a filesystem alias', mode => {
    const expected = scanProject({ fixturePath: root, tsFiles: [join(root, service), join(root, test)] });
    const result = scanProject({ fixturePath: mode === 'root' ? alias : root,
      tsFiles: [service, test].map(file => join(mode === 'files' ? alias : root, file)) });
    expect(result.sourceRoot).toBe(root);
    expect(result.artifacts).toEqual(expected.artifacts);
    expect(result.artifacts.every(artifact => !isAbsolute(artifact.filePath) && !artifact.filePath.includes('..'))).toBe(true);
    expect(buildGraph(result).edges).toEqual(buildGraph(expected).edges);
    expect(buildGraph(result).edges).toHaveLength(1);
  });

  it('keeps fixture enumeration identities independent of a root alias', () => {
    expect(scanFixture({ fixturePath: alias }).artifacts).toEqual(scanFixture({ fixturePath: root }).artifacts);
  });

  it('normalizes native temporary paths, including Windows short user names', () => {
    const result = scanProject({ fixturePath: join(tempParent, 'physical'),
      tsFiles: [join(root, service), join(root, test)] });
    expect(result.sourceRoot).toBe(root);
    expect([...new Set(result.artifacts.map(artifact => artifact.filePath))].sort()).toEqual([service, test].sort());
    expect(buildGraph(result).edges).toHaveLength(1);
  });

  it('keeps the accepted file selection bounded when canonicalizing aliases', () => {
    const result = scanProject({ fixturePath: alias, tsFiles: [join(root, test)] });
    expect(result.sourceFiles).toEqual([join(root, test)]);
    expect(buildGraph(result).edges).toEqual([]);
  });
});
