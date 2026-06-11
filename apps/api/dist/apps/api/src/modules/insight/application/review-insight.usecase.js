"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewInsightUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class ReviewInsightUseCase {
    constructor(repository, eventLog) {
        this.repository = repository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const insight = await this.repository.findById(params.insightId);
        if (!insight) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
        }
        const analysis = insight.impactAnalysis;
        const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
        const isStale = !isPinnedCommit &&
            analysis.sourceTarget.latestObservedCommitSha !==
                analysis.snapshot.commitSha;
        if (analysis.status !== 'WAITING_FOR_REVIEW' || isStale) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Review is not allowed for this analysis state.');
        }
        const updateResult = await this.repository.updateReviewStatusIfCurrent({
            insightId: params.insightId,
            reviewStatus: params.reviewStatus,
            expectedCommitSha: analysis.snapshot.commitSha,
            expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
            expectedResolvedRefType: analysis.sourceTarget.resolvedRefType,
        });
        if (updateResult.count === 0) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Review became stale during update.');
        }
        const updated = await this.repository.findById(params.insightId);
        if (!updated) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Insight not found.');
        }
        await this.eventLog.recordEvent({
            eventType: 'INSIGHT_REVIEWED',
            idempotencyKey: `insight:${updated.id}:review:${updated.reviewStatus}`,
            payload: { insightId: updated.id, reviewStatus: updated.reviewStatus },
        });
        return updated;
    }
}
exports.ReviewInsightUseCase = ReviewInsightUseCase;
