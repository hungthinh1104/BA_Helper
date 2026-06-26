import type { Prisma } from '@prisma/client';
import type {
  ImpactAnalysisListItemResponse,
  MultiRepoAnalysisRunDetailResponse,
  MultiRepoAnalysisRunListItemResponse,
} from '@ba-helper/contracts';
import { deriveMultiRepoRunAggregates } from '../application/multi-repo/multi-repo-run-readiness';
import {
  deriveMergedReportBlockedReasons,
  deriveMergedReportCapabilities,
  deriveMergedReportStaleness,
} from '../application/multi-repo/multi-repo-merged-report-state';
import { isAnalyzerVersionOutdated } from './analyzer-version';

type BaseAnalysis = Prisma.ImpactAnalysisGetPayload<Record<string, never>>;
type AnalysisSourceTarget = {
  id: string;
  requestedRef: string;
  resolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
  latestObservedCommitSha: string;
};

type AnalysisSnapshot = {
  id: string;
  repositoryId: string;
  commitSha: string;
  analyzerVersion: string;
  coverageStatus: 'READY' | 'PARTIAL';
  indexStatus: string;
};

type AnalysisRequirementRevision = {
  id: string;
  requirementId: string;
  title: string;
  rawText: string;
};

type AnalysisWithRelations = BaseAnalysis & {
  snapshot: AnalysisSnapshot;
  sourceTarget: AnalysisSourceTarget;
  requirementRevision: AnalysisRequirementRevision;
  reviewDecisions?: Array<{
    id: string;
    decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_CLARIFICATION';
    createdAt: Date;
    reviewedByUserId: string;
    reviewedByUser?: {
      name: string | null;
      email: string;
    } | null;
  }>;
};

const computeFreshness = (analysis: {
  snapshot: Pick<AnalysisSnapshot, 'commitSha'>;
  sourceTarget: Pick<
    AnalysisSourceTarget,
    'resolvedRefType' | 'latestObservedCommitSha'
  >;
}) => {
  const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
  const isStale =
    !isPinnedCommit &&
    analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

  return {
    isPinnedCommit,
    isStale,
  };
};

const computeCapabilities = (params: {
  status: AnalysisWithRelations['status'];
  isStale: boolean;
}) => ({
  canReview: params.status === 'WAITING_FOR_REVIEW' && !params.isStale,
  canFinalize: params.status === 'WAITING_FOR_REVIEW' && !params.isStale,
  canExport: params.status === 'COMPLETED' && !params.isStale,
  canRerun:
    params.status === 'FAILED' ||
    params.status === 'CANCELLED' ||
    params.status === 'COMPLETED' ||
    params.isStale,
  canCancel: params.status === 'QUEUED' || params.status === 'RUNNING',
});

export const mapImpactAnalysisResponse = (params: {
  analysis: AnalysisWithRelations;
}) => {
  const { analysis } = params;
  const { isPinnedCommit, isStale } = computeFreshness(analysis);
  const capabilities = computeCapabilities({
    status: analysis.status,
    isStale,
  });

  return {
    id: analysis.id,
    sourceTarget: {
      id: analysis.sourceTarget.id,
      requestedRef: analysis.sourceTarget.requestedRef,
      resolvedRefType: analysis.sourceTarget.resolvedRefType,
      latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
    },
    snapshot: {
      id: analysis.snapshot.id,
      repositoryId: analysis.snapshot.repositoryId,
      commitSha: analysis.snapshot.commitSha,
      analyzerVersion: analysis.snapshot.analyzerVersion,
      coverageStatus: analysis.snapshot.coverageStatus,
      indexStatus: analysis.snapshot.indexStatus as any,
    },
    freshness: {
      isStale,
      isAnalyzerOutdated: isAnalyzerVersionOutdated(
        analysis.snapshot.analyzerVersion,
      ),
      basis: isPinnedCommit ? 'PINNED_COMMIT' : 'LATEST_OBSERVED_SOURCE_TARGET',
    },
    requirement: {
      id: analysis.requirementRevision.requirementId,
      revisionId: analysis.requirementRevision.id,
      revisionTitle: analysis.requirementRevision.title,
      rawText: analysis.requirementRevision.rawText,
    },
    status: analysis.status,
    stage: analysis.stage,
    progress: analysis.progress,
    coverageWarning: analysis.coverageWarning,
    capabilities,
    derivedFromAnalysisId: analysis.derivedFromAnalysisId,
    sourceClarificationId: analysis.sourceClarificationId,
    error: analysis.error ? (analysis.error as any) : null,
  };
};

export const mapImpactAnalysisListItem = (analysis: AnalysisWithRelations & {
  snapshot: AnalysisSnapshot & {
    repository: {
      canonicalUrl: string;
    };
  };
}): ImpactAnalysisListItemResponse => {
  const { isStale } = computeFreshness(analysis);
  const capabilities = computeCapabilities({
    status: analysis.status,
    isStale,
  });
  const repositoryDisplayName =
    analysis.snapshot.repository.canonicalUrl.split('/').pop() ??
    analysis.snapshot.repository.canonicalUrl;

  return {
    id: analysis.id,
    title: `${analysis.requirementRevision.title} on ${repositoryDisplayName}`,
    status: analysis.status,
    stage: analysis.stage,
    isStale,
    requirementRevisionTitle: analysis.requirementRevision.title,
    repositoryDisplayName,
    snapshotCommitSha: analysis.snapshot.commitSha,
    createdAt: analysis.createdAt.toISOString(),
    capabilities: {
      canReview: capabilities.canReview,
      canFinalize: capabilities.canFinalize,
      canExport: capabilities.canExport,
    },
    derivedFromAnalysisId: analysis.derivedFromAnalysisId,
    sourceClarificationId: analysis.sourceClarificationId,
    error: analysis.error ? (analysis.error as any) : null,
  };
};

export const mapReviewDecision = (decision: any) => {
  return {
    id: decision.id,
    analysisId: decision.analysisId,
    decision: decision.decision,
    note: decision.note,
    reviewedBy: decision.reviewedByUser?.name || decision.reviewedByUser?.email || decision.reviewedByUserId || 'Unknown',
    createdAt: decision.createdAt.toISOString(),
  };
};

export const mapMergedMultiRepoReportReviewDecision = (decision: any) => {
  return {
    id: decision.id,
    mergedReportId: decision.mergedReportId,
    runId: decision.mergedReport.runId,
    decision: decision.decision,
    note: decision.note,
    reviewedBy:
      decision.reviewedByUser?.name ||
      decision.reviewedByUser?.email ||
      decision.reviewedByUserId ||
      'Unknown',
    createdAt: decision.createdAt.toISOString(),
  };
};

export const mapMultiRepoAnalysisRunDetail = (run: {
  id: string;
  projectId: string;
  requirementRevisionId: string;
  requirementRevision: {
    title: string;
  };
  createdByUser: {
    name: string | null;
    email: string;
  };
  createdAt: Date;
  approvedMergedReport: {
    provenance: unknown;
  } | null;
  analyses: Array<AnalysisWithRelations & {
    snapshot: AnalysisSnapshot & {
      repository: {
        canonicalUrl: string;
      };
    };
  }>;
}): MultiRepoAnalysisRunDetailResponse => {
  const items = run.analyses.map((analysis) => {
    const { isStale } = computeFreshness(analysis);
    const repositoryDisplayName =
      analysis.snapshot.repository.canonicalUrl.split('/').pop() ??
      analysis.snapshot.repository.canonicalUrl;
    const latestDecision = analysis.reviewDecisions?.[0] ?? null;

    let blockingReason: MultiRepoAnalysisRunDetailResponse['items'][number]['blockingReason'] =
      'NONE';

    if (analysis.status === 'FAILED') {
      blockingReason = 'FAILED';
    } else if (latestDecision?.decision === 'NEEDS_MORE_CLARIFICATION') {
      blockingReason = 'NEEDS_MORE_CLARIFICATION';
    } else if (latestDecision?.decision === 'REJECTED') {
      blockingReason = 'REJECTED';
    } else if (analysis.status === 'WAITING_FOR_REVIEW') {
      blockingReason = 'WAITING_FOR_REVIEW';
    } else if (analysis.status !== 'COMPLETED') {
      blockingReason = 'NOT_COMPLETED';
    }

    return {
      analysisId: analysis.id,
      repositoryId: analysis.snapshot.repositoryId,
      repositoryDisplayName,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
      isStale,
      latestReviewDecision: latestDecision?.decision ?? null,
      latestReviewDecisionAt: latestDecision?.createdAt.toISOString() ?? null,
      reviewedBy:
        latestDecision
          ? latestDecision.reviewedByUser?.name ||
            latestDecision.reviewedByUser?.email ||
            latestDecision.reviewedByUserId
          : null,
      blockingReason,
    };
  });

  const { runReadiness, childReviewSummary } = deriveMultiRepoRunAggregates(
    items.map((item) => ({
      status: item.status,
      latestReviewDecision: item.latestReviewDecision,
      isStale: item.isStale,
    })),
  );
  const storedChildProvenance = run.approvedMergedReport
    ? (((run.approvedMergedReport.provenance as any)?.childAnalyses ?? []) as Array<{
        analysisId: string;
        latestReviewDecisionId: string;
        snapshotId: string;
        commitSha: string;
      }>)
    : [];
  const currentChildProvenance = run.analyses.map((analysis) => {
    const { isStale } = computeFreshness(analysis);
    const latestDecision = analysis.reviewDecisions?.[0] ?? null;

    return {
      analysisId: analysis.id,
      latestReviewDecisionId: latestDecision?.id ?? null,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
      isStale,
    };
  });
  const reportStaleness = run.approvedMergedReport
    ? deriveMergedReportStaleness({
        storedChildProvenance,
        currentChildProvenance,
      })
    : { isStale: false };
  const blockedReasons = deriveMergedReportBlockedReasons(
    items.map((item) => ({
      status: item.status,
      isStale: item.isStale,
      latestReviewDecision: item.latestReviewDecision,
    })),
  );
  const mergedReportState = deriveMergedReportCapabilities({
    hasApprovedReport: Boolean(run.approvedMergedReport),
    isApprovedReportStale: reportStaleness.isStale,
    canStartMergedReport: runReadiness.canStartMergedReport,
    blockedReasons,
  });

  return {
    runId: run.id,
    projectId: run.projectId,
    requirementRevisionId: run.requirementRevisionId,
    requirementTitle: run.requirementRevision.title,
    createdBy: run.createdByUser.name || run.createdByUser.email,
    createdAt: run.createdAt.toISOString(),
    mergedReportStatus: mergedReportState.mergedReportStatus,
    capabilities: mergedReportState.capabilities,
    runReadiness,
    childReviewSummary,
    items,
  };
};

const EMPTY_MULTI_REPO_RUN_STATUS_COUNTS: MultiRepoAnalysisRunListItemResponse['statusCounts'] =
  {
    QUEUED: 0,
    RUNNING: 0,
    WAITING_FOR_REVIEW: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
  };

export const mapMultiRepoAnalysisRunListItem = (run: {
  id: string;
  projectId: string;
  requirementRevisionId: string;
  requirementRevision: {
    title: string;
  };
  createdByUser: {
    name: string | null;
    email: string;
  };
  createdAt: Date;
  analyses: Array<{
    status: keyof MultiRepoAnalysisRunListItemResponse['statusCounts'];
  }>;
}): MultiRepoAnalysisRunListItemResponse => {
  const statusCounts = run.analyses.reduce(
    (counts, analysis) => {
      counts[analysis.status] += 1;
      return counts;
    },
    { ...EMPTY_MULTI_REPO_RUN_STATUS_COUNTS },
  );

  return {
    runId: run.id,
    projectId: run.projectId,
    requirementRevisionId: run.requirementRevisionId,
    requirementTitle: run.requirementRevision.title,
    createdBy: run.createdByUser.name || run.createdByUser.email,
    createdAt: run.createdAt.toISOString(),
    analysisCount: run.analyses.length,
    statusCounts,
  };
};
