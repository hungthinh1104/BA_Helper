import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ScanArtifact } from '../../src/scanner/scanner.types';
import { importJestRuntimeTrace, JEST_RUNTIME_TRACE_LIMITS } from '../../src/runtime/jest-runtime-trace';

const commitSha = 'a'.repeat(40);
const repoRoot = join(tmpdir(), 'ba-runtime-trace-repository');

describe('local Jest runtime trace import', () => {
  it('correlates final results to a static case by snapshot, repository path and source location', () => {
    const source = report([caseResult({ status: 'failed', failureMessages: ['secret assertion detail'] })]);
    const trace = importJestRuntimeTrace(source, input([testArtifact()]));

    expect(trace).toMatchObject({
      evidenceKind: 'RUNTIME_OBSERVATION', runId: 'run-123', commitSha,
      importStatus: 'COMPLETE', capabilities: { methodCallSpans: false, mockInvocations: false, retryHistory: false },
      observations: [{
        evidenceKind: 'RUNTIME_OBSERVATION', testCaseId: 'test-case:test/refund.spec.ts::stable-id',
        testCaseArtifactKey: 'test-case:test/refund.spec.ts::stable-id', correlation: 'MATCHED',
        sourceLocation: { relativePath: 'test/refund.spec.ts', line: 12, column: 3 },
        span: { startTimeEpochMs: 1_800_000_000_000, endTimeEpochMs: 1_800_000_000_017, durationMs: 17 },
        outcome: 'FAILED', attemptDetail: 'FINAL_RESULT_ONLY',
      }],
      diagnostics: [],
    });
    expect(JSON.stringify(trace)).not.toContain('secret assertion detail');
    expect(JSON.stringify(trace)).not.toContain('refunds a paid booking');
    expect(JSON.stringify(trace)).not.toContain(repoRoot);
  });

  it('keeps worker completion order out of the imported manifest', () => {
    const artifacts = [testArtifact({ filePath: 'test/z.spec.ts', stableId: 'z', line: 20 }),
      testArtifact({ filePath: 'test/a.spec.ts', stableId: 'a', line: 10 })];
    const first = importJestRuntimeTrace(report([
      caseResult({ testFilePath: `${repoRoot}/test/z.spec.ts`, line: 20 }),
      caseResult({ testFilePath: `${repoRoot}/test/a.spec.ts`, line: 10 }),
    ]), input(artifacts));
    const second = importJestRuntimeTrace(report([
      caseResult({ testFilePath: `${repoRoot}/test/a.spec.ts`, line: 10 }),
      caseResult({ testFilePath: `${repoRoot}/test/z.spec.ts`, line: 20 }),
    ]), input(artifacts));

    expect(second).toEqual(first);
    expect(first.observations.map(item => item.sourceLocation?.relativePath)).toEqual([
      'test/a.spec.ts', 'test/z.spec.ts',
    ]);
  });

  it('does not correlate results from another commit, duplicate source identities, or absent locations', () => {
    const mismatch = importJestRuntimeTrace(report([caseResult()]), input([testArtifact()], { staticCommitSha: 'b'.repeat(40) }));
    const mismatchWithoutCandidate = importJestRuntimeTrace(report([caseResult({ line: 999 })]), input([testArtifact()], { staticCommitSha: 'b'.repeat(40) }));
    const ambiguous = importJestRuntimeTrace(report([caseResult()]), input([
      testArtifact(), testArtifact({ stableId: 'second-static-case' }),
    ]));
    const unmatched = importJestRuntimeTrace(report([caseResult({ line: 50 })]), input([testArtifact()]));
    const missingLocation = importJestRuntimeTrace(report([caseResult({ location: null })]), input([testArtifact()]));

    expect(mismatch.observations[0]).toMatchObject({ correlation: 'SNAPSHOT_MISMATCH', testCaseId: null });
    expect(mismatch.diagnostics).toContainEqual({ code: 'STATIC_SNAPSHOT_MISMATCH', count: 1 });
    expect(mismatchWithoutCandidate.observations[0]).toMatchObject({ correlation: 'SNAPSHOT_MISMATCH', testCaseId: null });
    expect(mismatchWithoutCandidate.diagnostics).toContainEqual({ code: 'STATIC_SNAPSHOT_MISMATCH', count: 1 });
    expect(ambiguous.observations[0]).toMatchObject({ correlation: 'AMBIGUOUS', testCaseId: null });
    expect(ambiguous.diagnostics).toContainEqual({ code: 'STATIC_CASE_AMBIGUOUS', count: 1 });
    expect(unmatched.observations[0]).toMatchObject({ correlation: 'UNMATCHED', testCaseId: null });
    expect(unmatched.diagnostics).toContainEqual({ code: 'STATIC_CASE_UNMATCHED', count: 1 });
    expect(missingLocation.observations[0]).toMatchObject({ correlation: 'UNMATCHED', sourceLocation: null });
    expect(missingLocation.diagnostics).toContainEqual({ code: 'SOURCE_LOCATION_MISSING', count: 1 });
  });

  it('marks unresolved paths, collection-only data and unsupported outcomes without creating false matches', () => {
    const trace = importJestRuntimeTrace(report([
      caseResult({ testFilePath: join(tmpdir(), 'ba-runtime-trace-outside', 'foreign.spec.ts') }),
      caseResult({ wouldRun: true }),
      caseResult({ status: 'unknown-runner-status' }),
    ]), input([testArtifact()]));

    expect(trace.observations).toHaveLength(1);
    expect(trace.observations[0]).toMatchObject({ correlation: 'MATCHED', outcome: 'UNKNOWN' });
    expect(trace.diagnostics).toEqual(expect.arrayContaining([
      { code: 'SOURCE_PATH_OUTSIDE_REPOSITORY', count: 1 },
      { code: 'COLLECTION_ONLY_RESULT', count: 1 },
      { code: 'UNSUPPORTED_RESULT_STATUS', count: 1 },
    ]));
  });

  it('normalizes zero-based jest-jasmine2 source columns when explicitly selected', () => {
    const trace = importJestRuntimeTrace(report([caseResult({ location: { line: 12, column: 0 } })]), {
      ...input([testArtifact()]), locationColumnBase: 0,
    });
    expect(trace.observations[0].sourceLocation).toEqual({ relativePath: 'test/refund.spec.ts', line: 12, column: 1 });
  });

  it('retains an observed outcome while marking absent timing as incomplete', () => {
    const trace = importJestRuntimeTrace(report([caseResult({ startAt: null, duration: null })]), input([testArtifact()]));
    expect(trace.observations[0]).toMatchObject({ outcome: 'PASSED', span: {
      startTimeEpochMs: null, endTimeEpochMs: null, durationMs: null,
    } });
    expect(trace.diagnostics).toContainEqual({ code: 'INCOMPLETE_CASE_TIMING', count: 1 });
  });

  it('returns an explicit partial import instead of exceeding the case storage bound', () => {
    const rows = [{
      testFilePath: `${repoRoot}/test/refund.spec.ts`,
      testResults: Array.from({ length: JEST_RUNTIME_TRACE_LIMITS.maxCases + 1 }, () => caseResult().testResults[0]),
    }];
    const trace = importJestRuntimeTrace(report(rows), input([testArtifact()]));

    expect(trace.observations).toHaveLength(0);
    expect(trace.importStatus).toBe('PARTIAL');
    expect(trace.diagnostics).toEqual([{ code: 'JEST_CASE_LIMIT_EXCEEDED', count: 1 }]);
  });

  it('bounds empty suite collections as well as test case collections', () => {
    const suites = Array.from({ length: JEST_RUNTIME_TRACE_LIMITS.maxSuites + 1 }, () => ({}));
    const trace = importJestRuntimeTrace(report(suites), input([testArtifact()]));
    expect(trace.observations).toHaveLength(0);
    expect(trace.diagnostics).toEqual([{ code: 'JEST_SUITE_LIMIT_EXCEEDED', count: 1 }]);
  });
});

function input(staticArtifacts: ScanArtifact[], options: { staticCommitSha?: string } = {}) {
  return { repoRoot, commitSha, staticSnapshotCommitSha: options.staticCommitSha ?? commitSha,
    staticArtifacts, runId: 'run-123' };
}

function report(testResults: unknown[]): string {
  return JSON.stringify({ testResults });
}

function caseResult(options: {
  status?: string; testFilePath?: string; line?: number; location?: unknown;
  duration?: number | null; startAt?: number | null; wouldRun?: boolean; failureMessages?: string[];
} = {}) {
  return {
    testFilePath: options.testFilePath ?? `${repoRoot}/test/refund.spec.ts`,
    testResults: [{
      ancestorTitles: ['BookingService'], title: 'refunds a paid booking', status: options.status ?? 'passed',
      location: options.location === undefined ? { line: options.line ?? 12, column: 3 } : options.location,
      startAt: options.startAt === undefined ? 1_800_000_000_000 : options.startAt,
      duration: options.duration === undefined ? 17 : options.duration,
      ...(options.wouldRun === undefined ? {} : { wouldRun: options.wouldRun }),
      failureMessages: options.failureMessages ?? [],
    }],
  };
}

function testArtifact(options: { filePath?: string; stableId?: string; line?: number } = {}): ScanArtifact {
  return {
    stableId: options.stableId ?? 'test-case:test/refund.spec.ts::stable-id',
    type: 'JEST_TEST_CASE', filePath: options.filePath ?? 'test/refund.spec.ts',
    symbolName: 'BookingService > refunds a paid booking', startLine: options.line ?? 12,
    endLine: (options.line ?? 12) + 4, excerpt: "it('refunds a paid booking', () => {});",
    testCase: { framework: 'jest', suitePath: ['BookingService'], title: 'refunds a paid booking',
      modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: 'test:test/refund.spec.ts#file' },
  };
}
