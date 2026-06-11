import { Injectable } from "@nestjs/common";

import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { DocumentRepository } from '../../document/infrastructure/document.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';



@Injectable()
export class FinalizeImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly documentRepo: DocumentRepository,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { analysisId: string; acknowledgeUnreviewed: boolean }) {
    const analysis = await this.impactRepo.findById(params.analysisId);
    if (!analysis) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found.',
      );
    }

    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale =
      !isPinnedCommit &&
      analysis.sourceTarget.latestObservedCommitSha !==
        analysis.snapshot.commitSha;

    if (isStale) {
      throw new AppError('ANALYSIS_STALE', 'Analysis is stale.');
    }

    if (analysis.status !== 'WAITING_FOR_REVIEW') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Analysis is not ready for finalization.',
      );
    }

    const hasUnreviewed = analysis.insights?.some(
      (insight: { reviewStatus: string }) =>
        insight.reviewStatus === 'NEEDS_REVIEW',
    );

    if (hasUnreviewed && !params.acknowledgeUnreviewed) {
      throw new AppError(
        'FINALIZE_REQUIRES_REVIEW_ACK',
        'Unreviewed insights require acknowledgement before finalization.',
      );
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
      throw new AppError(
        'ANALYSIS_STALE',
        'Analysis became stale during finalization.',
      );
    }

    const updated = await this.impactRepo.findById(analysis.id);
    if (!updated) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found after finalization.',
      );
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

  private generateMarkdownReport(analysis: any): string {
    const lines = [];
    lines.push(`# Impact Report: ${analysis.requirementRevision.title}`);
    lines.push('');
    lines.push('## Overview');
    lines.push(analysis.requirementRevision.rawText);
    lines.push('');
    
    if (analysis.insights && analysis.insights.length > 0) {
      const approvedInsights = analysis.insights.filter(
        (insight: any) => insight.reviewStatus !== 'REJECTED',
      );

      if (approvedInsights.length > 0) {
        lines.push('## Insights');
        lines.push('');
        for (const insight of approvedInsights) {
          lines.push(`### [${insight.insightType}] ${insight.title}`);
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
    }
    
    return lines.join('\n');
  }
}
