import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildGraph, scanProject } from '../../src';

describe('Nest TestingModule receiver bindings', () => {
  let root: string;
  beforeEach(() => { root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-nest-binding-'))); mkdirSync(join(root, 'src')); });
  afterEach(() => {
    const name = relative(realpathSync.native(tmpdir()), root);
    if (!name.startsWith('ba-nest-binding-') || /[/\\]/.test(name)) throw new Error('Unsafe cleanup.');
    rmSync(root, { recursive: true, force: true });
  });

  function graph(body: string, nestImport = "import { Test as Factory } from '@nestjs/testing';") {
    const service = join(root, 'src/payment.service.ts'), test = join(root, 'src/payment.spec.ts');
    writeFileSync(service, "import { Injectable } from '@nestjs/common'; @Injectable() export class PaymentService { authorize() {} refund() {} }");
    writeFileSync(test, `${nestImport}\nimport { PaymentService as Subject } from './payment.service';\n${body}`);
    return buildGraph(scanProject({ fixturePath: root, tsFiles: [service, test] }));
  }

  it.each([
    `const module = await Factory.createTestingModule({ providers: [Subject] }).compile();
      it('refunds', () => { const service = module.get(Subject); service.refund(); });`,
    `let module; let service;
      beforeEach(async () => { module = await Factory.createTestingModule({ providers: [Subject] }).compile(); service = module.get<Subject>(Subject); });
      it('refunds', () => service.refund());`,
  ])('resolves a class token acquired from a verified testing module', body => {
    const result = graph(body);
    expect(result.edges).toEqual([expect.objectContaining({ type: 'TESTS', to: expect.stringContaining('PaymentService.refund'),
      provenance: expect.objectContaining({ resolver: 'TS_AST_DIRECT_CALL', locations: [expect.objectContaining({ sourcePath: 'src/payment.spec.ts' })] }) })]);
  });

  it.each([
    `const module = { get: () => ({ refund() {} }) }; const service = module.get(Subject);`,
    `const module = await Factory.createTestingModule({}).compile(); const service = module.get('Subject');`,
    `const module = await Factory.createTestingModule({}).compile(); let service = module.get(Subject); service = { refund() {} };`,
    `let module = await Factory.createTestingModule({}).compile(); module = { get() {} }; const service = module.get(Subject);`,
    `const module = await Factory.createTestingModule({}).compile(); let service = module.get(Subject); [service] = [{ refund() {} }];`,
    `const module = await Factory.createTestingModule({}).compile(); let service = module.get(Subject); service++;`,
    `const module = await Factory.createTestingModule({}).compile(); const service = module.get(Subject);
      { const service = { refund() {} }; it('shadowed', () => service.refund()); }`,
  ])('rejects unsupported or ambiguous bindings without fallback', setup => {
    const result = graph(`${setup}\nit('unresolved', () => { ${setup.includes("it('shadowed'") ? '' : 'service.refund();'} });`);
    expect(result.edges).toEqual([]);
  });

  it('does not trust an identically named factory imported from another package', () => {
    const result = graph(`const module = await Factory.createTestingModule({}).compile(); const service = module.get(Subject);
      it('unresolved', () => service.refund());`, "import { Test as Factory } from 'unrelated-package';");
    expect(result.edges).toEqual([]);
  });
});
