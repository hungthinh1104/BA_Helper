import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MarkdownReportRenderContext } from '../markdown-impact-report.types';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { ReviewNoteRepository } from '../../../impact-analysis/infrastructure/review-note.repository';
import { GraphRepository } from '../../../graph/infrastructure/graph.repository';
import { ClarificationRepository } from '../../../clarification/infrastructure/clarification.repository';
import { ReviewDecisionRepository } from '../../../impact-analysis/infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../../../impact-analysis/application/queries/get-impact-diff.usecase';

@Injectable()
export class ReviewedSnapshotReportContextAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly graphRepo: GraphRepository,
    private readonly clarificationRepo: ClarificationRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
  ) {}

  async buildContext(snapshot: any, analysis: any): Promise<MarkdownReportRenderContext> {
    const analysisId = analysis.id;
    
    // 1. Fetch live elements
    const insights = await this.insightRepo.listByAnalysis(analysisId);
    let traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysisId);
    let reviewNotes = await this.reviewNoteRepo.findByAnalysisId(analysisId);
    const dependencyEdges = await this.graphRepo.listBySnapshot(analysis.snapshot.id);
    const clarifications = await this.clarificationRepo.listByAnalysisId(analysisId);
    let reviewDecisions = await this.decisionRepo.listByAnalysisId(analysisId);

    // 2. Snapshot overrides and point-in-time filtering
    const snapshotDate = new Date(snapshot.createdAt);

    // Filter global review decisions and notes to only those that existed AT snapshot time
    reviewDecisions = reviewDecisions.filter(d => new Date(d.createdAt) <= snapshotDate);
    reviewNotes = reviewNotes.filter(n => new Date(n.createdAt) <= snapshotDate);

    // Retrieve snapshot payload
    const reviewDecisionsSnapshot = snapshot.reviewDecisionsSnapshot as any[];
    const evidenceQualitySummarySnapshot = snapshot.evidenceQualitySummarySnapshot as any;

    // Overwrite traceability links with snapshot state
    if (reviewDecisionsSnapshot && Array.isArray(reviewDecisionsSnapshot)) {
      for (const link of traceabilityLinks) {
        const snapItem = reviewDecisionsSnapshot.find(x => x.linkId === link.id);
        if (snapItem) {
          // Reconstruct the link's reviewDecision to match snapshot exactly
          link.reviewDecision = snapItem.reviewDecision;
          // Status mapping based on decision
          if (snapItem.reviewDecision) {
            link.reviewStatus = snapItem.reviewDecision.decision === 'ACCEPTED' ? 'CONFIRMED' : 
                                snapItem.reviewDecision.decision === 'REJECTED' ? 'REJECTED' : 'NEEDS_REVIEW';
          } else {
            link.reviewStatus = 'NEEDS_REVIEW';
          }
        }
      }
    }

    // Determine hasUnreviewedItems from the insights (live metadata)
    const hasUnreviewed = insights.some(
      (insight: { reviewStatus: string }) => insight.reviewStatus === 'NEEDS_REVIEW',
    );

    let diff: any = undefined;
    if (analysis.derivedFromAnalysisId) {
      const diffResult = await this.getDiffUseCase.computeForAnalysis(analysisId);
      if (diffResult.computable) {
        diff = diffResult.diff;
      }
    }

    return {
      analysis,
      insights,
      traceabilityLinks: traceabilityLinks as any[],
      reviewNotes,
      hasUnreviewedItems: !!hasUnreviewed,
      dependencyEdges: dependencyEdges as any[],
      clarifications: clarifications as any[],
      reviewDecisions,
      reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot,
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
        generatedDocumentId: 'pending',
        generatedAt: new Date().toISOString(),
        finalizedAt: analysis.updatedAt.toISOString(),
        staleStatusAtReadTime: false, // Snapshot is never stale at read time
      },
    };
  }
}
