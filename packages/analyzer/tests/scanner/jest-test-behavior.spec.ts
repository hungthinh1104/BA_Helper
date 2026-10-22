import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { Project } from 'ts-morph';
import { scanProject } from '../../src';
import { TypeScriptNestJsAdapter } from '../../src/scanner/adapters/typescript-nestjs.adapter';
import { extractJestTestArtifacts } from '../../src/scanner/jest/jest-test-extractor';

describe('static Jest behavior evidence', () => {
  const commitSha = 'a'.repeat(40);

  it('extracts booking setup, input, action, mock, assertion and explicit outcomes with exact provenance', async () => {
    const root = realpathSync.native(join(__dirname, '../../../../tests/fixtures/jest-behavior/repo'));
    const file = join(root, 'test/refund-flow.spec.ts');
    const serviceFile = join(root, 'src/booking/booking.service.ts');
    const source = readFileSync(file, 'utf8');
    const adapter = new TypeScriptNestJsAdapter();
    const input = { rootDir: root, tsFiles: [serviceFile, file], commitSha };
    const result = await adapter.scan(input);
    const repeated = await adapter.scan(input);
    const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
    const claims = test.testCase?.behaviorEvidence ?? [];
    expect(repeated.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence).toEqual(claims);

    expect(new Set(claims.map(claim => claim.kind))).toEqual(new Set([
      'SETUP_HOOK', 'TEARDOWN_HOOK', 'INPUT', 'ACTION', 'MOCK', 'ASSERTION', 'EXPECTED_OUTCOME',
    ]));
    expect(claims.every(claim => claim.evidenceKind === 'STATIC_DECLARATION' && claim.commitSha === commitSha)).toBe(true);
    expect(claims.every(claim => claim.sourceLocation.relativePath === 'test/refund-flow.spec.ts')).toBe(true);
    for (const claim of claims) {
      expect(source.slice(claim.sourceLocation.startOffset, claim.sourceLocation.endOffset)).toBe(claim.sourceText);
      expect(lineColumn(source, claim.sourceLocation.startOffset)).toEqual({
        line: claim.sourceLocation.startLine, column: claim.sourceLocation.startColumn,
      });
      expect(lineColumn(source, claim.sourceLocation.endOffset)).toEqual({
        line: claim.sourceLocation.endLine, column: claim.sourceLocation.endColumn,
      });
    }
    expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('bookingRepository.insert'))).toBe(false);
    expect(claims.some(claim => claim.kind === 'SETUP_HOOK' && claim.sourceText.includes('bookingRepository.insert'))).toBe(true);
    expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('cancelPaidBooking'))).toBe(true);
    expect(claims.some(claim => claim.kind === 'INPUT' && claim.sourceText.includes('paidBooking'))).toBe(true);
    expect(claims.filter(claim => claim.kind === 'MOCK').map(claim => claim.sourceText)).toEqual(expect.arrayContaining([
      'jest.clearAllMocks()', 'jest.restoreAllMocks()',
    ]));
    expect(claims.find(claim => claim.kind === 'EXPECTED_OUTCOME')?.sourceText).toBe('request');
    expect(claims.find(claim => claim.kind === 'EXPECTED_OUTCOME')?.assertionKind).toBe('INVOCATION_ARGUMENTS');
    expect(result.dependencyEdges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'TESTS', toArtifactId: expect.stringContaining('BookingService.cancelPaidBooking') }),
    ]));
    expect(JSON.stringify(claims)).not.toMatch(/executed|passed|covered/i);
    expect(result.diagnostics?.filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')).toEqual([]);
  });

  it('records parameterized source rows once without expanding them into runtime cases', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-each-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, test } from '@jest/globals';
test.each([{ status: 'REFUNDED' }, { status: 'DECLINED' }])('status %s', row => {
  expect(row.status).toBe('REFUNDED');
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const cases = result.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      expect(cases).toHaveLength(1);
      expect(cases[0].testCase).toMatchObject({ parameterized: true });
      expect(cases[0].testCase?.behaviorEvidence).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'INPUT', sourceText: "[{ status: 'REFUNDED' }, { status: 'DECLINED' }]" }),
      ]));
      expect(cases[0].testCase?.behaviorEvidence?.filter(claim => claim.kind === 'EXPECTED_OUTCOME')).toMatchObject([
        { assertionKind: 'STATE', sourceText: "'REFUNDED'" },
      ]);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-each-');
    }
  });

  it('separates assertion semantics, validates chained mock identity, and keeps inherited setup out of actions', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-semantics-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `import { expect, it, jest } from '@jest/globals';
const gateway = { refund: jest.fn() };
beforeAll(() => { Test.createTestingModule({ providers: [] }).compile(); });
describe('refund', () => {
  beforeEach(() => { const module = Test.createTestingModule({ providers: [] }).compile(); module.get(RefundService); });
  it('classifies evidence', () => {
    const output = service.run();
    gateway.refund.mockResolvedValue('REFUNDED');
    expect(output).toEqual('ok');
    expect(state.status).toBe('REFUNDED');
    expect(gateway.refund).toHaveBeenNthCalledWith(2, 'payment-id', 7);
    expect(gateway.refund).toHaveBeenCalledTimes(3);
    expect(() => service.fail()).toThrow('failed');
    expect(state).toHaveProperty('status', 'PAID');
    business.mockResolvedValue('unknown mock');
    expect(output).toEventuallyBe('ok');
    service.wait(() => service.runNested());
  });
  it('does not trust a shadowed expect identifier', () => {
    const expect = (value: unknown) => ({ toBe: (_expected: unknown) => value });
    expect(1).toBe(1);
  });
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const cases = result.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      const claims = cases[0].testCase?.behaviorEvidence ?? [];
      expect(cases).toHaveLength(2);
      expect(claims.some(claim => claim.kind === 'SETUP_HOOK' && claim.sourceText.includes('Test.createTestingModule'))).toBe(true);
      expect(claims.some(claim => claim.kind === 'ACTION' && /Test\.createTestingModule|module\.get/.test(claim.sourceText))).toBe(false);
      expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText === 'service.run()')).toBe(true);
      expect(claims.some(claim => claim.kind === 'MOCK' && claim.sourceText.includes('gateway.refund.mockResolvedValue'))).toBe(true);
      expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('business.mockResolvedValue'))).toBe(false);
      expect(claims.filter(claim => claim.kind === 'EXPECTED_OUTCOME').map(claim => [claim.assertionKind, claim.sourceText]))
        .toEqual(expect.arrayContaining([
          ['RETURN_VALUE', "'ok'"], ['STATE', "'REFUNDED'"], ['CALL_COUNT', '2'],
          ['INVOCATION_ARGUMENTS', "'payment-id'"], ['INVOCATION_ARGUMENTS', '7'],
          ['CALL_COUNT', '3'], ['EXCEPTION', "'failed'"], ['STATE', "'status'"], ['STATE', "'PAID'"],
        ]));
      const unresolved = result.diagnostics?.filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')
        .map(item => item.payload?.unsupportedPattern);
      expect(unresolved).toEqual(expect.arrayContaining([
        'MOCK_IDENTITY_UNRESOLVED', 'ASSERTION_SEMANTICS_UNRESOLVED', 'NESTED_CALLBACK_NOT_ANALYZED',
        'ASSERTION_IDENTITY_UNRESOLVED',
      ]));
      expect(cases[1].testCase?.behaviorEvidence?.some(claim => claim.kind === 'ASSERTION')).toBe(false);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-semantics-');
    }
  });

  it('reports unsupported callbacks, dynamic matchers and snapshots without inventing claims', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-negative-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, `beforeEach(makeSetup());
it('does not imply runtime execution', () => {
  setTimeout(() => subject.execute(), 0);
  expect(subject.value)[matcher](42);
  expect(subject.value).toMatchSnapshot();
});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      const patterns = result.diagnostics?.filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')
        .map(item => item.payload?.unsupportedPattern);
      expect(patterns).toEqual(expect.arrayContaining([
        'NESTED_CALLBACK_NOT_ANALYZED', 'DYNAMIC_MATCHER_NOT_ANALYZED', 'SNAPSHOT_EXPECTATION_UNRESOLVED',
        'UNSUPPORTED_SETUP_HOOK',
      ]));
      expect(claims.some(claim => claim.sourceText.includes('subject.execute'))).toBe(false);
      expect(claims.some(claim => claim.sourceText.includes('[matcher]'))).toBe(false);
      expect(claims.some(claim => claim.kind === 'EXPECTED_OUTCOME' && claim.sourceText.includes('Snapshot'))).toBe(false);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-negative-');
    }
  });

  it('withholds claims and diagnoses behavior when commit context is absent', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-context-')));
    try {
      const file = join(root, 'refund.spec.ts');
      writeFileSync(file, "it('refunds', () => { expect(service.refund()).toBe('REFUNDED'); });");
      const result = scanProject({ fixturePath: root, tsFiles: [file] });
      const test = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      expect(test.testCase?.behaviorEvidence).toBeUndefined();
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          relativePath: 'refund.spec.ts', unsupportedPattern: 'COMMIT_CONTEXT_REQUIRED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-context-');
    }
  });

  it('caps claims per test case and reports omitted declarations', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-limit-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const assertions = Array.from({ length: 60 }, (_, index) => `expect(value).toBe(${index});`).join('\n');
      writeFileSync(file, `it('bounded', () => {\n${assertions}\n});`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      expect(claims).toHaveLength(100);
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          unsupportedPattern: 'CLAIM_LIMIT_EXCEEDED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-limit-');
    }
  });

  it('applies the source excerpt limit after secret redaction', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-redaction-limit-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const accessKey = `AKIA${'A'.repeat(16)}`;
      const paddedOutcome = `${accessKey}${'x'.repeat(1977)}`;
      writeFileSync(file, `it('redacts', () => { expect(value).toBe('${paddedOutcome}'); });`);
      const result = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
      expect(claims.some(claim => claim.kind === 'EXPECTED_OUTCOME')).toBe(false);
      expect(result.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
          unsupportedPattern: 'SOURCE_TEXT_LIMIT_EXCEEDED',
        }) }),
      ]));
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-redaction-limit-');
    }
  });

  it('enforces the shared scan claim budget and reports omitted declarations', () => {
    const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true,
      compilerOptions: { noResolve: true, noLib: true } });
    const file = project.createSourceFile('refund.spec.ts', "it('limited', () => { expect(1).toBe(1); });");
    const result = extractJestTestArtifacts(file, 'refund.spec.ts', commitSha, { remaining: 1 });
    const claims = result.artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')?.testCase?.behaviorEvidence ?? [];
    expect(claims).toHaveLength(1);
    expect(result.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'JEST_BEHAVIOR_UNRESOLVED', payload: expect.objectContaining({
        unsupportedPattern: 'SCAN_CLAIM_LIMIT_EXCEEDED',
      }) }),
    ]));
  });

  it('includes setup behavior in incremental content hashes without making line offsets identity', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-hash-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const scan = (source: string) => {
        writeFileSync(file, source);
        return scanProject({ fixturePath: root, tsFiles: [file], commitSha })
          .artifacts.find(artifact => artifact.type === 'JEST_TEST_CASE')!;
      };
      const original = scan(`beforeEach(() => { const booking = { status: 'PAID' }; });
it('refunds', () => {});`);
      const shifted = scan(`// source location shifts
beforeEach(() => { const booking = { status: 'PAID' }; });
it('refunds', () => {});`);
      const changed = scan(`beforeEach(() => { const booking = { status: 'CANCELLED' }; });
it('refunds', () => {});`);
      expect(shifted.stableId).toBe(original.stableId);
      expect(shifted.contentHash).toBe(original.contentHash);
      expect(changed.stableId).toBe(original.stableId);
      expect(changed.contentHash).not.toBe(original.contentHash);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-hash-');
    }
  });

  it('keeps deterministic bounded extraction under a large test file', () => {
    const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'ba-jest-behavior-perf-')));
    try {
      const file = join(root, 'refund.spec.ts');
      const tests = Array.from({ length: 250 }, (_, index) =>
        `it('case ${index}', () => { const input = ${index}; expect(input).toBe(${index}); });`).join('\n');
      writeFileSync(file, tests);
      const startedAt = Date.now();
      const first = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const second = scanProject({ fixturePath: root, tsFiles: [file], commitSha });
      const elapsedMs = Date.now() - startedAt;
      const firstCases = first.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      const secondCases = second.artifacts.filter(artifact => artifact.type === 'JEST_TEST_CASE');
      expect(firstCases).toHaveLength(250);
      expect(firstCases.map(item => item.contentHash)).toEqual(secondCases.map(item => item.contentHash));
      expect(firstCases.every(item => item.testCase?.behaviorEvidence?.length === 3)).toBe(true);
      expect(elapsedMs).toBeLessThan(5000);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-perf-');
    }
  });
});

function removeTempDirectory(root: string, prefix: string): void {
  const name = relative(realpathSync.native(tmpdir()), root);
  if (!name.startsWith(prefix) || /[/\\]/.test(name)) throw new Error('Unsafe cleanup.');
  rmSync(root, { recursive: true, force: true });
}

function lineColumn(source: string, offset: number): { line: number; column: number } {
  const lines = source.slice(0, offset).split(/\r?\n/);
  return { line: lines.length, column: lines.at(-1)!.length + 1 };
}
