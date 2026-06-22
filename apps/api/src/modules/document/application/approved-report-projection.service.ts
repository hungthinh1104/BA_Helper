import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { EvaluationContextAdapter } from './evaluation-context.adapter';
import { EvidenceQualityAnnotator } from './evidence-quality.annotator';

@Injectable()
export class ApprovedReportProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly evalContextAdapter: EvaluationContextAdapter,
  ) {}

  async project(report: any): Promise<{
    report: any;
    isStale: boolean;
    staleReason?: string;
    metadata: ApprovedReportMetadata;
    evaluationContext?: any;
    evidenceQualitySummary?: any;
    evidenceQualityItems?: any[];
  }> {
    const analysis = report.impactAnalysis;
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';

    let staleReason: string | undefined;
    let isStale =
      !isPinnedCommit &&
      !!analysis.sourceTarget.latestObservedCommitSha &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    if (isStale) {
      staleReason = 'Source target has advanced to a newer commit since analysis.';
    }

    const latestDecision = await this.prisma.analysisReviewDecision.findFirst({
      where: { analysisId: analysis.id },
      orderBy: { createdAt: 'desc' },
    });

    if (latestDecision && report.updatedAt < latestDecision.createdAt) {
      isStale = true;
      staleReason = 'Review decisions changed after the approved report snapshot was generated.';
    }

    const evaluationContext = this.evalContextAdapter.getEvaluationContext();
    const traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysis.id);

    const linkAnnotations = traceabilityLinks.map(link => ({
      link,
      annotation: EvidenceQualityAnnotator.annotate(link as any),
    }));

    const evidenceQualitySummary = {
      evidenced: linkAnnotations.filter(l => l.annotation.label === 'EVIDENCED').length,
      inferred: linkAnnotations.filter(l => l.annotation.label === 'INFERRED').length,
      weakEvidence: linkAnnotations.filter(l => l.annotation.label === 'WEAK_EVIDENCE').length,
      missingEvidence: linkAnnotations.filter(l => l.annotation.label === 'MISSING_EVIDENCE').length,
      reviewRequired: linkAnnotations.filter(l => l.annotation.label === 'REVIEW_REQUIRED').length,
    };

    const evidenceQualityItems = linkAnnotations.map(item => {
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
      report,
      isStale,
      staleReason,
      evaluationContext,
      evidenceQualitySummary,
      evidenceQualityItems,
      metadata: {
        analysisId: analysis.id,
        title: analysis.requirementRevision.title,
        projectId: analysis.requirementRevision.requirement.projectId,
        repositoryId: analysis.snapshot.repositoryId,
        targetRef: analysis.sourceTarget.requestedRef,
        commitSha: analysis.snapshot.commitSha,
        snapshotId: analysis.snapshot.id,
        analyzerVersion: analysis.snapshot.analyzerVersion,
        generatedDocumentId: report.id,
        generatedAt: report.updatedAt.toISOString(),
        finalizedAt: analysis.updatedAt.toISOString(),
        approvedDocumentCreatedAt: report.createdAt.toISOString(),
        approvedDocumentUpdatedAt: report.updatedAt.toISOString(),
        staleStatusAtReadTime: isStale,
        staleReason,
      },
    };
  }
}
