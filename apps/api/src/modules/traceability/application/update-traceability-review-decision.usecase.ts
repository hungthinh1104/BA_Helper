import { TraceabilityRepository } from '../infrastructure/traceability.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';
import { ReviewPolicy } from '../../review/domain/review.policy';

export class UpdateTraceabilityReviewDecisionUseCase {
  constructor(
    private readonly repository: TraceabilityRepository,
    private readonly eventLog: EventLogService,
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

    const result = await this.repository.upsertReviewDecision({
      linkId: params.linkId,
      analysisId: analysis.id,
      decision: params.decision,
      note: params.note,
      reviewedByUserId: params.reviewedByUserId,
    });

    await this.eventLog.recordEvent({
      eventType: 'TRACEABILITY_REVIEW_DECISION_UPDATED',
      idempotencyKey: `traceability:${result.id}:review-decision:update:${Date.now()}`,
      payload: {
        linkId: params.linkId,
        analysisId: analysis.id,
        decision: result.decision,
      },
    });

    return result;
  }
}
