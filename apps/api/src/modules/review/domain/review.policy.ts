import { AppError } from '@ba-helper/shared';

export const ReviewPolicy = {
  assertCanReview: (analysis: {
    status: string;
    snapshot: { commitSha: string };
    sourceTarget: {
      resolvedRefType: string;
      latestObservedCommitSha: string;
    };
  }) => {
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale =
      !isPinnedCommit &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    if (analysis.status === 'COMPLETED' || analysis.status === 'CANCELLED') {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Review is not allowed after analysis is finalized or cancelled.',
      );
    }

    if (analysis.status !== 'WAITING_FOR_REVIEW' || isStale) {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Review is not allowed for this analysis state.',
      );
    }
  },

  assertCanFinalize: (
    analysis: {
      status: string;
      snapshot: { commitSha: string };
      sourceTarget: {
        resolvedRefType: string;
        latestObservedCommitSha: string;
      };
    },
    unreviewedItemsCount: number,
    acknowledgeUnreviewed: boolean,
  ) => {
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale =
      !isPinnedCommit &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    if (isStale) {
      throw new AppError(
        'ANALYSIS_STALE',
        'Cannot finalize because the underlying repository state has changed.',
      );
    }

    if (analysis.status !== 'WAITING_FOR_REVIEW') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        `Cannot finalize analysis in ${analysis.status} state.`,
      );
    }

    if (unreviewedItemsCount > 0 && !acknowledgeUnreviewed) {
      throw new AppError(
        'FINALIZE_REQUIRES_REVIEW_ACK',
        'There are unreviewed insights or links. You must explicitly acknowledge them to finalize.',
      );
    }
  },
};
