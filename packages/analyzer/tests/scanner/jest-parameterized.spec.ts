import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildGraph, scanProject } from '../../src';

describe('parameterized Jest source declarations', () => {
  let root: string;
  beforeEach(() => {
    root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-each-')));
    mkdirSync(join(root, 'src'));
  });
  afterEach(() => {
    const name = relative(realpathSync.native(tmpdir()), root);
    if (!name.startsWith('ba-jest-each-') || /[/\\]/.test(name)) throw new Error('Unsafe cleanup.');
    rmSync(root, { recursive: true, force: true });
  });

  function scan(content: string) {
    const test = join(root, 'src/payment.spec.ts'), service = join(root, 'src/payment.service.ts');
    writeFileSync(service, `import { Injectable } from '@nestjs/common';
      @Injectable() export class PaymentService { refund() {} authorize() {} }`);
    writeFileSync(test, `import { PaymentService } from './payment.service';
      const service = new PaymentService();\n${content}`);
    const result = scanProject({ fixturePath: root, tsFiles: [service, test] });
    return { ...result, cases: result.artifacts.filter(a => a.type === 'JEST_TEST_CASE') };
  }

  it('extracts one source declaration with an unexpanded title and only callback references', () => {
    const result = scan("it.each([service.authorize(), 2])('refund %s', () => service.refund());");
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0].testCase).toMatchObject({ title: 'refund %s', parameterized: true });
    const target = result.artifacts.find(artifact => artifact.symbolName === 'PaymentService.refund')!;
    expect(buildGraph(result).edges).toEqual([expect.objectContaining({ type: 'TESTS', to: target.stableId })]);
  });

  it('keeps row edits out of identity and includes them in content hashes', () => {
    const before = scan("it.each([1, 2])('refund %s', () => service.refund());").cases[0];
    const after = scan("\n\nit.only.each([3])('refund %s', () => service.refund());").cases[0];
    expect(before).toBeDefined();
    expect(after.stableId).toBe(before.stableId);
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(after.testCase).toMatchObject({ parameterized: true, modifier: 'ONLY' });
  });

  it('keeps test-file identities distinct when flattened paths would collide', () => {
    const firstPath = 'src/a.b/payment.spec.ts';
    const secondPath = 'src/a/b.payment.spec.ts';
    const firstFile = join(root, firstPath), secondFile = join(root, secondPath);
    mkdirSync(join(root, 'src/a.b'), { recursive: true });
    mkdirSync(join(root, 'src/a'), { recursive: true });
    writeFileSync(firstFile, "it('first', () => {});");
    writeFileSync(secondFile, "it('second', () => {});");
    const result = scanProject({ fixturePath: root, tsFiles: [firstFile, secondFile] });
    const files = result.artifacts.filter(artifact => artifact.type === 'TEST');
    expect(new Set(files.map(artifact => artifact.stableId)).size).toBe(2);
    expect(files.map(artifact => artifact.stableId)).toEqual(expect.arrayContaining([
      `test:${encodeURIComponent(firstPath)}#file`,
      `test:${encodeURIComponent(secondPath)}#file`,
    ]));
  });

  it('distinguishes a parameterized declaration from an ordinary case with the same title', () => {
    const result = scan("it('same', () => service.refund()); it.each([1])('same', () => service.refund());");
    expect(result.cases).toHaveLength(2);
    expect(new Set(result.cases.map(a => a.stableId)).size).toBe(2);
    expect(result.cases[0].testCase).not.toHaveProperty('parameterized');
    expect(result.cases[1].testCase).toHaveProperty('parameterized', true);
  });

  it('preserves skip/only modifiers and does not publish skipped callback references', () => {
    const result = scan(`test.skip.each([1])('skip %s', () => service.authorize());
      describe.skip('disabled', () => { it.each([1])('inherited %s', () => service.authorize()); });
      test.only.each([1])('active %s', () => service.refund());`);
    expect(result.cases.map(a => a.testCase?.modifier)).toEqual(['SKIP', 'SKIP', 'ONLY']);
    expect(buildGraph(result).edges).toHaveLength(1);
  });

  it('recognizes a named Jest import alias without evaluating data', () => {
    const result = scan("import { test as check } from '@jest/globals'; check.each([unknownValue])('value %s', () => service.refund());");
    expect(result.cases[0]?.testCase).toHaveProperty('parameterized', true);
  });

  it('retains an empty table as a source declaration without inventing runtime cases', () => {
    const result = scan("test.each([])('empty %s', () => service.refund());");
    expect(result.cases).toHaveLength(1);
    expect(result.cases[0].testCase?.title).toBe('empty %s');
    expect(result.cases[0].testCase).not.toHaveProperty('rowCount');
  });

  it.each([
    "it.each(table)('dynamic table %s', () => service.refund());",
    "describe.each([1])('suite %s', () => { it('nested', () => service.refund()); });",
    "it.concurrent.each([1])('concurrent %s', () => service.refund());",
    "it.todo.each([1])('todo %s', () => service.refund());",
    "it.each([1], extra)('bad table', () => service.refund());",
    "it.each([1])(getTitle(), () => service.refund());",
    "import { test } from 'vitest'; test.each([1])('other runner', () => service.refund());",
    "function it() {} it.each([1])('shadow', () => service.refund());",
  ])('does not invent supported declarations for %s', content => {
    expect(scan(content).cases).toEqual([]);
  });
});
