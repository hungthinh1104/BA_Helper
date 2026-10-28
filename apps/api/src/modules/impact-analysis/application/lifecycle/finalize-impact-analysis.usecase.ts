import { Injectable } from "@nestjs/common";
import { AppError } from '@ba-helper/shared';

import { ReviewPolicy } from '../../../review/domain/review.policy';
import { CreateReviewedReportSnapshotUseCase } from '../../../document/application/commands/create-reviewed-report-snapshot.usecase';
import { EnqueueDocumentJobUseCase } from '../../../document/application/commands/enqueue-document-job.usecase';
import { buildEvidenceQualityProjection } from '../../../document/application/evidence-quality.projection';
import {
  buildReportApprovalGateItems,
  ReportApprovalGatePolicy,
} from '../../../document/application/report-approval-gate.policy';
import {
  PrismaService,
  ImpactAnalysisRepository,
  TraceabilityRepository,
  InsightRepository,
  lockReviewAnalysisState,
} from '@ba-helper/backend-runtime';

@Injectable()
export class FinalizeImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly insightRepo: InsightRepository,
    private readonly prisma: PrismaService,
    private readonly createSnapshot: CreateReviewedReportSnapshotUseCase,
    private readonly enqueueJob: EnqueueDocumentJobUseCase,
  ) {}

  async execute(params: { analysisId: string; acknowledgeUnreviewed: boolean; userId: string }) {
    await this.assertFinalizableState(params.analysisId, params.acknowledgeUnreviewed);

    const { documentJob } = await this.prisma.$transaction(async (tx) => {
      const lockState = await lockReviewAnalysisState(tx, params.analysisId);
      if (lockState === 'MISSING') {
        throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
      }
      if (lockState === 'NOT_REVIEWABLE') {
        throw new AppError(
          'INVALID_STATE_TRANSITION',
          'Impact analysis is no longer waiting for review.',
        );
      }
      if (lockState === 'STALE') {
        throw new AppError(
          'ANALYSIS_STALE',
          'Cannot finalize because the underlying repository state has changed.',
        );
      }

      const analysis = await this.assertFinalizableState(
        params.analysisId,
        params.acknowledgeUnreviewed,
      );
      const snapshotData = await this.createSnapshot.buildSnapshotCreateData({
        analysisId: analysis.id,
        createdByUserId: params.userId,
      });
      const finalizeResult = await tx.impactAnalysis.updateMany({
        where: {
          id: analysis.id,
          // Compare-and-set: a competing finalize must not transition COMPLETED -> COMPLETED.
          // PostgreSQL re-evaluates this predicate after waiting on the row lock.
          status: 'WAITING_FOR_REVIEW',
          snapshot: {
            commitSha: analysis.snapshot.commitSha,
          },
          sourceTarget: {
            resolvedRefType: analysis.sourceTarget.resolvedRefType,
            ...(analysis.sourceTarget.resolvedRefType === 'COMMIT'
              ? {}
              : { latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha }),
          },
        },
        data: {
          status: 'COMPLETED',
          stage: 'DONE',
          progress: 100,
        },
      });

      if (finalizeResult.count === 0) {
        const currentAnalysis = await tx.impactAnalysis.findUnique({
          where: { id: analysis.id },
          select: { status: true },
        });
        if (!currentAnalysis) {
          throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
        }
        if (currentAnalysis.status !== 'WAITING_FOR_REVIEW') {
          throw new AppError(
            'INVALID_STATE_TRANSITION',
            'Impact analysis is no longer waiting for review.',
          );
        }
        throw new AppError(
          'ANALYSIS_STALE',
          'Analysis became stale during finalization.',
        );
      }

      const snapshot = await tx.reviewedReportSnapshot.create({
        data: snapshotData,
      });
      await this.createSnapshot.recordCreatedEvent(snapshot, tx);

      const { job } = await this.enqueueJob.createOrReuseQueuedJobForSnapshot(tx, {
        analysisId: analysis.id,
        snapshotId: snapshot.id,
        documentType: 'IMPACT_REPORT',
      });

      return { documentJob: job };
    });

    try {
      await this.enqueueJob.enqueueExistingJob(documentJob.id);
    } catch (error) {
      await this.prisma.documentJob.update({
        where: { id: documentJob.id },
        data: {
          error: {
            stage: 'QUEUE_ENQUEUE',
            message: error instanceof Error ? error.message : String(error),
          },
        },
      });
    }

    const finalizedAnalysis = await this.impactRepo.findById(params.analysisId);
    return finalizedAnalysis!;
  }

  private async assertFinalizableState(analysisId: string, acknowledgeUnreviewed: boolean) {
    const analysis = await this.impactRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    const [traceabilityLinks, insights] = await Promise.all([
      this.traceabilityRepo.listByAnalysis(analysis.id),
      this.insightRepo.listByAnalysis(analysis.id),
    ]);
    const unreviewedItemsCount =
      insights.filter((insight) => insight.reviewStatus === 'NEEDS_REVIEW').length +
      traceabilityLinks.filter((link) => link.reviewStatus === 'NEEDS_REVIEW').length;

    ReviewPolicy.assertCanFinalize(analysis, 0, true);
    const qualityProjection = buildEvidenceQualityProjection({
      traceabilityLinks,
      insights: insights as any[],
    });
    const gate = ReportApprovalGatePolicy.evaluate(buildReportApprovalGateItems({
      items: qualityProjection.items,
      insights,
      traceabilityLinks,
    }));
    if (!gate.canApprove) {
      throw new AppError(
        'REVIEW_APPROVAL_BLOCKED',
        'Critical review coverage issues must be resolved before approval.',
        {
          blockingReasons: gate.blockingReasons,
          blockingItems: gate.blockingItems,
        },
      );
    }

    ReviewPolicy.assertCanFinalize(analysis, unreviewedItemsCount, acknowledgeUnreviewed);
    return analysis;
  }
}
