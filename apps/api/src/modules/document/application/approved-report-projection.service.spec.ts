import { ApprovedReportProjectionService } from './approved-report-projection.service';

describe('ApprovedReportProjectionService', () => {
  it('returns false for isStale when target is pinned commit and no review decisions', async () => {
    const mockTraceabilityRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    };
    const mockEvalContextAdapter = {
      getEvaluationContext: jest.fn().mockReturnValue(null),
    };
    const service = new ApprovedReportProjectionService(
      {
        analysisReviewDecision: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any,
      mockTraceabilityRepo as any,
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
});
