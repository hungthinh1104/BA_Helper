import { Injectable } from "@nestjs/common";

import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { DocumentRepository } from '../../document/infrastructure/document.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

import { ReviewPolicy } from '../../review/domain/review.policy';
import { MarkdownImpactReportBuilder } from '../../document/application/markdown-impact-report.builder';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { ReviewNoteRepository } from '../infrastructure/review-note.repository';
import { ReviewDecisionRepository } from '../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from './get-impact-diff.usecase';
import { ClarificationRepository } from '../../clarification/infrastructure/clarification.repository';

@Injectable()
export class FinalizeImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly graphRepo: GraphRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly clarificationRepo: ClarificationRepository,
    private readonly documentRepo: DocumentRepository,
    private readonly eventLog: EventLogService,
    private readonly reportBuilder: MarkdownImpactReportBuilder,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
  ) {}

  async execute(params: { analysisId: string; acknowledgeUnreviewed: boolean }) {
    const analysis = await this.impactRepo.findById(params.analysisId);
    if (!analysis) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found.',
      );
    }

    const hasUnreviewed = analysis.insights?.some(
      (insight: { reviewStatus: string }) =>
        insight.reviewStatus === 'NEEDS_REVIEW',
    );

    let unreviewedItemsCount = 0;
    if (hasUnreviewed) unreviewedItemsCount++;

    ReviewPolicy.assertCanFinalize(
      analysis,
      unreviewedItemsCount,
      params.acknowledgeUnreviewed
    );

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

    const updated = (await this.impactRepo.findById(analysis.id)) as any;
    if (!updated) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found after finalization.',
      );
    }

    const insights = await this.insightRepo.listByAnalysis(analysis.id);
    const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysis.id);
    const reviewNotes = await this.reviewNoteRepo.findByAnalysisId(analysis.id);
    const dependencyEdges = await this.graphRepo.listBySnapshot(analysis.snapshot.id);
    const clarifications = await this.clarificationRepo.listByAnalysisId(analysis.id);
    const reviewDecisions = await this.decisionRepo.listByAnalysisId(analysis.id);

    let diff: any = undefined;
    if (analysis.derivedFromAnalysisId) {
      const diffResult = await this.getDiffUseCase.computeForAnalysis(analysis.id);
      if (diffResult.computable) {
        diff = diffResult.diff;
      }
    }

    const markdown = this.reportBuilder.build({
      analysis: updated,
      insights,
      traceabilityLinks: traceabilityLinks as any[],
      reviewNotes,
      hasUnreviewedItems: hasUnreviewed,
      dependencyEdges: dependencyEdges as any[],
      clarifications: clarifications as any[],
      reviewDecisions,
      diff,
    });

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
}
