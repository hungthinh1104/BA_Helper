import { ReviewInsightUseCase } from '../../apps/api/src/modules/insight/application/review-insight.usecase';
import { ReviewTraceabilityUseCase } from '../../apps/api/src/modules/traceability/application/review-traceability.usecase';

class StubInsightRepo {
  findById = async () => ({
    id: 'insight-1',
    impactAnalysis: {
      status: 'WAITING_FOR_REVIEW',
      sourceTarget: {
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc',
      },
      snapshot: {
        commitSha: 'abc',
      },
    },
  });

  updateReviewStatusIfCurrent = async () => ({ count: 0 });
}

class StubTraceabilityRepo {
  findById = async () => ({
    id: 'link-1',
    impactAnalysis: {
      status: 'WAITING_FOR_REVIEW',
      sourceTarget: {
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc',
      },
      snapshot: {
        commitSha: 'abc',
      },
    },
  });

  updateReviewStatusIfCurrent = async () => ({ count: 0 });
}

class StubEventLog {
  recordEvent = async () => undefined;
}

describe('Review staleness guard', () => {
  it('rejects insight review when target observation changes', async () => {
    const useCase = new ReviewInsightUseCase(
      new StubInsightRepo() as any,
      new StubEventLog() as any,
    );

    await expect(
      useCase.execute({ insightId: 'insight-1', reviewStatus: 'CONFIRMED' }),
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
  });

  it('rejects traceability review when target observation changes', async () => {
    const useCase = new ReviewTraceabilityUseCase(
      new StubTraceabilityRepo() as any,
      new StubEventLog() as any,
    );

    await expect(
      useCase.execute({ linkId: 'link-1', reviewStatus: 'CONFIRMED' }),
    ).rejects.toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });
  });
});
