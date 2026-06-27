import { z } from 'zod';
import type {
  ChildReviewDecision,
  ChildStatus} from './multi-repo-run-readiness';
import {
  deriveMultiRepoRunAggregates,
} from './multi-repo-run-readiness';

export type StoredChildProvenance = {
  analysisId: string;
  latestReviewDecisionId: string;
  snapshotId: string;
  commitSha: string;
};

export type CurrentChildProvenance = {
  analysisId: string;
  latestReviewDecisionId: string | null;
  snapshotId: string;
  commitSha: string;
  status: ChildStatus;
  isStale?: boolean;
};

export type MultiRepoChildState = {
  analysisId: string;
  latestReviewDecisionId: string | null;
  latestReviewDecision: ChildReviewDecision;
  snapshotId: string;
  commitSha: string;
  status: ChildStatus;
  sourceTarget: {
    resolvedRefType: 'BRANCH' | 'TAG' | 'COMMIT';
    latestObservedCommitSha: string;
  };
};

export type MultiRepoChildBlockingReason =
  | 'FAILED'
  | 'NOT_COMPLETED'
  | 'WAITING_FOR_REVIEW'
  | 'NEEDS_MORE_CLARIFICATION'
  | 'REJECTED'
  | 'STALE'
  | 'NONE';

export type MergedReportStatus = 'NOT_CREATED' | 'CURRENT' | 'STALE' | 'BLOCKED';

export type MergedReportBlockedReason =
  | 'CHILD_ANALYSIS_FAILED'
  | 'CHILD_ANALYSIS_NOT_COMPLETED'
  | 'CHILD_ANALYSIS_WAITING_FOR_REVIEW'
  | 'CHILD_ANALYSIS_STALE'
  | 'CHILD_REVIEW_NEEDS_CLARIFICATION'
  | 'CHILD_REVIEW_REJECTED'
  | 'CHILD_REVIEW_PENDING'
  | 'MERGED_REPORT_CURRENT';

const storedChildProvenanceSchema = z.object({
  analysisId: z.string().uuid(),
  latestReviewDecisionId: z.string().uuid(),
  snapshotId: z.string().uuid(),
  commitSha: z.string().min(1),
});

const mergedReportProvenanceSchema = z.object({
  childAnalyses: z.array(storedChildProvenanceSchema),
});

export function parseMergedReportProvenance(provenance: unknown): {
  childAnalyses: StoredChildProvenance[];
  isValid: boolean;
  invalidReason?: string;
} {
  const parsed = mergedReportProvenanceSchema.safeParse(provenance);
  if (!parsed.success) {
    return {
      childAnalyses: [],
      isValid: false,
      invalidReason:
        'Approved merged report provenance is invalid; refresh the snapshot before review or export.',
    };
  }

  return {
    childAnalyses: normalizeChildProvenance(parsed.data.childAnalyses),
    isValid: true,
  };
}

export function normalizeChildProvenance<T extends { analysisId: string }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) =>
    left.analysisId.localeCompare(right.analysisId),
  );
}

export function deriveMergedReportStaleness(params: {
  storedChildProvenance: StoredChildProvenance[];
  currentChildProvenance: CurrentChildProvenance[];
}): { isStale: boolean; staleReason?: string } {
  const storedChildProvenance = normalizeChildProvenance(
    params.storedChildProvenance,
  );
  const currentChildProvenance = normalizeChildProvenance(
    params.currentChildProvenance,
  );

  if (storedChildProvenance.length !== currentChildProvenance.length) {
    return {
      isStale: true,
      staleReason:
        'Child analysis set changed after the approved merged report snapshot was generated.',
    };
  }

  const storedByAnalysisId = new Map(
    storedChildProvenance.map((item) => [item.analysisId, item]),
  );

  for (const current of currentChildProvenance) {
    const stored = storedByAnalysisId.get(current.analysisId);
    if (!stored) {
      return {
        isStale: true,
        staleReason:
          'Child analysis set changed after the approved merged report snapshot was generated.',
      };
    }
    if (current.isStale === true) {
      return {
        isStale: true,
        staleReason:
          'A child analysis became stale after the approved merged report snapshot was generated.',
      };
    }
    if (current.status !== 'COMPLETED') {
      return {
        isStale: true,
        staleReason: 'A child analysis is no longer completed.',
      };
    }
    if (current.latestReviewDecisionId !== stored.latestReviewDecisionId) {
      return {
        isStale: true,
        staleReason:
          'Child review decisions changed after the approved merged report snapshot was generated.',
      };
    }
    if (
      current.snapshotId !== stored.snapshotId ||
      current.commitSha !== stored.commitSha
    ) {
      return {
        isStale: true,
        staleReason:
          'Child snapshot provenance changed after the approved merged report snapshot was generated.',
      };
    }
  }

  return { isStale: false };
}

export function isChildAnalysisStale(child: MultiRepoChildState): boolean {
  return (
    child.sourceTarget.resolvedRefType !== 'COMMIT' &&
    child.sourceTarget.latestObservedCommitSha !== child.commitSha
  );
}

export function buildCurrentChildProvenance(
  children: MultiRepoChildState[],
): CurrentChildProvenance[] {
  return children.map((child) => ({
    analysisId: child.analysisId,
    latestReviewDecisionId: child.latestReviewDecisionId,
    snapshotId: child.snapshotId,
    commitSha: child.commitSha,
    status: child.status,
    isStale: isChildAnalysisStale(child),
  }));
}

export function deriveChildBlockingReason(params: {
  status: ChildStatus;
  isStale: boolean;
  latestReviewDecision: ChildReviewDecision;
}): MultiRepoChildBlockingReason {
  if (params.isStale) {
    return 'STALE';
  }
  if (params.status === 'FAILED' || params.status === 'CANCELLED') {
    return 'FAILED';
  }
  if (params.latestReviewDecision === 'NEEDS_MORE_CLARIFICATION') {
    return 'NEEDS_MORE_CLARIFICATION';
  }
  if (params.latestReviewDecision === 'REJECTED') {
    return 'REJECTED';
  }
  if (params.status === 'WAITING_FOR_REVIEW') {
    return 'WAITING_FOR_REVIEW';
  }
  if (params.status !== 'COMPLETED') {
    return 'NOT_COMPLETED';
  }

  return 'NONE';
}

export function deriveMergedReportBlockedReasons(
  items: Array<{
    status: string;
    isStale: boolean;
    latestReviewDecision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_CLARIFICATION' | null;
  }>,
): MergedReportBlockedReason[] {
  const reasons = new Set<MergedReportBlockedReason>();

  for (const item of items) {
    if (item.isStale) {
      reasons.add('CHILD_ANALYSIS_STALE');
    }
    if (item.status === 'FAILED' || item.status === 'CANCELLED') {
      reasons.add('CHILD_ANALYSIS_FAILED');
    } else if (item.status === 'WAITING_FOR_REVIEW') {
      reasons.add('CHILD_ANALYSIS_WAITING_FOR_REVIEW');
    } else if (item.status !== 'COMPLETED') {
      reasons.add('CHILD_ANALYSIS_NOT_COMPLETED');
    }

    if (item.latestReviewDecision === 'REJECTED') {
      reasons.add('CHILD_REVIEW_REJECTED');
    } else if (item.latestReviewDecision === 'NEEDS_MORE_CLARIFICATION') {
      reasons.add('CHILD_REVIEW_NEEDS_CLARIFICATION');
    } else if (item.latestReviewDecision !== 'ACCEPTED') {
      reasons.add('CHILD_REVIEW_PENDING');
    }
  }

  return [...reasons];
}

export function deriveMergedReportStatus(params: {
  hasApprovedReport: boolean;
  isApprovedReportStale: boolean;
  canStartMergedReport: boolean;
}): MergedReportStatus {
  if (params.hasApprovedReport) {
    return params.isApprovedReportStale ? 'STALE' : 'CURRENT';
  }

  return params.canStartMergedReport ? 'NOT_CREATED' : 'BLOCKED';
}

export function deriveMergedReportCapabilities(params: {
  hasApprovedReport: boolean;
  isApprovedReportStale: boolean;
  canStartMergedReport: boolean;
  blockedReasons: MergedReportBlockedReason[];
}) {
  const mergedReportStatus = deriveMergedReportStatus(params);
  const blockedReasons =
    mergedReportStatus === 'CURRENT'
      ? (['MERGED_REPORT_CURRENT'] as MergedReportBlockedReason[])
      : params.blockedReasons;

  return {
    mergedReportStatus,
    capabilities: {
      canFinalizeMergedReport:
        !params.hasApprovedReport && params.canStartMergedReport,
      canRefreshMergedReport:
        params.hasApprovedReport &&
        params.isApprovedReportStale &&
        params.canStartMergedReport,
      canExportMergedReport:
        params.hasApprovedReport && !params.isApprovedReportStale,
      canReviewMergedReport:
        params.hasApprovedReport && !params.isApprovedReportStale,
      canOpenApprovedReport: params.hasApprovedReport,
      blockedReasons,
    },
  };
}

export function deriveMergedReportState(params: {
  children: MultiRepoChildState[];
  approvedReportProvenance?: unknown;
}) {
  const hasApprovedReport = params.approvedReportProvenance !== undefined;
  const currentChildProvenance = buildCurrentChildProvenance(params.children);
  const aggregates = deriveMultiRepoRunAggregates(
    params.children.map((child) => ({
      status: child.status,
      latestReviewDecision: child.latestReviewDecision,
      isStale: isChildAnalysisStale(child),
    })),
  );
  const blockedReasons = deriveMergedReportBlockedReasons(
    params.children.map((child) => ({
      status: child.status,
      latestReviewDecision: child.latestReviewDecision,
      isStale: isChildAnalysisStale(child),
    })),
  );

  const parsedProvenance = hasApprovedReport
    ? parseMergedReportProvenance(params.approvedReportProvenance)
    : { childAnalyses: [], isValid: true as const };
  const staleness =
    hasApprovedReport && !parsedProvenance.isValid
      ? {
          isStale: true,
          staleReason: parsedProvenance.invalidReason,
        }
      : hasApprovedReport
        ? deriveMergedReportStaleness({
            storedChildProvenance: parsedProvenance.childAnalyses,
            currentChildProvenance,
          })
        : { isStale: false };
  const mergedReportState = deriveMergedReportCapabilities({
    hasApprovedReport,
    isApprovedReportStale: staleness.isStale,
    canStartMergedReport: aggregates.runReadiness.canStartMergedReport,
    blockedReasons,
  });

  return {
    ...aggregates,
    storedChildProvenance: parsedProvenance.childAnalyses,
    currentChildProvenance,
    staleness,
    blockedReasons,
    mergedReportStatus: mergedReportState.mergedReportStatus,
    capabilities: mergedReportState.capabilities,
  };
}
