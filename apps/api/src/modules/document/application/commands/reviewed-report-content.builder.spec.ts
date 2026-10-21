import { ReviewedReportContentBuilder } from './reviewed-report-content.builder';
import { staticTestTraceFixture, traceIds } from '../../../../../../../tests/fixtures/static-test-trace.fixture';

describe('reviewed report test trace capture', () => {
  it('captures a detached versioned projection and excludes rejected impact conclusions', async () => {
    const projection = staticTestTraceFixture();
    const links = { listByAnalysis: jest.fn().mockResolvedValue([{ artifactId: traceIds.code, reviewStatus: 'REJECTED', evidenceLinks: [] }]) };
    const insights = { listByAnalysis: jest.fn().mockResolvedValue([]) };
    const evaluation = { getEvaluationContext: jest.fn().mockReturnValue(null) };
    const coverage = { execute: jest.fn().mockResolvedValue(projection) };
    const builder = new ReviewedReportContentBuilder(links as any, insights as any, evaluation as any, coverage as any);
    const result = await builder.build({ analysisId: traceIds.analysis });
    expect(result.testTraceSnapshot).toMatchObject({ version: 1, coverage: { analysisId: traceIds.analysis,
      snapshotId: traceIds.snapshot, items: [], summary: { covered: 0 } } });
    projection.traceContext!.commitSha = 'changed-after-capture';
    expect((result.testTraceSnapshot as any).coverage.traceContext.commitSha).toBe('a'.repeat(40));
  });

  it('preserves non-rejected rows with source evidence and search limitations', async () => {
    const projection = staticTestTraceFixture(); projection.traceContext!.limitations = ['SNAPSHOT_PARTIAL'];
    const builder = new ReviewedReportContentBuilder(
      { listByAnalysis: async () => [{ artifactId: traceIds.code, reviewStatus: 'CONFIRMED', evidenceLinks: [] }] } as any,
      { listByAnalysis: async () => [] } as any, { getEvaluationContext: () => null } as any,
      { execute: async () => projection } as any);
    const result = await builder.build({ analysisId: traceIds.analysis });
    expect((result.testTraceSnapshot as any).coverage.items[0].testArtifacts[0].trace.edges[0].evidenceId).toBe(traceIds.evidence);
    expect((result.testTraceSnapshot as any).coverage.traceContext.limitations).toEqual(['SNAPSHOT_PARTIAL']);
  });
});
