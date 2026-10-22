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
    expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('bookingRepository.insert'))).toBe(true);
    expect(claims.some(claim => claim.kind === 'ACTION' && claim.sourceText.includes('cancelPaidBooking'))).toBe(true);
    expect(claims.some(claim => claim.kind === 'INPUT' && claim.sourceText.includes('paidBooking'))).toBe(true);
    expect(claims.filter(claim => claim.kind === 'MOCK').map(claim => claim.sourceText)).toEqual(expect.arrayContaining([
      'jest.clearAllMocks()', 'jest.restoreAllMocks()',
    ]));
    expect(claims.find(claim => claim.kind === 'EXPECTED_OUTCOME')?.sourceText).toBe('request');
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
      expect(cases[0].testCase?.behaviorEvidence?.filter(claim => claim.kind === 'EXPECTED_OUTCOME')).toHaveLength(1);
    } finally {
      removeTempDirectory(root, 'ba-jest-behavior-each-');
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
