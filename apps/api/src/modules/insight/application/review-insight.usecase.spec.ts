import { ReviewInsightUseCase } from './review-insight.usecase';
import { InsightRepository } from '../infrastructure/insight.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

describe('ReviewInsightUseCase', () => {
  let useCase: ReviewInsightUseCase;
  let repository: jest.Mocked<InsightRepository>;
  let eventLog: jest.Mocked<EventLogService>;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      updateReviewStatusIfCurrent: jest.fn(),
    } as unknown as jest.Mocked<InsightRepository>;

    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    useCase = new ReviewInsightUseCase(repository, eventLog);
  });

  const validParams = {
    insightId: 'insight-1',
    reviewStatus: 'CONFIRMED' as const,
  };

  const mockValidState = (overrides = {}) => {
    repository.findById.mockResolvedValue({
      id: 'insight-1',
      reviewStatus: 'NEEDS_REVIEW',
      impactAnalysis: {
        status: 'WAITING_FOR_REVIEW',
        snapshot: { commitSha: 'abc1234' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'abc1234',
        },
      },
      ...overrides,
    } as any);
  };

  it('UC06-A: Review current waiting analysis successfully updates DB and emits event', async () => {
    mockValidState();
    repository.updateReviewStatusIfCurrent.mockResolvedValue({ count: 1 } as any);
    
    // the second call to findById returns the updated insight
    repository.findById
      .mockResolvedValueOnce({
        id: 'insight-1',
        reviewStatus: 'NEEDS_REVIEW',
        impactAnalysis: {
          status: 'WAITING_FOR_REVIEW',
          snapshot: { commitSha: 'abc1234' },
          sourceTarget: {
            resolvedRefType: 'BRANCH',
            latestObservedCommitSha: 'abc1234',
          },
        },
      } as any)
      .mockResolvedValueOnce({
        id: 'insight-1',
        reviewStatus: 'CONFIRMED',
      } as any);

    const result = await useCase.execute(validParams);

    expect(result.reviewStatus).toBe('CONFIRMED');
    expect(repository.updateReviewStatusIfCurrent).toHaveBeenCalledWith({
      insightId: 'insight-1',
      reviewStatus: 'CONFIRMED',
      expectedCommitSha: 'abc1234',
      expectedTargetCommitSha: 'abc1234',
      expectedResolvedRefType: 'BRANCH',
    });
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'INSIGHT_REVIEWED' }),
    );
  });

  it('UC06-B: Review stale analysis is rejected', async () => {
    mockValidState({
      impactAnalysis: {
        status: 'WAITING_FOR_REVIEW',
        snapshot: { commitSha: 'abc1234' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'newer-commit',
        },
      },
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REVIEW_NOT_ALLOWED',
    });
    expect(repository.updateReviewStatusIfCurrent).not.toHaveBeenCalled();
  });

  it('UC06-B: Review completed analysis is rejected', async () => {
    mockValidState({
      impactAnalysis: {
        status: 'COMPLETED',
        snapshot: { commitSha: 'abc1234' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'abc1234',
        },
      },
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REVIEW_NOT_ALLOWED',
    });
    expect(repository.updateReviewStatusIfCurrent).not.toHaveBeenCalled();
  });

  it('UC06-C: Retry same decision on current analysis returns early (idempotency)', async () => {
    mockValidState({ reviewStatus: 'CONFIRMED' });

    const result = await useCase.execute(validParams);

    expect(result.reviewStatus).toBe('CONFIRMED');
    expect(repository.updateReviewStatusIfCurrent).not.toHaveBeenCalled();
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });

  it('UC06-C on stale analysis: Retry same decision is rejected because stale analysis must not bypass guard', async () => {
    mockValidState({
      reviewStatus: 'CONFIRMED',
      impactAnalysis: {
        status: 'COMPLETED',
        snapshot: { commitSha: 'abc1234' },
        sourceTarget: {
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'abc1234',
        },
      },
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REVIEW_NOT_ALLOWED',
    });
    expect(repository.updateReviewStatusIfCurrent).not.toHaveBeenCalled();
    expect(eventLog.recordEvent).not.toHaveBeenCalled();
  });

  it('rejects if insight becomes stale during update', async () => {
    mockValidState();
    repository.updateReviewStatusIfCurrent.mockResolvedValue({ count: 0 } as any);

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REVIEW_NOT_ALLOWED',
      message: 'Review became stale during update.',
    });
  });
});
