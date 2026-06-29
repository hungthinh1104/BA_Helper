import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ApprovedReportMetadata } from '../domain/approved-report-metadata';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { EvaluationContextAdapter } from './evaluation-context.adapter';
import { buildEvidenceQualityProjection } from './evidence-quality.projection';

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
    const insights = await this.insightRepo.listByAnalysis(analysis.id);
    const qualityProjection = buildEvidenceQualityProjection({
      traceabilityLinks,
      insights: insights as any[],
    });

    return {
      report,
      isStale,
      staleReason,
      evaluationContext,
      evidenceQualitySummary: qualityProjection.summary,
      evidenceQualityItems: qualityProjection.items,
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
