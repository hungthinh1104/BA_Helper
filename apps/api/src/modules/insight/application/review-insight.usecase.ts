import { InsightRepository } from '../infrastructure/insight.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

export class ReviewInsightUseCase {
  constructor(
    private readonly repository: InsightRepository,
    private readonly eventLog: EventLogService,
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
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale =
      !isPinnedCommit &&
      analysis.sourceTarget.latestObservedCommitSha !==
        analysis.snapshot.commitSha;

    if (analysis.status !== 'WAITING_FOR_REVIEW' || isStale) {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Review is not allowed for this analysis state.',
      );
    }

    if (insight.reviewStatus === params.reviewStatus) {
      return insight;
    }

    const updateResult = await this.repository.updateReviewStatusIfCurrent({
      insightId: params.insightId,
      reviewStatus: params.reviewStatus,
      expectedCommitSha: analysis.snapshot.commitSha,
      expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
      expectedResolvedRefType: analysis.sourceTarget.resolvedRefType,
    });

    if (updateResult.count === 0) {
      throw new AppError(
        'REVIEW_NOT_ALLOWED',
        'Review became stale during update.',
      );
    }

    const updated = await this.repository.findById(params.insightId);
    if (!updated) {
      throw new AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
    }
    await this.eventLog.recordEvent({
      eventType: 'INSIGHT_REVIEWED',
      idempotencyKey: `insight:${updated.id}:review:${updated.reviewStatus}`,
      payload: { insightId: updated.id, reviewStatus: updated.reviewStatus },
    });

    return updated;
  }
}
