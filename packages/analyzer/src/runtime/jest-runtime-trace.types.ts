import type { ScanArtifact } from '../scanner/scanner.types';

export const JEST_RUNTIME_TRACE_LIMITS = {
  maxReportBytes: 20 * 1024 * 1024,
  maxSuites: 10_000,
  maxCases: 10_000,
  maxStaticCases: 100_000,
} as const;

export type RuntimeTraceOutcome = 'PASSED' | 'FAILED' | 'PENDING' | 'TODO' | 'UNKNOWN';
export type RuntimeTraceCorrelation = 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS' | 'SNAPSHOT_MISMATCH';

export type JestRuntimeObservation = {
  evidenceKind: 'RUNTIME_OBSERVATION';
  runId: string;
  commitSha: string;
  observationId: string;
  testCaseId: string | null;
  testCaseArtifactKey: string | null;
  correlation: RuntimeTraceCorrelation;
  sourceLocation: { relativePath: string; line: number; column: number } | null;
  span: { startTimeEpochMs: number | null; endTimeEpochMs: number | null; durationMs: number | null };
  outcome: RuntimeTraceOutcome;
  attemptDetail: 'FINAL_RESULT_ONLY';
};

export type JestRuntimeTrace = {
  format: 'ba-helper.jest-runtime-trace.v1';
  evidenceKind: 'RUNTIME_OBSERVATION';
  runId: string;
  commitSha: string;
  staticSnapshotCommitSha: string;
  importStatus: 'COMPLETE' | 'PARTIAL';
  traceDigest: string;
  capabilities: {
    testCaseOutcomes: true;
    testCaseTiming: true;
    sourceLocations: true;
    methodCallSpans: false;
    mockInvocations: false;
    retryHistory: false;
  };
  observations: JestRuntimeObservation[];
  diagnostics: Array<{ code: string; count: number }>;
};

export type JestRuntimeTraceImportInput = {
  repoRoot: string;
  commitSha: string;
  staticSnapshotCommitSha: string;
  staticArtifacts: readonly ScanArtifact[];
  runId?: string;
  /** Jest Circus uses 1-based columns; jest-jasmine2 reports 0-based columns. */
  locationColumnBase?: 0 | 1;
};
