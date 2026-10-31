import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { PrismaService, EventLogService, lockReviewAnalysisForMutation } from '@ba-helper/backend-runtime';
import type { EventLogTransactionClient } from '@ba-helper/backend-runtime';
import { ReviewedReportContentBuilder } from './reviewed-report-content.builder';

@Injectable()
export class CreateReviewedReportSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly contentBuilder: ReviewedReportContentBuilder,
  ) {}

  async execute(params: { analysisId: string; createdByUserId?: string }) {
    return this.prisma.$transaction(async (tx) => {
      const locked = await lockReviewAnalysisForMutation(tx, params.analysisId);
      if (!locked) {
        throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
      }
      await this.assertSnapshotAllowed(params.analysisId);
      const data = await this.buildSnapshotCreateData(params);
      const snapshot = await tx.reviewedReportSnapshot.create({ data });
      await this.recordCreatedEvent(snapshot, tx);
      return snapshot;
    }, { maxWait: 25_000, timeout: 30_000 });
  }

  private async assertSnapshotAllowed(analysisId: string) {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      include: {
        snapshot: true,
        sourceTarget: true,
      },
    });

    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    if (analysis.status !== 'COMPLETED') {
      throw new AppError(
        'INVALID_STATE_TRANSITION',
        'Reviewed report snapshots can only be created for finalized analyses.',
      );
    }

    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale =
      !isPinnedCommit &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    if (isStale) {
      throw new AppError(
        'ANALYSIS_STALE',
        'Cannot create reviewed report snapshot for a stale analysis.',
      );
    }
  }

  async buildSnapshotCreateData(params: {
    analysisId: string;
    createdByUserId?: string;
  }) {
    return this.contentBuilder.build(params);
  }

  async recordCreatedEvent(snapshot: {
    id: string;
    analysisId: string;
    approvedDocumentId: string | null;
    createdByUserId: string | null;
  }, transaction?: EventLogTransactionClient) {
    await this.eventLog.recordEvent({
      eventType: 'REVIEWED_REPORT_SNAPSHOT_CREATED',
      idempotencyKey: `reviewed-report-snapshot:${snapshot.id}:created`,
      payload: {
        snapshotId: snapshot.id,
        analysisId: snapshot.analysisId,
        approvedDocumentId: snapshot.approvedDocumentId,
        createdByUserId: snapshot.createdByUserId,
      },
    }, transaction);
  }
}
