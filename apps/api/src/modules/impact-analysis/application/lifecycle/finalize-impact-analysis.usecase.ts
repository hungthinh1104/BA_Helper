import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";

import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { DocumentRepository } from '../../../document/infrastructure/document.repository';
import { AppError } from '../../../../shared/app-error';

import { ReviewPolicy } from '../../../review/domain/review.policy';
import { MarkdownImpactReportBuilder } from '../../../document/application/markdown-impact-report.builder';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../../../graph/infrastructure/graph.repository';
import { ReviewNoteRepository } from '../../infrastructure/review-note.repository';
import { ReviewDecisionRepository } from '../../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../queries/get-impact-diff.usecase';
import { ClarificationRepository } from '../../../clarification/infrastructure/clarification.repository';
import { PrismaService } from '../../../prisma/prisma.service';

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
    private readonly reportBuilder: MarkdownImpactReportBuilder,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: { analysisId: string; acknowledgeUnreviewed: boolean }) {
    const analysis = await this.impactRepo.findById(params.analysisId);
    if (!analysis) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found.',
      );
    }

    const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysis.id);

    const unreviewedInsightsCount = analysis.insights?.filter(
      (insight: { reviewStatus: string }) => insight.reviewStatus === 'NEEDS_REVIEW'
    ).length || 0;

    const unreviewedTraceabilityLinksCount = traceabilityLinks.filter(
      (link: { reviewStatus: string }) => link.reviewStatus === 'NEEDS_REVIEW'
    ).length;

    const unreviewedItemsCount = unreviewedInsightsCount + unreviewedTraceabilityLinksCount;
    const hasUnreviewed = unreviewedItemsCount > 0;

    ReviewPolicy.assertCanFinalize(
      analysis,
      unreviewedItemsCount,
      params.acknowledgeUnreviewed
    );

    const insights = await this.insightRepo.listByAnalysis(analysis.id);
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

    const existingReport = await this.documentRepo.findApprovedReportByAnalysisId(analysis.id);
    const generatedDocumentId = existingReport ? existingReport.id : randomUUID();
    const generatedAt = existingReport ? existingReport.createdAt.toISOString() : new Date().toISOString();
    const finalizedAt = new Date().toISOString();

    const markdown = this.reportBuilder.build({
      analysis: analysis as any,
      insights,
      traceabilityLinks: traceabilityLinks as any[],
      reviewNotes,
      hasUnreviewedItems: hasUnreviewed,
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
        generatedDocumentId,
        generatedAt,
        finalizedAt,
        staleStatusAtReadTime: false,
      },
    });

    await this.prisma.$transaction(async (tx) => {
      const finalizeResult = await tx.impactAnalysis.updateMany({
        where: {
          id: analysis.id,
          snapshot: {
            commitSha: analysis.snapshot.commitSha,
          },
          sourceTarget: {
            resolvedRefType: analysis.sourceTarget.resolvedRefType,
            latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
          },
        },
        data: {
          status: 'COMPLETED',
          stage: 'DONE',
          progress: 100,
        },
      });

      if (finalizeResult.count === 0) {
        throw new AppError(
          'ANALYSIS_STALE',
          'Analysis became stale during finalization.',
        );
      }

      await tx.generatedDocument.upsert({
        where: {
          impactAnalysisId_type_status: {
            impactAnalysisId: analysis.id,
            type: 'IMPACT_REPORT',
            status: 'APPROVED',
          },
        },
        update: {
          content: markdown,
        },
        create: {
          id: generatedDocumentId,
          impactAnalysisId: analysis.id,
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
          content: markdown,
        },
      });

      await tx.domainEvent.upsert({
        where: {
          idempotencyKey: `impact:${analysis.id}:finalized`,
        },
        update: {},
        create: {
          eventType: 'IMPACT_ANALYSIS_FINALIZED',
          idempotencyKey: `impact:${analysis.id}:finalized`,
          payload: {
            impactAnalysisId: analysis.id,
            actorUserId: 'SYSTEM',
          } as any,
        },
      });
    });

    const updated = (await this.impactRepo.findById(analysis.id)) as any;
    if (!updated) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found after finalization.',
      );
    }

    return updated;
  }
}
