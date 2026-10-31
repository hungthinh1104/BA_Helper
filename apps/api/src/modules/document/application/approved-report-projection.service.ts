import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { buildEvidenceQualityProjection } from './evidence-quality.projection';
import { PrismaService, TraceabilityRepository, InsightRepository, EvaluationContextAdapter, ApprovedReportMetadata, buildReportReviewCoverageSummary, buildReportReviewCoverageSummaryFromSnapshot } from "@ba-helper/backend-runtime";

@Injectable()
export class ApprovedReportProjectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly insightRepo: InsightRepository,
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
    reviewCoverageSummary?: any;
  }> {
    const analysis = report.impactAnalysis;
    const reviewedSnapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId: analysis.id },
      orderBy: { createdAt: 'desc' },
    });

    if (
      reviewedSnapshot &&
      (reviewedSnapshot.approvedDocumentId !== report.id ||
        (report.reviewedReportSnapshotId != null && report.reviewedReportSnapshotId !== reviewedSnapshot.id))
    ) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'The approved document is not linked to the latest reviewed snapshot.',
        { reportSnapshotId: reviewedSnapshot.id, approvedDocumentId: report.id },
      );
    }

    if (reviewedSnapshot && reviewedSnapshot.markdown === null) {
      const completedJobs = await this.prisma.documentJob.findMany({
        where: { generatedDocumentId: report.id, status: 'COMPLETED' },
        select: { snapshotId: true },
      });
      if (completedJobs.some((job: { snapshotId: string }) => job.snapshotId !== reviewedSnapshot.id)) {
        throw new AppError(
          'REPORT_PROVENANCE_MISMATCH',
          'The approved document has been generated from multiple reviewed snapshots without frozen report content.',
          { reportSnapshotId: reviewedSnapshot.id, approvedDocumentId: report.id },
        );
      }
    }

    const projectedReport = reviewedSnapshot?.markdown !== null && reviewedSnapshot?.markdown !== undefined
      ? { ...report, content: reviewedSnapshot.markdown }
      : report;
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
    const insights = await this.insightRepo.listByAnalysis(analysis.id);
    const qualityProjection = buildEvidenceQualityProjection({
      traceabilityLinks,
      insights: insights as any[],
    });
    const liveReviewCoverageSummary = buildReportReviewCoverageSummary({
      items: qualityProjection.items,
      evidenceQualitySummary: qualityProjection.summary,
    });
    const evidenceQualitySummary = reviewedSnapshot?.evidenceQualitySummarySnapshot ?? qualityProjection.summary;
    const evidenceQualityItems = Array.isArray(reviewedSnapshot?.reviewDecisionsSnapshot)
      ? reviewedSnapshot.reviewDecisionsSnapshot
      : qualityProjection.items;
    const reviewCoverageSummary = reviewedSnapshot
      ? buildReportReviewCoverageSummaryFromSnapshot({
          reviewDecisionsSnapshot: reviewedSnapshot.reviewDecisionsSnapshot,
          evidenceQualitySummarySnapshot: reviewedSnapshot.evidenceQualitySummarySnapshot,
        })
      : liveReviewCoverageSummary;
    const projectedEvaluationContext = reviewedSnapshot
      ? reviewedSnapshot.evaluationContextSnapshot
      : evaluationContext;

    return {
      report: projectedReport,
      isStale,
      staleReason,
      evaluationContext: projectedEvaluationContext,
      evidenceQualitySummary,
      evidenceQualityItems,
      reviewCoverageSummary,
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
        generatedAt: (reviewedSnapshot?.createdAt ?? report.updatedAt).toISOString(),
        finalizedAt: analysis.updatedAt.toISOString(),
        approvedDocumentCreatedAt: report.createdAt.toISOString(),
        approvedDocumentUpdatedAt: (reviewedSnapshot?.createdAt ?? report.updatedAt).toISOString(),
        staleStatusAtReadTime: isStale,
        staleReason,
        domainPack: readDomainPackProvenance(analysis),
      },
    };
  }
}

function readDomainPackProvenance(analysis: any): ApprovedReportMetadata['domainPack'] {
  if (
    typeof analysis.resolvedDomainPackId === 'string' &&
    typeof analysis.resolvedDomainPackVersion === 'string' &&
    isDomainPackStatus(analysis.resolvedDomainPackStatus) &&
    isDomainPackSelectedBy(analysis.domainPackSelectedBy)
  ) {
    return {
      requestedDomainPackId: analysis.requestedDomainPackId ?? null,
      domainPackId: analysis.resolvedDomainPackId,
      domainPackVersion: analysis.resolvedDomainPackVersion,
      domainPackStatus: analysis.resolvedDomainPackStatus,
      selectedBy: analysis.domainPackSelectedBy,
      resolvedAt: normalizeDateTime(analysis.domainPackResolvedAt),
      manifestDigest: analysis.domainPackManifestDigest ?? null,
      registryVersion: analysis.domainPackRegistryVersion ?? null,
    };
  }

  const metadata = analysis.metadata;
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return undefined;
  }

  const provenance = (metadata as Record<string, unknown>).reportProvenance;
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    return undefined;
  }

  const data = provenance as Record<string, unknown>;
  if (
    typeof data.domainPackId !== 'string' ||
    typeof data.domainPackVersion !== 'string' ||
    !isDomainPackStatus(data.domainPackStatus) ||
    !isDomainPackSelectedBy(data.selectedBy)
  ) {
    return undefined;
  }

  return {
    requestedDomainPackId: readOptionalString(data.requestedDomainPackId),
    domainPackId: data.domainPackId,
    domainPackVersion: data.domainPackVersion,
    domainPackStatus: data.domainPackStatus,
    selectedBy: data.selectedBy,
    resolvedAt: readOptionalString(data.resolvedAt),
    manifestDigest: readOptionalString(data.manifestDigest),
    registryVersion: readOptionalString(data.registryVersion),
  };
}

function normalizeDateTime(value: unknown): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isDomainPackStatus(
  value: unknown,
): value is NonNullable<ApprovedReportMetadata['domainPack']>['domainPackStatus'] {
  return (
    value === 'STABLE' ||
    value === 'PARTIAL' ||
    value === 'EXPERIMENTAL' ||
    value === 'FALLBACK'
  );
}

function isDomainPackSelectedBy(
  value: unknown,
): value is NonNullable<ApprovedReportMetadata['domainPack']>['selectedBy'] {
  return (
    value === 'EXPLICIT' ||
    value === 'REPOSITORY_PROFILE' ||
    value === 'FALLBACK'
  );
}
