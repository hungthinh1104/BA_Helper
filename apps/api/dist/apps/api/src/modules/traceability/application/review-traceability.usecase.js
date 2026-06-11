"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewTraceabilityUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class ReviewTraceabilityUseCase {
    constructor(repository, eventLog) {
        this.repository = repository;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const link = await this.repository.findById(params.linkId);
        if (!link) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
        }
        const analysis = link.impactAnalysis;
        const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
        const isStale = !isPinnedCommit &&
            analysis.sourceTarget.latestObservedCommitSha !==
                analysis.snapshot.commitSha;
        if (analysis.status !== 'WAITING_FOR_REVIEW' || isStale) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Review is not allowed for this analysis state.');
        }
        const updateResult = await this.repository.updateReviewStatusIfCurrent({
            linkId: params.linkId,
            reviewStatus: params.reviewStatus,
            expectedCommitSha: analysis.snapshot.commitSha,
            expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
            expectedResolvedRefType: analysis.sourceTarget.resolvedRefType,
        });
        if (updateResult.count === 0) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Review became stale during update.');
        }
        const updated = await this.repository.findById(params.linkId);
        if (!updated) {
            throw new app_error_1.AppError('REVIEW_NOT_ALLOWED', 'Traceability link not found.');
        }
        await this.eventLog.recordEvent({
            eventType: 'TRACEABILITY_REVIEWED',
            idempotencyKey: `traceability:${updated.id}:review:${updated.reviewStatus}`,
            payload: { linkId: updated.id, reviewStatus: updated.reviewStatus },
        });
        return updated;
    }
}
exports.ReviewTraceabilityUseCase = ReviewTraceabilityUseCase;
