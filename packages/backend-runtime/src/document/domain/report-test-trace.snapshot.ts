import { reportTestTraceSnapshotSchema } from '@ba-helper/contracts';
import type { QaCoverageResponse } from '@ba-helper/contracts';
import { AppError } from '@ba-helper/shared';

export function freezeReportTestTrace(coverage: QaCoverageResponse, retainedArtifactIds: Set<string>) {
  const items = coverage.items.filter(item => retainedArtifactIds.has(item.artifactId));
  return reportTestTraceSnapshotSchema.parse({ version: 1, coverage: { ...coverage, items,
    summary: { covered: items.filter(i => i.status === 'COVERED').length,
      indirectOnly: items.filter(i => i.status === 'INDIRECT_ONLY').length,
      noTestFound: items.filter(i => i.status === 'NO_TEST_FOUND').length,
      highSeverityGaps: items.filter(i => i.status === 'NO_TEST_FOUND' && i.severity === 'HIGH').length },
  } });
}

export function readReportTestTrace(value: unknown, expected: {
  analysisId: string; snapshotId?: string; commitSha?: string; analyzerVersion?: string;
}) {
  if (value === null || value === undefined) return null;
  const parsed = reportTestTraceSnapshotSchema.safeParse(value);
  if (parsed.success) {
    const { coverage } = parsed.data;
    if (coverage.analysisId === expected.analysisId &&
      (!expected.snapshotId || coverage.snapshotId === expected.snapshotId) &&
      (!expected.commitSha || coverage.traceContext.commitSha === expected.commitSha) &&
      (!expected.analyzerVersion || coverage.traceContext.analyzerVersion === expected.analyzerVersion)) return parsed.data;
  }
  throw new AppError('INVALID_EVIDENCE_ORIGIN', 'Saved test trace identity is invalid.');
}
