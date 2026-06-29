import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../index';;
import { MarkdownReportRenderContext } from '../markdown-impact-report.types';
import { InsightRepository } from '../../../index';;
import { TraceabilityRepository } from '../../../index';;
import { ReviewNoteRepository } from '../../../index';;
import { GraphRepository } from '../../../index';;
import { ReviewClarificationRepository } from '../../../index';;
import { ReviewDecisionRepository } from '../../../index';;
import { GetImpactDiffUseCase } from '../../../impact-analysis/application/queries/get-impact-diff.usecase';
import { DEFAULT_REPORT_LOCALE, ReportLocale } from './report-localization';
import type { ApprovedReportMetadata } from '../../domain/approved-report-metadata';
import { buildReportReviewCoverageSummaryFromSnapshot } from '../report-review-coverage.summary';

@Injectable()
export class ReviewedSnapshotReportContextAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly insightRepo: InsightRepository,
    private readonly traceabilityRepo: TraceabilityRepository,
    private readonly reviewNoteRepo: ReviewNoteRepository,
    private readonly graphRepo: GraphRepository,
    private readonly clarificationRepo: ReviewClarificationRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
    private readonly getDiffUseCase: GetImpactDiffUseCase,
  ) {}

  async buildContext(
    snapshot: any,
    analysis: any,
    locale: ReportLocale = DEFAULT_REPORT_LOCALE,
  ): Promise<MarkdownReportRenderContext> {
    const analysisId = analysis.id;
    
    // 1. Fetch live elements
    const insights = await this.insightRepo.listByAnalysis(analysisId);
    let traceabilityLinks = await this.traceabilityRepo.listByAnalysis(analysisId);
    let reviewNotes = await this.reviewNoteRepo.findByAnalysisId(analysisId);
    const dependencyEdges = await this.graphRepo.listBySnapshot(analysis.snapshot.id);
    const clarifications = await this.clarificationRepo.listByAnalysisId(analysisId);
    let reviewDecisions = await this.decisionRepo.listByAnalysisId(analysisId);

    // 2. Snapshot overrides and point-in-time filtering
    const snapshotDate = new Date(snapshot.createdAt);

    // Filter global review decisions and notes to only those that existed AT snapshot time
    reviewDecisions = reviewDecisions.filter(d => new Date(d.createdAt) <= snapshotDate);
    reviewNotes = reviewNotes.filter(n => new Date(n.createdAt) <= snapshotDate);

    // Retrieve snapshot payload
    const reviewDecisionsSnapshot = snapshot.reviewDecisionsSnapshot as any[];
    const evidenceQualitySummarySnapshot = snapshot.evidenceQualitySummarySnapshot as any;
    const reviewCoverageSummarySnapshot = buildReportReviewCoverageSummaryFromSnapshot({
      reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot,
    });

    // Overwrite traceability links with snapshot state
    if (reviewDecisionsSnapshot && Array.isArray(reviewDecisionsSnapshot)) {
      for (const link of traceabilityLinks) {
        const snapItem = reviewDecisionsSnapshot.find(x => x.linkId === link.id);
        if (snapItem) {
          // Reconstruct the link's reviewDecision to match snapshot exactly
          link.reviewDecision = snapItem.reviewDecision;
          // Status mapping based on decision
          if (snapItem.reviewDecision) {
            link.reviewStatus = snapItem.reviewDecision.decision === 'ACCEPTED' ? 'CONFIRMED' : 
                                snapItem.reviewDecision.decision === 'REJECTED' ? 'REJECTED' : 'NEEDS_REVIEW';
          } else {
            link.reviewStatus = 'NEEDS_REVIEW';
          }
        }
      }
    }

    // Determine hasUnreviewedItems from the insights (live metadata)
    const hasUnreviewed = insights.some(
      (insight: { reviewStatus: string }) => insight.reviewStatus === 'NEEDS_REVIEW',
    );

    let diff: any = undefined;
    if (analysis.derivedFromAnalysisId) {
      const diffResult = await this.getDiffUseCase.computeForAnalysis(analysisId);
      if (diffResult.computable) {
        diff = diffResult.diff;
      }
    }

    return {
      analysis,
      locale,
      insights,
      traceabilityLinks: traceabilityLinks as any[],
      reviewNotes,
      hasUnreviewedItems: !!hasUnreviewed,
      dependencyEdges: dependencyEdges as any[],
      clarifications: clarifications as any[],
      reviewDecisions,
      reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot,
      reviewCoverageSummarySnapshot,
      diff,
      metadata: {
        analysisId: analysis.id,
        title: analysis.requirementRevision.title,
        projectId: analysis.snapshot.repository.projectId,
        repositoryId: analysis.snapshot.repositoryId,
        targetRef: analysis.sourceTarget.requestedRef,
        commitSha: analysis.snapshot.commitSha,
        snapshotId: analysis.snapshot.id,
        analyzerVersion: analysis.snapshot.analyzerVersion,
        generatedDocumentId: 'pending',
        generatedAt: new Date().toISOString(),
        finalizedAt: analysis.updatedAt.toISOString(),
        staleStatusAtReadTime: false, // Snapshot is never stale at read time
        domainPack: readDomainPackProvenance(analysis),
      },
    };
  }
}

function readDomainPackProvenance(analysis: {
  requestedDomainPackId?: string | null;
  resolvedDomainPackId?: string | null;
  resolvedDomainPackVersion?: string | null;
  resolvedDomainPackStatus?: string | null;
  domainPackSelectedBy?: string | null;
  domainPackResolvedAt?: Date | string | null;
  domainPackManifestDigest?: string | null;
  domainPackRegistryVersion?: string | null;
  metadata?: unknown;
}): ApprovedReportMetadata['domainPack'] {
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
