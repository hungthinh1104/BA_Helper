import { Injectable } from "@nestjs/common";

import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { AppError } from '../../../../shared/app-error';

import { ReviewPolicy } from '../../../review/domain/review.policy';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { PrismaService } from '../../../prisma/prisma.service';

import { CreateReviewedReportSnapshotUseCase } from '../../../document/application/create-reviewed-report-snapshot.usecase';
import { EnqueueDocumentJobUseCase } from '../../../document/application/enqueue-document-job.usecase';

@Injectable()
export class FinalizeImpactAnalysisUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly prisma: PrismaService,
    private readonly createSnapshot: CreateReviewedReportSnapshotUseCase,
    private readonly enqueueJob: EnqueueDocumentJobUseCase,
  ) {}

  async execute(params: { analysisId: string; acknowledgeUnreviewed: boolean; userId: string }) {
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

    ReviewPolicy.assertCanFinalize(
      analysis,
      unreviewedItemsCount,
      params.acknowledgeUnreviewed
    );

    const snapshotData = await this.createSnapshot.buildSnapshotCreateData({
      analysisId: analysis.id,
      createdByUserId: params.userId,
    });

    const { snapshot, documentJob } = await this.prisma.$transaction(async (tx) => {
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

      const snapshot = await tx.reviewedReportSnapshot.create({
        data: snapshotData,
      });

      const { job } = await this.enqueueJob.createOrReuseQueuedJobForSnapshot(tx, {
        analysisId: analysis.id,
        snapshotId: snapshot.id,
        documentType: 'IMPACT_REPORT',
      });

      return { snapshot, documentJob: job };
    });

    await this.createSnapshot.recordCreatedEvent(snapshot);
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

    const finalizedAnalysis = await this.impactRepo.findById(analysis.id);
    return finalizedAnalysis!;
  }
}
