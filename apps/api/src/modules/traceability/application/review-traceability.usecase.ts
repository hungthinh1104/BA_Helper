import { AppError } from '@ba-helper/shared';

import { ReviewPolicy } from '../../review/domain/review.policy';
import type { PrismaService, TraceabilityRepository, EventLogService } from "@ba-helper/backend-runtime";

export class ReviewTraceabilityUseCase {
  constructor(
    private readonly repository: TraceabilityRepository,
    private readonly eventLog: EventLogService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: {
    linkId: string;
    reviewStatus: 'CONFIRMED' | 'REJECTED';
  }) {
    const link = await this.repository.findById(params.linkId);
    if (!link) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }

    const analysis = link.impactAnalysis;
    ReviewPolicy.assertCanReview(analysis);

    if (link.reviewStatus === params.reviewStatus) {
      return link;
    }

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await this.repository.updateReviewStatusIfCurrent({
        linkId: params.linkId,
        reviewStatus: params.reviewStatus,
        expectedCommitSha: analysis.snapshot.commitSha,
        expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
        expectedResolvedRefType: analysis.sourceTarget.resolvedRefType,
      }, transaction);
      if (updateResult.count === 0) {
        throw new AppError('REVIEW_NOT_ALLOWED', 'Review became stale during update.');
      }

      const updated = await this.repository.findById(params.linkId, transaction);
      if (!updated) {
        throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
      }
      await this.eventLog.recordEvent({
        eventType: 'TRACEABILITY_REVIEWED',
        idempotencyKey: `traceability:${updated.id}:review:${updated.reviewStatus}`,
        payload: { linkId: updated.id, reviewStatus: updated.reviewStatus },
      }, transaction);
      return updated;
    });
  }
}
