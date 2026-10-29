import { ApprovedReportProjectionService } from './approved-report-projection.service';

describe('ApprovedReportProjectionService', () => {
  it('returns false for isStale when target is pinned commit and no review decisions', async () => {
    const mockTraceabilityRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    };
    const mockInsightRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    };
    const mockEvalContextAdapter = {
      getEvaluationContext: jest.fn().mockReturnValue(null),
    };
    const service = new ApprovedReportProjectionService(
      {
        reviewedReportSnapshot: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
        documentJob: {
          findMany: jest.fn().mockResolvedValue([]),
        },
        analysisReviewDecision: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any,
      mockTraceabilityRepo as any,
      mockInsightRepo as any,
      mockEvalContextAdapter as any,
    );

    const result = await service.project({
      id: 'doc-1',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      updatedAt: new Date('2026-06-03T12:00:00.000Z'),
      impactAnalysis: {
        id: 'analysis-1',
        updatedAt: new Date('2026-06-03T12:00:00.000Z'),
        snapshot: {
          id: 'snapshot-1',
          repositoryId: 'repo-1',
          commitSha: 'abc1234',
          analyzerVersion: 'analyzer@0.3.0',
        },
        sourceTarget: {
          requestedRef: 'main',
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'abc1234',
        },
        requirementRevision: {
          title: 'Refund report',
          requirement: {
            projectId: 'project-1',
          },
        },
      },
    });

    expect(result.metadata.generatedAt).toBe('2026-06-03T12:00:00.000Z');
    expect(result.metadata.finalizedAt).toBe('2026-06-03T12:00:00.000Z');
    expect(result.metadata.approvedDocumentCreatedAt).toBe('2026-06-01T10:00:00.000Z');
    expect(result.metadata.approvedDocumentUpdatedAt).toBe('2026-06-03T12:00:00.000Z');
  });

  it('projects report content and review metadata from the linked immutable snapshot', async () => {
    const reviewedSnapshot = {
      id: 'reviewed-1',
      approvedDocumentId: 'doc-1',
      markdown: '# Frozen report',
      reviewDecisionsSnapshot: [{ artifact: 'src/refund.ts', quality: 'EVIDENCED', reasons: [] }],
      evidenceQualitySummarySnapshot: {
        missingEvidence: 0,
        reviewRequired: 0,
        evidenced: 1,
        inferred: 0,
        weakEvidence: 0,
      },
      evaluationContextSnapshot: {
        datasetVersion: 'frozen-eval',
        subsetId: 'frozen-subset',
        subsetSize: '1',
        interpretation: 'ILLUSTRATIVE_ONLY',
        knownLimits: [],
        evidenceQualityNotes: [],
        datasetExpansionRecommendations: [],
        researchFindingsArtifact: 'research.json',
        sameSubsetComparisonArtifact: 'comparison.json',
      },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
    };
    const prismaMock = {
      reviewedReportSnapshot: { findFirst: jest.fn().mockResolvedValue(reviewedSnapshot) },
      documentJob: { findMany: jest.fn().mockResolvedValue([]) },
      analysisReviewDecision: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const traceabilityRepo = { listByAnalysis: jest.fn().mockResolvedValue([]) };
    const insightRepo = { listByAnalysis: jest.fn().mockResolvedValue([]) };
    const evalContextAdapter = { getEvaluationContext: jest.fn().mockReturnValue({ datasetVersion: 'live-eval' }) };
    const service = new ApprovedReportProjectionService(
      prismaMock as any,
      traceabilityRepo as any,
      insightRepo as any,
      evalContextAdapter as any,
    );

    const result = await service.project({
      id: 'doc-1',
      content: '# Mutable generated document',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-03T12:00:00.000Z'),
      impactAnalysis: {
        id: 'analysis-1',
        updatedAt: new Date('2026-06-03T12:00:00.000Z'),
        snapshot: { id: 'repository-snapshot', repositoryId: 'repo-1', commitSha: 'abc1234', analyzerVersion: '1.0' },
        sourceTarget: { requestedRef: 'main', resolvedRefType: 'COMMIT', latestObservedCommitSha: 'abc1234' },
        requirementRevision: { title: 'Refund report', requirement: { projectId: 'project-1' } },
      },
    });

    expect(result.report.content).toBe('# Frozen report');
    expect(result.evidenceQualityItems).toEqual(reviewedSnapshot.reviewDecisionsSnapshot);
    expect(result.evidenceQualitySummary).toEqual(reviewedSnapshot.evidenceQualitySummarySnapshot);
    expect(result.evaluationContext).toEqual(reviewedSnapshot.evaluationContextSnapshot);
  });

  it('rejects an approved document shared by multiple snapshots when the latest snapshot has no frozen markdown', async () => {
    const prismaMock = {
      reviewedReportSnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'reviewed-current',
          approvedDocumentId: 'doc-1',
          markdown: null,
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
        }),
      },
      documentJob: {
        findMany: jest.fn().mockResolvedValue([
          { snapshotId: 'reviewed-older' },
          { snapshotId: 'reviewed-current' },
        ]),
      },
    };
    const service = new ApprovedReportProjectionService(
      prismaMock as any,
      { listByAnalysis: jest.fn().mockResolvedValue([]) } as any,
      { listByAnalysis: jest.fn().mockResolvedValue([]) } as any,
      { getEvaluationContext: jest.fn().mockReturnValue(null) } as any,
    );

    await expect(service.project({ id: 'doc-1', impactAnalysis: { id: 'analysis-1' } })).rejects.toMatchObject({
      code: 'REPORT_PROVENANCE_MISMATCH',
    });
  });
});
