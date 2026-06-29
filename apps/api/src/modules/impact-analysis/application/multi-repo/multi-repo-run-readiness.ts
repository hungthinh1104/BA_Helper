export type ChildReviewDecision =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'NEEDS_MORE_CLARIFICATION'
  | null;
export type ChildStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_FOR_REVIEW'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export function deriveMultiRepoRunAggregates(
  items: Array<{
    status: ChildStatus;
    latestReviewDecision: ChildReviewDecision;
    isStale?: boolean;
  }>,
) {
  const childReviewSummary = items.reduce(
    (summary, item) => {
      if (item.latestReviewDecision === 'ACCEPTED') {
        summary.accepted += 1;
      } else if (item.latestReviewDecision === 'REJECTED') {
        summary.rejected += 1;
      } else if (item.latestReviewDecision === 'NEEDS_MORE_CLARIFICATION') {
        summary.needsMoreClarification += 1;
      } else {
        summary.pendingReview += 1;
      }
      return summary;
    },
    {
      accepted: 0,
      rejected: 0,
      needsMoreClarification: 0,
      pendingReview: 0,
    },
  );

  const totalAnalyses = items.length;
  const completedAnalyses = items.filter((item) => item.status === 'COMPLETED').length;
  const failedAnalyses = items.filter((item) => item.status === 'FAILED').length;
  const waitingForReviewAnalyses = items.filter(
    (item) => item.status === 'WAITING_FOR_REVIEW',
  ).length;

  return {
    runReadiness: {
      totalAnalyses,
      completedAnalyses,
      failedAnalyses,
      waitingForReviewAnalyses,
      allCompleted: totalAnalyses > 0 && completedAnalyses === totalAnalyses,
      hasFailures: failedAnalyses > 0,
      canStartMergedReport:
        totalAnalyses > 0 &&
        items.every(
          (item) =>
            item.status === 'COMPLETED' &&
            item.latestReviewDecision === 'ACCEPTED' &&
            item.isStale !== true,
        ),
    },
    childReviewSummary,
  };
}
