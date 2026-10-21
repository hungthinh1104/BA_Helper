import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildGraph, scanProject } from '../../src';

describe('Jest test-case extraction', () => {
  let root: string;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'ba-jest-cases-')); mkdirSync(join(root, 'src')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  function scan(content: string) {
    const file = join(root, 'src/payment.spec.ts');
    writeFileSync(file, content);
    return scanProject({ fixturePath: root, tsFiles: [file] });
  }

  it('retains the test file and extracts named cases, nested suites and modifiers', () => {
    const result = scan(`describe('PaymentService', () => {
  describe('refund', () => {
    it('refunds once', () => {});
    test.skip('skipped refund', () => {});
    test.todo('retry policy');
    it.only('focused refund', () => {});
  });
});
describe.skip('disabled suite', () => { it('inherits skip', () => {}); });`);
    const file = result.artifacts.find(a => a.type === 'TEST')!;
    const cases = result.artifacts.filter(a => a.type === 'JEST_TEST_CASE');
    expect(result.artifacts).toHaveLength(6);
    expect(cases.map(a => a.testCase?.modifier)).toEqual(['NORMAL', 'SKIP', 'TODO', 'ONLY', 'SKIP']);
    expect(cases[0].testCase).toEqual({ framework: 'jest', suitePath: ['PaymentService', 'refund'],
      title: 'refunds once', modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: file.stableId });
    expect(cases[0]).toMatchObject({ startLine: 3, endLine: 3, excerpt: "it('refunds once', () => {})" });
    expect(cases[0].testBodySpan).toBeDefined();
    expect(cases[2].testBodySpan).toBeUndefined();
  });

  it('keeps identity independent of line positions and content changes', () => {
    const original = "describe('refund', () => { it('rejects duplicates', () => { expect(1).toBe(1); }); });";
    const before = scan(original).artifacts.find(a => a.type === 'JEST_TEST_CASE')!;
    const shifted = scan(`// extra line\n\n${original}`).artifacts.find(a => a.type === 'JEST_TEST_CASE')!;
    const changed = scan(original.replace('toBe(1)', 'toBe(2)')).artifacts.find(a => a.type === 'JEST_TEST_CASE')!;
    expect(before).toBeDefined();
    expect(shifted.stableId).toBe(before.stableId);
    expect(shifted.contentHash).toBe(before.contentHash);
    expect(changed.stableId).toBe(before.stableId);
    expect(changed.contentHash).not.toBe(before.contentHash);
    expect(scan(original.replace('describe(', 'describe.skip(')).artifacts.find(a => a.type === 'JEST_TEST_CASE')!.contentHash)
      .not.toBe(before.contentHash);
  });

  it('reports duplicate identities instead of collapsing two cases into one persisted case', () => {
    const result = scan("describe('refund', () => { it('same title', () => {}); it('same title', () => {}); });");
    expect(result.artifacts.filter(a => a.type === 'JEST_TEST_CASE')).toEqual([]);
    expect(result.artifacts.filter(a => a.type === 'TEST')).toHaveLength(1);
    expect(result.diagnostics?.some(d => d.code === 'JEST_DUPLICATE_TEST_IDENTITY')).toBe(true);
  });

  it('does not invent cases for dynamic titles, dynamic tables or dynamic suites', () => {
    const result = scan(`it(getTitle(), () => {});
test.each(dynamicTable)('refund %i', () => {});
describe.each([1])('suite %i', () => { it('nested', () => {}); });
describe(getSuite(), () => { it('unknown suite', () => {}); });
if (enabled) { it('conditional', () => {}); }
it('supported', () => {});`);
    expect(result.artifacts.filter(a => a.type === 'JEST_TEST_CASE').map(a => a.testCase?.title)).toEqual(['supported']);
    expect(result.diagnostics?.some(d => d.code === 'JEST_UNSUPPORTED_DECLARATION')).toBe(true);
  });

  it('recognizes Jest import aliases and rejects locally shadowed or other-framework APIs', () => {
    const aliased = scan("import { it as check } from '@jest/globals'; check('refund', () => {});");
    expect(aliased.artifacts.filter(a => a.type === 'JEST_TEST_CASE')).toHaveLength(1);
    expect(scan("import { test } from 'vitest'; test('vitest', () => {});").artifacts.filter(a => a.type === 'JEST_TEST_CASE')).toEqual([]);
    expect(scan("function it(title: string, fn: () => void) {} it('helper', () => {});").artifacts.filter(a => a.type === 'JEST_TEST_CASE')).toEqual([]);
  });

  it('redacts title/suite metadata and keeps secret literals out of artifact keys and names', () => {
    const secret = `ghp_${'x'.repeat(36)}`;
    const result = scan(`describe('${secret}', () => { it('rejects ${secret}', () => {}); });`);
    const test = result.artifacts.find(a => a.type === 'JEST_TEST_CASE')!;
    expect(JSON.stringify({ key: test.stableId, name: test.symbolName, metadata: test.testCase })).not.toContain(secret);
    expect(test.testCase?.title).toContain('[REDACTED_SECRET:');
  });

  it('rejects malformed declarations and preserves only supported literal syntax', () => {
    const result = scan(`describe('async', async () => { it('hidden', () => {}); });
it('outer', () => { it('nested', () => {}); });
test.todo('bad todo', () => {});
it.SKIP('wrong modifier', () => {});
it('valid', () => {});`);
    expect(result.artifacts.filter(a => a.type === 'JEST_TEST_CASE').map(a => a.testCase?.title)).toEqual(['valid']);
    expect(result.diagnostics?.some(d => d.code === 'JEST_UNSUPPORTED_DECLARATION')).toBe(true);
  });

  it('supports twenty literal suites and keeps delimiter-like titles distinct', () => {
    const nested = 'describe("suite", () => {'.repeat(20) + 'it("deep", () => {});' + '});'.repeat(20);
    expect(scan(nested).artifacts.find(a => a.type === 'JEST_TEST_CASE')?.testCase?.suitePath).toHaveLength(20);
    const result = scan(`describe('a > b', () => { it('c', () => {}); });
describe('a', () => { it('b > c', () => {}); });`);
    const keys = result.artifacts.filter(a => a.type === 'JEST_TEST_CASE').map(a => a.stableId);
    expect(keys).toHaveLength(2);
    expect(new Set(keys).size).toBe(2);
  });

  it('maps calls to their own case bodies and excludes setup, skip and todo references', () => {
    const service = join(root, 'src/payment.service.ts');
    writeFileSync(service, `import { Injectable } from '@nestjs/common';
@Injectable() export class PaymentService { refund() {} authorize() {} }`);
    const file = join(root, 'src/payment.spec.ts');
    writeFileSync(file, `import { PaymentService } from './payment.service';
const service = new PaymentService();
beforeEach(() => service.authorize());
it('refund', () => service.refund()); it('authorize', () => service.authorize());
it.skip('skipped', () => service.refund());
it.todo('todo');
describe.skip('disabled', () => { it('nested skipped', () => service.refund()); });`);
    const result = scanProject({ fixturePath: root, tsFiles: [file, service] });
    const graph = buildGraph(result);
    const testEdges = graph.edges.filter(e => e.type === 'TESTS');
    expect(testEdges).toHaveLength(2);
    const artifact = (key: string) => result.artifacts.find(a => a.stableId === key)!;
    expect(testEdges.map(e => [artifact(e.from).testCase?.title, artifact(e.to).symbolName])).toEqual([
      ['refund', 'PaymentService.refund'], ['authorize', 'PaymentService.authorize'],
    ]);
    expect(testEdges.every(e => artifact(e.from).type === 'JEST_TEST_CASE')).toBe(true);
  });
});
