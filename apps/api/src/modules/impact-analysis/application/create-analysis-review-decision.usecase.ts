import { Injectable } from '@nestjs/common';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { ReviewDecisionRepository } from '../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from './get-impact-diff.usecase';
import { DocumentRepository } from '../../document/infrastructure/document.repository';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { ReviewNoteRepository } from '../infrastructure/review-note.repository';
import { ClarificationRepository } from '../../clarification/infrastructure/clarification.repository';
import { MarkdownImpactReportBuilder } from '../../document/application/markdown-impact-report.builder';
import { AppError } from '../../../shared/app-error';
import { AnalysisReviewDecisionValue } from '@prisma/client';
import { RequestUser } from '@ba-helper/contracts';

@Injectable()
export class CreateAnalysisReviewDecisionUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly graphRepo: GraphRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly clarificationRepo: ClarificationRepository,
    private readonly documentRepo: DocumentRepository,
    private readonly reportBuilder: MarkdownImpactReportBuilder,
  ) {}

  async execute(params: {
    analysisId: string;
    decision: AnalysisReviewDecisionValue;
    note?: string;
    actor: RequestUser;
  }) {
    const analysis = await this.impactRepo.findById(params.analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    if (analysis.status !== 'COMPLETED') {
      throw new AppError(
        'INVALID_ANALYSIS_STATUS',
        'Only completed (finalized) analyses can be reviewed.'
      );
    }

    // If derived and accepted, diff must be computable
    if (analysis.derivedFromAnalysisId && params.decision === 'ACCEPTED') {
      const diffResult = await this.getDiffUseCase.computeForAnalysis(params.analysisId);
      if (!diffResult.computable) {
        throw new AppError(
          diffResult.reason || 'INTERNAL_DIFF_ERROR',
          `Cannot accept derived analysis because diff is not computable: ${diffResult.reason}`
        );
      }
    }

    // Step 1: Save immutable decision
    const decision = await this.decisionRepo.create({
      analysisId: params.analysisId,
      decision: params.decision,
      note: params.note,
      reviewedByUserId: params.actor.id,
    });

    // Step 2: Regenerate report outside database transaction
    const regenResult = await this.regenerateReport(params.analysisId);

    return {
      decision,
      reportRegenerated: regenResult.success,
      reportRegenerationError: regenResult.error,
    };
  }

  private async regenerateReport(analysisId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const analysis = await this.impactRepo.findById(analysisId);
      if (!analysis) {
        return { success: false, error: 'Analysis not found' };
      }

      const insights = await this.insightRepo.listByAnalysis(analysisId);
      const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysisId);
      const reviewNotes = await this.reviewNoteRepo.findByAnalysisId(analysisId);
      const dependencyEdges = await this.graphRepo.listBySnapshot(analysis.snapshot.id);
      const clarifications = await this.clarificationRepo.listByAnalysisId(analysisId);
      const reviewDecisions = await this.decisionRepo.listByAnalysisId(analysisId);

      let diff: any = undefined;
      if (analysis.derivedFromAnalysisId) {
        const diffResult = await this.getDiffUseCase.computeForAnalysis(analysisId);
        if (diffResult.computable) {
          diff = diffResult.diff;
        }
      }

      const hasUnreviewed = analysis.insights?.some(
        (insight: { reviewStatus: string }) =>
          insight.reviewStatus === 'NEEDS_REVIEW',
      );

      const persistedReport = await this.documentRepo.upsertApproved({
        impactAnalysisId: analysisId,
        content: '# Pending approved report regeneration',
      });

      const markdown = this.reportBuilder.build({
        analysis: analysis as any,
        insights,
        traceabilityLinks: traceabilityLinks as any[],
        reviewNotes,
        hasUnreviewedItems: !!hasUnreviewed,
        dependencyEdges: dependencyEdges as any[],
        clarifications: clarifications as any[],
        reviewDecisions,
        diff,
        metadata: {
          analysisId: analysis.id,
          title: analysis.requirementRevision.title,
          projectId: analysis.snapshot.repository.projectId,
          repositoryId: analysis.snapshot.repositoryId,
          targetRef: analysis.sourceTarget.requestedRef,
          commitSha: analysis.snapshot.commitSha,
          snapshotId: analysis.snapshot.id,
          analyzerVersion: analysis.snapshot.analyzerVersion,
          generatedDocumentId: persistedReport.id,
          generatedAt: persistedReport.createdAt.toISOString(),
          finalizedAt: persistedReport.updatedAt.toISOString(),
          staleStatusAtReadTime: false,
        },
      });

      await this.documentRepo.upsertApproved({
        impactAnalysisId: analysisId,
        content: markdown,
      });

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || String(e) };
    }
  }
}
