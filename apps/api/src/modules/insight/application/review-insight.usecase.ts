import { AppError } from '@ba-helper/shared';

import { ReviewPolicy } from '../../review/domain/review.policy';
import type { InsightRepository, EventLogService, PrismaService } from "@ba-helper/backend-runtime";

export class ReviewInsightUseCase {
  constructor(
    private readonly repository: InsightRepository,
    private readonly eventLog: EventLogService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: {
    insightId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
  }) {
    const insight = await this.repository.findById(params.insightId);
    if (!insight) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
    }

    const analysis = insight.impactAnalysis;
    ReviewPolicy.assertCanReview(analysis);

    if (insight.reviewStatus === params.reviewStatus) {
      return insight;
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await this.repository.updateReviewStatusIfCurrent({
        insightId: params.insightId,
        reviewStatus: params.reviewStatus,
        expectedCommitSha: analysis.snapshot.commitSha,
        expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
        expectedResolvedRefType: analysis.sourceTarget.resolvedRefType,
      }, transaction);

      if (updateResult.count === 0) {
        const currentInsight = await this.repository.findById(params.insightId, transaction);
        if (
          currentInsight?.impactAnalysis.status === 'COMPLETED' ||
          currentInsight?.impactAnalysis.status === 'CANCELLED'
        ) {
          throw new AppError(
            'INVALID_STATE_TRANSITION',
            'Analysis was finalized before the review decision could be saved.',
          );
        }
        throw new AppError('REVIEW_NOT_ALLOWED', 'Review became stale during update.');
      }

      const updated = await this.repository.findById(params.insightId, transaction);
      if (!updated) {
        throw new AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
      }
      await this.eventLog.recordEvent({
        eventType: 'INSIGHT_REVIEWED',
        idempotencyKey: `insight:${updated.id}:review:${updated.reviewStatus}`,
        payload: { insightId: updated.id, reviewStatus: updated.reviewStatus },
      }, transaction);
      return updated;
    });
  }
}
