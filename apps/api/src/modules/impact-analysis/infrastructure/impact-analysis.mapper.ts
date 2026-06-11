import type { Prisma } from '@prisma/client';
import type { ImpactAnalysisListItemResponse } from '@ba-helper/contracts';

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
      isAnalyzerOutdated: false,
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
