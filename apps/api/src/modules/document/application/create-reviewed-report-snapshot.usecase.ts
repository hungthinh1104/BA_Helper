import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GetApprovedReportUseCase } from './get-approved-report.usecase';
import { ApprovedReportProjectionService } from './approved-report-projection.service';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class CreateReviewedReportSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly getApprovedReport: GetApprovedReportUseCase,
    private readonly projectionService: ApprovedReportProjectionService,
    private readonly eventLog: EventLogService,
  ) {}

  async execute(params: { analysisId: string; createdByUserId?: string }) {
    // 1. Get the raw approved report.
    const rawReport = await this.getApprovedReport.execute(params.analysisId);

    // 2. Project it to get the structured metadata (including decisions).
    const projected = await this.projectionService.project(rawReport);

    // 3. Extract necessary snapshots.
    const markdown = projected.report.content;
    const reviewDecisionsSnapshot = projected.evidenceQualityItems || [];
    const evidenceQualitySummarySnapshot = projected.evidenceQualitySummary || {};
    const evaluationContextSnapshot = projected.evaluationContext || null;

    // 4. Create the snapshot in DB.
    const snapshot = await this.prisma.reviewedReportSnapshot.create({
      data: {
        analysisId: params.analysisId,
        approvedDocumentId: projected.report.id,
        markdown,
        reviewDecisionsSnapshot,
        evidenceQualitySummarySnapshot,
        evaluationContextSnapshot,
        createdByUserId: params.createdByUserId || null,
      },
    });

    // 5. Emit event.
    await this.eventLog.recordEvent({
      eventType: 'REVIEWED_REPORT_SNAPSHOT_CREATED',
      idempotencyKey: `reviewed-report-snapshot:${snapshot.id}:created:${Date.now()}`,
      payload: {
        snapshotId: snapshot.id,
        analysisId: params.analysisId,
        approvedDocumentId: snapshot.approvedDocumentId,
        createdByUserId: snapshot.createdByUserId,
      },
    });

    return snapshot;
  }
}
