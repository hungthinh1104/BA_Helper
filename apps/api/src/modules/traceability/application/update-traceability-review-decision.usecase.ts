import { AppError } from '@ba-helper/shared';
import { ReviewPolicy } from '../../review/domain/review.policy';
import type { PrismaService, TraceabilityRepository, EventLogService } from "@ba-helper/backend-runtime";

export class UpdateTraceabilityReviewDecisionUseCase {
  constructor(
    private readonly repository: TraceabilityRepository,
    private readonly eventLog: EventLogService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: {
    linkId: string;
    decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_REVIEW' | 'NEEDS_MORE_EVIDENCE';
    note?: string | null;
    reviewedByUserId?: string | null;
  }) {
    const link = await this.repository.findById(params.linkId);
    if (!link) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }

    const analysis = link.impactAnalysis;
    ReviewPolicy.assertCanReview(analysis);

    return this.prisma.$transaction(async (transaction) => {
      const result = await this.repository.upsertReviewDecision({
        linkId: params.linkId,
        analysisId: analysis.id,
        decision: params.decision,
        note: params.note,
        reviewedByUserId: params.reviewedByUserId,
      }, transaction);
      if (!result) {
        throw new AppError(
          'INVALID_STATE_TRANSITION',
          'Analysis was finalized before the review decision could be saved.',
        );
      }

      await this.eventLog.recordEvent({
        eventType: 'TRACEABILITY_REVIEW_DECISION_UPDATED',
        idempotencyKey: `traceability:${result.id}:review-decision:update:${Date.now()}`,
        payload: {
          linkId: params.linkId,
          analysisId: analysis.id,
          decision: result.decision,
        },
      }, transaction);
      return result;
    });
  }
}
