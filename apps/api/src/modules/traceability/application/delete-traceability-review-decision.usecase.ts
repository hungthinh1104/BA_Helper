import { AppError } from '@ba-helper/shared';
import { ReviewPolicy } from '../../review/domain/review.policy';
import type { PrismaService, TraceabilityRepository, EventLogService } from "@ba-helper/backend-runtime";

export class DeleteTraceabilityReviewDecisionUseCase {
  constructor(
    private readonly repository: TraceabilityRepository,
    private readonly eventLog: EventLogService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: { linkId: string }) {
    const link = await this.repository.findById(params.linkId);
    if (!link) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }

    const analysis = link.impactAnalysis;
    ReviewPolicy.assertCanReview(analysis);

    try {
      await this.prisma.$transaction(async (transaction) => {
        const deleted = await this.repository.deleteReviewDecision(
          params.linkId,
          analysis.id,
          transaction,
        );
        if (!deleted) {
          throw new AppError(
            'INVALID_STATE_TRANSITION',
            'Analysis was finalized before the review decision could be cleared.',
          );
        }

        await this.eventLog.recordEvent({
          eventType: 'TRACEABILITY_REVIEW_DECISION_DELETED',
          idempotencyKey: `traceability:${params.linkId}:review-decision:delete:${Date.now()}`,
          payload: {
            linkId: params.linkId,
            analysisId: analysis.id,
          },
        }, transaction);
      });
    } catch (error: any) {
      if (error.code === 'P2025') {
        // Record to delete does not exist. Safe to ignore for idempotency.
        return;
      }
      throw error;
    }
  }
}
