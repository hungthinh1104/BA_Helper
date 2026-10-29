import { ReviewedSnapshotReportContextAdapter } from './reviewed-snapshot-report-context.adapter';
import { freezeReportTestTrace } from '../../domain/report-test-trace.snapshot';
import { staticTestTraceFixture, traceIds } from '../../../../../../tests/fixtures/static-test-trace.fixture';

const emptyEvidenceQualitySummary = {
  missingEvidence: 0,
  reviewRequired: 0,
  evidenced: 0,
  inferred: 0,
  weakEvidence: 0,
};

describe('worker frozen test trace context', () => {
  const empty = { listByAnalysis: async () => [], findByAnalysisId: async () => [], listBySnapshot: async () => [], listByAnalysisId: async () => [] };
  const adapter = new ReviewedSnapshotReportContextAdapter({} as any, empty as any, empty as any,
    empty as any, empty as any, empty as any, empty as any, {} as any);
  const analysis = { id: traceIds.analysis, snapshot: { id: traceIds.snapshot, repositoryId: 'repo',
    repository: { projectId: 'project' }, commitSha: 'a'.repeat(40), analyzerVersion: 'analyzer@0.5.0' },
    requirementRevision: { title: 'Refund' }, sourceTarget: { requestedRef: 'main' }, updatedAt: new Date() };

  it('reads captured trace data even when live report relations are empty', async () => {
    const saved = freezeReportTestTrace(staticTestTraceFixture(), new Set([traceIds.code]));
    const context = await adapter.buildContext({ createdAt: new Date(), reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary, testTraceSnapshot: saved }, analysis);
    expect(context.testTraceSnapshot).toEqual(saved);
    expect(context.testTraceSnapshot?.coverage.items[0].testArtifacts[0].trace?.edges[0].evidenceId).toBe(traceIds.evidence);
  });
  it('does not reconstruct legacy test paths from live dependencies', async () => {
    const context = await adapter.buildContext({ createdAt: new Date(), reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary }, analysis);
    expect(context.testTraceSnapshot).toBeNull();
  });
});
