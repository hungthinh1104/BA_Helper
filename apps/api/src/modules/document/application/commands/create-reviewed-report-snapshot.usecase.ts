import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildEvidenceQualityProjection } from '../evidence-quality.projection';
import { PrismaService, TraceabilityRepository, InsightRepository, EvaluationContextAdapter, EventLogService } from "@ba-helper/backend-runtime";

type ReviewedReportSnapshotCreateData = {
  analysisId: string;
  approvedDocumentId: null;
  markdown: null;
  reviewDecisionsSnapshot: Prisma.InputJsonValue;
  evidenceQualitySummarySnapshot: Prisma.InputJsonValue;
  evaluationContextSnapshot: Prisma.InputJsonValue | typeof Prisma.DbNull;
  createdByUserId: string | null;
};

@Injectable()
export class CreateReviewedReportSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly insightRepo: InsightRepository,
    private readonly evalContextAdapter: EvaluationContextAdapter,
  ) {}

  async execute(params: { analysisId: string; createdByUserId?: string }) {
    const data = await this.buildSnapshotCreateData(params);
    const snapshot = await this.prisma.reviewedReportSnapshot.create({ data });
    await this.recordCreatedEvent(snapshot);
    return snapshot;
  }

  async buildSnapshotCreateData(params: {
    analysisId: string;
    createdByUserId?: string;
  }): Promise<ReviewedReportSnapshotCreateData> {
    const evaluationContextSnapshot = this.evalContextAdapter.getEvaluationContext();
    const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(params.analysisId);
    const insights = await this.insightRepo.listByAnalysis(params.analysisId);
    const qualityProjection = buildEvidenceQualityProjection({
      traceabilityLinks,
      insights: insights as any[],
    });

    return {
      analysisId: params.analysisId,
      approvedDocumentId: null,
      markdown: null,
      reviewDecisionsSnapshot: qualityProjection.items as Prisma.InputJsonValue,
      evidenceQualitySummarySnapshot: qualityProjection.summary as Prisma.InputJsonValue,
      evaluationContextSnapshot: evaluationContextSnapshot
        ? (evaluationContextSnapshot as Prisma.InputJsonValue)
        : Prisma.DbNull,
      createdByUserId: params.createdByUserId || null,
    };
  }

  async recordCreatedEvent(snapshot: {
    id: string;
    analysisId: string;
    approvedDocumentId: string | null;
    createdByUserId: string | null;
  }) {
    await this.eventLog.recordEvent({
      eventType: 'REVIEWED_REPORT_SNAPSHOT_CREATED',
      idempotencyKey: `reviewed-report-snapshot:${snapshot.id}:created:${Date.now()}`,
      payload: {
        snapshotId: snapshot.id,
        analysisId: snapshot.analysisId,
        approvedDocumentId: snapshot.approvedDocumentId,
        createdByUserId: snapshot.createdByUserId,
      },
    });
  }
}
