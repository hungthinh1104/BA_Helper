type StoredChildProvenance = {
  analysisId: string;
  latestReviewDecisionId: string;
  snapshotId: string;
  commitSha: string;
};

type CurrentChildProvenance = {
  analysisId: string;
  latestReviewDecisionId: string | null;
  snapshotId: string;
  commitSha: string;
  status: string;
  isStale?: boolean;
};

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
