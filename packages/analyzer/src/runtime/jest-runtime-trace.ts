import { randomUUID } from 'node:crypto';
import type { ScanArtifact } from '../scanner/scanner.types';
import {
  compareText, finiteNonnegative, increment, indexStaticCases, isRecord, normalizeCommit,
  readLocation, readOutcome, repositoryRelativePath, sha256,
} from './jest-runtime-trace.helpers';
import { JEST_RUNTIME_TRACE_LIMITS } from './jest-runtime-trace.types';
import type {
  JestRuntimeObservation, JestRuntimeTrace, JestRuntimeTraceImportInput, RuntimeTraceCorrelation,
} from './jest-runtime-trace.types';

export { JEST_RUNTIME_TRACE_LIMITS } from './jest-runtime-trace.types';
export type {
  JestRuntimeObservation, JestRuntimeTrace, JestRuntimeTraceImportInput,
  RuntimeTraceCorrelation, RuntimeTraceOutcome,
} from './jest-runtime-trace.types';

type RawCase = {
  status?: unknown; location?: unknown;
  startAt?: unknown; duration?: unknown; wouldRun?: unknown;
};
type RawSuite = { testFilePath?: unknown; testResults?: unknown; testExecError?: unknown };
type PendingObservation = Omit<JestRuntimeObservation, 'observationId'> & { identitySeed: string };

/** Imports an explicit local Jest JSON report; it never starts a test process or reads test source. */
export function importJestRuntimeTrace(reportJson: string, input: JestRuntimeTraceImportInput): JestRuntimeTrace {
  const context = readContext(reportJson, input);
  const suites = parseTestSuites(reportJson);
  const diagnostics = new Map<string, number>();
  if (suites.length > JEST_RUNTIME_TRACE_LIMITS.maxSuites) {
    return buildTrace({ ...context, observations: [], diagnostics: new Map([['JEST_SUITE_LIMIT_EXCEEDED', 1]]) });
  }
  const totalCases = countTestCases(suites);
  if (totalCases > JEST_RUNTIME_TRACE_LIMITS.maxCases) {
    return buildTrace({ ...context, observations: [], diagnostics: new Map([
      ['JEST_CASE_LIMIT_EXCEEDED', 1],
    ]) });
  }
  if (totalCases === 0) increment(diagnostics, 'NO_TEST_CASE_RESULTS');

  const index = indexStaticCases(input.staticArtifacts);
  const pending = collectObservations(suites, input, index, context, diagnostics);
  return buildTrace({ ...context, observations: assignObservationIds(pending), diagnostics });
}

function readContext(reportJson: string, input: JestRuntimeTraceImportInput) {
  if (Buffer.byteLength(reportJson, 'utf8') > JEST_RUNTIME_TRACE_LIMITS.maxReportBytes) {
    throw new RangeError('Jest runtime report exceeds the configured byte limit.');
  }
  const runId = input.runId ?? randomUUID();
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(runId)) throw new TypeError('Run ID has an unsupported format.');
  if (input.staticArtifacts.length > JEST_RUNTIME_TRACE_LIMITS.maxStaticCases) {
    throw new RangeError('Static test index exceeds the configured case limit.');
  }
  return { runId, commitSha: normalizeCommit(input.commitSha),
    staticSnapshotCommitSha: normalizeCommit(input.staticSnapshotCommitSha) };
}

function parseTestSuites(reportJson: string): unknown[] {
  const parsed: unknown = JSON.parse(reportJson);
  if (!isRecord(parsed) || !Array.isArray(parsed.testResults)) {
    throw new TypeError('Input is not a Jest JSON test result.');
  }
  return parsed.testResults;
}

function countTestCases(suites: unknown[]): number {
  return suites.reduce<number>((count, value) => {
    const suite = isRecord(value) ? value as RawSuite : undefined;
    return count + (suite && Array.isArray(suite.testResults) ? suite.testResults.length : 0);
  }, 0);
}

function collectObservations(suites: unknown[], input: JestRuntimeTraceImportInput,
  index: Map<string, ScanArtifact[]>,
  context: { runId: string; commitSha: string; staticSnapshotCommitSha: string },
  diagnostics: Map<string, number>): PendingObservation[] {
  return suites.flatMap(suite => collectSuiteObservations(suite, input, index, context, diagnostics));
}

function collectSuiteObservations(value: unknown, input: JestRuntimeTraceImportInput,
  index: Map<string, ScanArtifact[]>,
  context: { runId: string; commitSha: string; staticSnapshotCommitSha: string },
  diagnostics: Map<string, number>): PendingObservation[] {
  if (!isRecord(value)) {
    increment(diagnostics, 'MALFORMED_SUITE_RESULT');
    return [];
  }
  const suite = value as RawSuite;
  if (suite.testExecError) increment(diagnostics, 'SUITE_RUNTIME_ERROR');
  if (!Array.isArray(suite.testResults)) {
    increment(diagnostics, 'MALFORMED_SUITE_RESULT');
    return [];
  }
  const relativePath = repositoryRelativePath(input.repoRoot, suite.testFilePath);
  if (!relativePath) {
    increment(diagnostics, 'SOURCE_PATH_OUTSIDE_REPOSITORY');
    return [];
  }
  return suite.testResults.map(rawCase => createObservation(rawCase, relativePath, input, index, context, diagnostics))
    .filter((item): item is PendingObservation => item !== null);
}

function createObservation(value: unknown, relativePath: string, input: JestRuntimeTraceImportInput,
  index: Map<string, ScanArtifact[]>,
  context: { runId: string; commitSha: string; staticSnapshotCommitSha: string },
  diagnostics: Map<string, number>): PendingObservation | null {
  if (!isRecord(value)) {
    increment(diagnostics, 'MALFORMED_CASE_RESULT');
    return null;
  }
  const rawCase = value as RawCase;
  if (rawCase.wouldRun === true) {
    increment(diagnostics, 'COLLECTION_ONLY_RESULT');
    return null;
  }
  const location = readLocation(rawCase.location, input.locationColumnBase ?? 1);
  const sourceLocation = location ? { relativePath, ...location } : null;
  const candidates = location ? index.get(`${relativePath}:${location.line}`) ?? [] : [];
  const correlation = resolveCorrelation(candidates.length, !!location,
    context.staticSnapshotCommitSha === context.commitSha, diagnostics);
  const testCaseId = correlation === 'MATCHED' ? candidates[0]?.stableId ?? null : null;
  const outcome = readOutcome(rawCase.status);
  if (outcome === 'UNKNOWN') increment(diagnostics, 'UNSUPPORTED_RESULT_STATUS');
  const startTimeEpochMs = finiteNonnegative(rawCase.startAt);
  const durationMs = finiteNonnegative(rawCase.duration);
  const endTimeEpochMs = startTimeEpochMs !== null && durationMs !== null
    ? startTimeEpochMs + durationMs : null;
  if (startTimeEpochMs === null || durationMs === null) increment(diagnostics, 'INCOMPLETE_CASE_TIMING');
  return {
    evidenceKind: 'RUNTIME_OBSERVATION', runId: context.runId, commitSha: context.commitSha,
    testCaseId, testCaseArtifactKey: testCaseId, correlation, sourceLocation,
    span: { startTimeEpochMs, endTimeEpochMs, durationMs }, outcome,
    attemptDetail: 'FINAL_RESULT_ONLY',
    identitySeed: sha256(JSON.stringify([
      context.runId, relativePath, location?.line ?? null, location?.column ?? null,
      startTimeEpochMs, durationMs, outcome, testCaseId, correlation,
    ])),
  };
}

function assignObservationIds(pending: PendingObservation[]): JestRuntimeObservation[] {
  pending.sort(comparePending);
  const occurrences = new Map<string, number>();
  return pending.map(({ identitySeed, ...observation }) => {
    const occurrence = occurrences.get(identitySeed) ?? 0;
    occurrences.set(identitySeed, occurrence + 1);
    return { ...observation, observationId: `${identitySeed}:${occurrence + 1}` };
  });
}

function resolveCorrelation(candidateCount: number, hasLocation: boolean, sameCommit: boolean,
  diagnostics: Map<string, number>): RuntimeTraceCorrelation {
  if (hasLocation && !sameCommit && candidateCount > 0) {
    increment(diagnostics, 'STATIC_SNAPSHOT_MISMATCH');
    return 'SNAPSHOT_MISMATCH';
  }
  if (candidateCount > 1) {
    increment(diagnostics, 'STATIC_CASE_AMBIGUOUS');
    return 'AMBIGUOUS';
  }
  if (!hasLocation) {
    increment(diagnostics, 'SOURCE_LOCATION_MISSING');
    return 'UNMATCHED';
  }
  if (candidateCount === 1 && sameCommit) return 'MATCHED';
  increment(diagnostics, 'STATIC_CASE_UNMATCHED');
  return 'UNMATCHED';
}

function buildTrace(input: {
  runId: string; commitSha: string; staticSnapshotCommitSha: string;
  observations: JestRuntimeObservation[]; diagnostics: Map<string, number>;
}): JestRuntimeTrace {
  const diagnostics = [...input.diagnostics.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([code, count]) => ({ code, count }));
  const base = {
    format: 'ba-helper.jest-runtime-trace.v1' as const,
    evidenceKind: 'RUNTIME_OBSERVATION' as const,
    runId: input.runId,
    commitSha: input.commitSha,
    staticSnapshotCommitSha: input.staticSnapshotCommitSha,
    importStatus: diagnostics.length ? 'PARTIAL' as const : 'COMPLETE' as const,
    capabilities: {
      testCaseOutcomes: true as const, testCaseTiming: true as const, sourceLocations: true as const,
      methodCallSpans: false as const, mockInvocations: false as const, retryHistory: false as const,
    },
    observations: input.observations,
    diagnostics,
  };
  return { ...base, traceDigest: sha256(JSON.stringify(base)) };
}

function comparePending(left: PendingObservation, right: PendingObservation): number {
  return compareText(left.sourceLocation?.relativePath ?? '', right.sourceLocation?.relativePath ?? '')
    || (left.sourceLocation?.line ?? 0) - (right.sourceLocation?.line ?? 0)
    || compareText(left.identitySeed, right.identitySeed);
}
