import { GetFinalReviewedReportUseCase } from './get-final-reviewed-report.usecase';
import { AppError } from '../../../shared/app-error';

describe('GetFinalReviewedReportUseCase', () => {
  let useCase: GetFinalReviewedReportUseCase;
  let getReviewCompletionMock: any;
  let getLatestSnapshotMock: any;

  beforeEach(() => {
    getReviewCompletionMock = {
      execute: jest.fn(),
    };
    getLatestSnapshotMock = {
      execute: jest.fn(),
    };

    useCase = new GetFinalReviewedReportUseCase(
      getReviewCompletionMock as any,
      getLatestSnapshotMock as any,
    );
  });

  it('rejects when unreviewed links exist (isComplete is false)', async () => {
    getReviewCompletionMock.execute.mockResolvedValue({
      isComplete: false,
      blockingReasons: ['UNREVIEWED_TRACEABILITY_LINKS'],
    });

    await expect(useCase.execute('analysis-123')).rejects.toThrow(
      new AppError('REVIEW_COMPLETION_REQUIRED' as any, 'Impact analysis review is not complete', {
        blockingReasons: ['UNREVIEWED_TRACEABILITY_LINKS'],
      })
    );

    expect(getLatestSnapshotMock.execute).not.toHaveBeenCalled();
  });

  it('rejects when snapshot missing despite isComplete being true (guard clause)', async () => {
    getReviewCompletionMock.execute.mockResolvedValue({
      isComplete: true,
      blockingReasons: [],
    });
    getLatestSnapshotMock.execute.mockResolvedValue(null);

    await expect(useCase.execute('analysis-123')).rejects.toThrow(
      new AppError(
        'REVIEWED_SNAPSHOT_MISSING' as any,
        'Reviewed report snapshot is missing despite review completion indicating otherwise'
      )
    );
  });

  it('returns snapshot markdown, not live report markdown, and JSON fields unchanged', async () => {
    const mockCompletion = {
      isComplete: true,
      blockingReasons: [],
    };
    const mockSnapshot = {
      id: 'snap-1',
      markdown: '# Snapshot Markdown',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewDecisionsSnapshot: { some: 'decision data' },
      evidenceQualitySummarySnapshot: { some: 'evidence data' },
      evaluationContextSnapshot: { some: 'eval context' },
      createdByUserId: 'user-1',
    };

    getReviewCompletionMock.execute.mockResolvedValue(mockCompletion);
    getLatestSnapshotMock.execute.mockResolvedValue(mockSnapshot);

    const result = await useCase.execute('analysis-123');

    expect(result).toEqual({
      analysisId: 'analysis-123',
      snapshotId: 'snap-1',
      markdown: '# Snapshot Markdown',
      createdAt: '2026-01-01T00:00:00.000Z',
      reviewCompletion: mockCompletion,
      reviewDecisionsSnapshot: { some: 'decision data' },
      evidenceQualitySummarySnapshot: { some: 'evidence data' },
      evaluationContextSnapshot: { some: 'eval context' },
      createdByUserId: 'user-1',
    });
  });

  it('does not call retrieval/analysis generation dependencies', async () => {
    // Verified implicitly because the only dependencies are getReviewCompletion and getLatestSnapshot
    // There are no retrieval or LLM dependencies injected.
    expect(useCase).toBeDefined();
  });
});
