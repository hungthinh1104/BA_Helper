import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { EvidenceQualityAnnotator } from './evidence-quality.annotator';
import { EvaluationContextAdapter } from './evaluation-context.adapter';

@Injectable()
export class CreateReviewedReportSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventLog: EventLogService,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly evalContextAdapter: EvaluationContextAdapter,
  ) {}

  async execute(params: { analysisId: string; createdByUserId?: string }) {
      const evaluationContextSnapshot = this.evalContextAdapter.getEvaluationContext();
      
      const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(params.analysisId);

      const linkAnnotations = traceabilityLinks.map(link => ({
        link,
        annotation: EvidenceQualityAnnotator.annotate(link as any),
      }));

      const evidenceQualitySummarySnapshot = {
        evidenced: linkAnnotations.filter(l => l.annotation.label === 'EVIDENCED').length,
        inferred: linkAnnotations.filter(l => l.annotation.label === 'INFERRED').length,
        weakEvidence: linkAnnotations.filter(l => l.annotation.label === 'WEAK_EVIDENCE').length,
        missingEvidence: linkAnnotations.filter(l => l.annotation.label === 'MISSING_EVIDENCE').length,
        reviewRequired: linkAnnotations.filter(l => l.annotation.label === 'REVIEW_REQUIRED').length,
      };

      const reviewDecisionsSnapshot = linkAnnotations.map(item => {
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

      // Create the snapshot in DB.
      const snapshot = await this.prisma.reviewedReportSnapshot.create({
        data: {
          analysisId: params.analysisId,
          approvedDocumentId: null,
          markdown: null,
          reviewDecisionsSnapshot: reviewDecisionsSnapshot as any,
          evidenceQualitySummarySnapshot: evidenceQualitySummarySnapshot as any,
          evaluationContextSnapshot: evaluationContextSnapshot ? (evaluationContextSnapshot as any) : require('@prisma/client').Prisma.DbNull,
          createdByUserId: params.createdByUserId || null,
        },
      });

      // Emit event.
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
