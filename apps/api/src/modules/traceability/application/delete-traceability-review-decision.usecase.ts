import { TraceabilityRepository } from '../infrastructure/traceability.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '@ba-helper/shared';
import { ReviewPolicy } from '../../review/domain/review.policy';

export class DeleteTraceabilityReviewDecisionUseCase {
  constructor(
    private readonly repository: TraceabilityRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { linkId: string }) {
    const link = await this.repository.findById(params.linkId);
    if (!link) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
    }

    const analysis = link.impactAnalysis;
    ReviewPolicy.assertCanReview(analysis);

    try {
      await this.repository.deleteReviewDecision(params.linkId);

      await this.eventLog.recordEvent({
        eventType: 'TRACEABILITY_REVIEW_DECISION_DELETED',
        idempotencyKey: `traceability:${params.linkId}:review-decision:delete:${Date.now()}`,
        payload: {
          linkId: params.linkId,
          analysisId: analysis.id,
        },
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
