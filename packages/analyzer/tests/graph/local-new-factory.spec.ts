import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildGraph, scanProject } from '../../src';

describe('static local factory test receivers', () => {
  let root: string;
  beforeEach(() => {
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-local-factory-')));
    mkdirSync(join(root, 'src'));
  });
  afterEach(() => {
    const name = relative(realpathSync.native(tmpdir()), root);
    if (!name.startsWith('ba-local-factory-') || /[/\\]/.test(name)) throw new Error('Unsafe cleanup.');
    rmSync(root, { recursive: true, force: true });
  });

  function graph(factory: string, cases = "it('refund', () => build().refund());") {
    const service = join(root, 'src/payment.service.ts'), test = join(root, 'src/payment.spec.ts');
    writeFileSync(service, `import { Injectable } from '@nestjs/common';
      @Injectable() export class PaymentService { refund() {} authorize() {} }`);
    writeFileSync(test, `import { PaymentService as Subject } from './payment.service';\n${factory}\n${cases}`);
    return buildGraph(scanProject({ fixturePath: root, tsFiles: [service, test] }));
  }

  it('resolves the active case call through a local single-return new-Class factory', () => {
    const result = graph('function build() { return new Subject(); }', `
      beforeEach(() => build().authorize());
      it('refund', () => { build().refund(); build().refund(); });
      it.skip('skip', () => build().refund());`);
    expect(result.edges).toEqual([expect.objectContaining({ type: 'TESTS', to: expect.stringContaining('PaymentService.refund'),
      provenance: expect.objectContaining({ locations: [expect.objectContaining({ sourcePath: 'src/payment.spec.ts' })] }) })]);
  });

  it.each([
    'async function build() { return new Subject(); }',
    'function* build() { return new Subject(); }',
    'function build(flag = true) { return new Subject(); }',
    'function build() { if (enabled) return new Subject(); return { refund() {} }; }',
    'function build() { return { refund() {} }; }',
    'function build() { return new Subject(); } build = () => ({ refund() {} });',
    'function build() { return new Subject(); } const alias = build;',
    "import { build } from './external-factory';",
  ])('leaves an unsupported factory unresolved: %s', factory => {
    expect(graph(factory).edges).toEqual([]);
  });

  it('respects lexical shadows of a supported factory', () => {
    const result = graph('function build() { return new Subject(); }', `
      describe('shadowed', () => { function build() { return { refund() {} }; }
        it('unresolved', () => build().refund()); });`);
    expect(result.edges).toEqual([]);
  });
});
