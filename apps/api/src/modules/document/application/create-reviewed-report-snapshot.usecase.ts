import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../event-log/application/event-log.service';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { EvidenceQualityAnnotator } from './evidence-quality.annotator';
import { EvaluationContextAdapter } from './evaluation-context.adapter';

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

    const linkAnnotations = traceabilityLinks.map((link) => ({
      link,
      annotation: EvidenceQualityAnnotator.annotate(link),
    }));

    const evidenceQualitySummarySnapshot = {
      evidenced: linkAnnotations.filter((item) => item.annotation.label === 'EVIDENCED').length,
      inferred: linkAnnotations.filter((item) => item.annotation.label === 'INFERRED').length,
      weakEvidence: linkAnnotations.filter((item) => item.annotation.label === 'WEAK_EVIDENCE').length,
      missingEvidence: linkAnnotations.filter((item) => item.annotation.label === 'MISSING_EVIDENCE').length,
      reviewRequired: linkAnnotations.filter((item) => item.annotation.label === 'REVIEW_REQUIRED').length,
    };

    const reviewDecisionsSnapshot = linkAnnotations.map((item) => {
      const decision = item.link.reviewDecision;

      return {
        linkId: item.link.id,
        artifact: item.link.artifact?.filePath || item.link.artifact?.name || 'Unknown',
        quality: item.annotation.label,
        reasons: item.annotation.reasons,
        reviewDecision: decision
          ? {
              id: decision.id,
              analysisId: decision.analysisId,
              traceabilityLinkId: decision.traceabilityLinkId,
              decision: decision.decision,
              note: decision.note,
              reviewedByUserId: decision.reviewedByUserId,
              reviewedAt: decision.reviewedAt.toISOString(),
            }
          : null,
      };
    });

    return {
      analysisId: params.analysisId,
      approvedDocumentId: null,
      markdown: null,
      reviewDecisionsSnapshot: reviewDecisionsSnapshot as Prisma.InputJsonValue,
      evidenceQualitySummarySnapshot: evidenceQualitySummarySnapshot as Prisma.InputJsonValue,
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
