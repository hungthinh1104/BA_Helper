"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalizeImpactAnalysisUseCase = void 0;
const app_error_1 = require("../../../shared/app-error");
class FinalizeImpactAnalysisUseCase {
    constructor(impactRepo, documentRepo, eventLog) {
        this.impactRepo = impactRepo;
        this.documentRepo = documentRepo;
        this.eventLog = eventLog;
    }
    async execute(params) {
        const analysis = await this.impactRepo.findById(params.analysisId);
        if (!analysis) {
            throw new app_error_1.AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
        }
        const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
        const isStale = !isPinnedCommit &&
            analysis.sourceTarget.latestObservedCommitSha !==
                analysis.snapshot.commitSha;
        if (isStale) {
            throw new app_error_1.AppError('ANALYSIS_STALE', 'Analysis is stale.');
        }
        if (analysis.status !== 'WAITING_FOR_REVIEW') {
            throw new app_error_1.AppError('ANALYSIS_STALE', 'Analysis is not ready for finalization.');
        }
        const hasUnreviewed = analysis.insights?.some((insight) => insight.reviewStatus === 'NEEDS_REVIEW');
        if (hasUnreviewed && !params.acknowledgeUnreviewed) {
            throw new app_error_1.AppError('FINALIZE_REQUIRES_REVIEW_ACK', 'Unreviewed insights require acknowledgement before finalization.');
        }
        const finalizeResult = await this.impactRepo.finalizeIfCurrent({
            analysisId: analysis.id,
            status: 'COMPLETED',
            stage: 'DONE',
            progress: 100,
            expectedCommitSha: analysis.snapshot.commitSha,
            expectedTargetCommitSha: analysis.sourceTarget.latestObservedCommitSha,
            expectedResolvedRefType: analysis.sourceTarget.resolvedRefType,
        });
        if (finalizeResult.count === 0) {
            throw new app_error_1.AppError('ANALYSIS_STALE', 'Analysis became stale during finalization.');
        }
        const updated = await this.impactRepo.findById(analysis.id);
        if (!updated) {
            throw new app_error_1.AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found after finalization.');
        }
        const markdown = this.generateMarkdownReport(updated);
        await this.documentRepo.upsertApproved({
            impactAnalysisId: analysis.id,
            content: markdown,
        });
        await this.eventLog.recordEvent({
            eventType: 'IMPACT_ANALYSIS_FINALIZED',
            idempotencyKey: `impact:${analysis.id}:finalized`,
            payload: { impactAnalysisId: analysis.id },
        });
        return updated;
    }
    generateMarkdownReport(analysis) {
        const lines = [];
        lines.push(`# Impact Report: ${analysis.requirementRevision.title}`);
        lines.push('');
        lines.push('## Overview');
        lines.push(analysis.requirementRevision.rawText);
        lines.push('');
        if (analysis.insights && analysis.insights.length > 0) {
            lines.push('## Insights');
            lines.push('');
            for (const insight of analysis.insights) {
                lines.push(`### [${insight.category}] ${insight.title}`);
                if (insight.description && insight.description !== insight.title) {
                    lines.push(`**Description**: ${insight.description}`);
                }
                lines.push(`- **Certainty**: ${insight.certainty}`);
                lines.push(`- **Review Status**: ${insight.reviewStatus}`);
                if (insight.reasoning) {
                    lines.push(`- **Reasoning**: ${insight.reasoning}`);
                }
                lines.push('');
            }
        }
        return lines.join('\n');
    }
}
exports.FinalizeImpactAnalysisUseCase = FinalizeImpactAnalysisUseCase;
