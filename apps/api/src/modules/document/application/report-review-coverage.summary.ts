import type {
  EvidenceQualityItem,
  EvidenceQualitySummary,
} from './evidence-quality.types';

export type ReportReviewCoverageSummary = {
  insights: {
    total: number;
    reviewed: number;
    unreviewed: number;
    confirmed: number;
    rejected: number;
    needsReview: number;
  };
  traceabilityLinks: {
    total: number;
    reviewed: number;
    unreviewed: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    needsMoreEvidence: number;
  };
  decisions: {
    accepted: number;
    rejected: number;
    needsReview: number;
    needsMoreEvidence: number;
    needsClarification: number;
    unreviewed: number;
  };
  evidence: {
    strong: number;
    weak: number;
    missing: number;
    conflicting: number;
    reviewRequired: number;
  };
};

export function buildReportReviewCoverageSummary(params: {
  items: EvidenceQualityItem[];
  evidenceQualitySummary?: Partial<EvidenceQualitySummary> | null;
}): ReportReviewCoverageSummary {
  const insightItems = params.items.filter((item) => item.itemType === 'INSIGHT');
  const linkItems = params.items.filter((item) => item.itemType !== 'INSIGHT');

  const insightConfirmed = insightItems.filter((item) => item.reviewStatus === 'CONFIRMED').length;
  const insightRejected = insightItems.filter((item) => item.reviewStatus === 'REJECTED').length;
  const insightNeedsReview = insightItems.filter((item) => item.reviewStatus === 'NEEDS_REVIEW').length;
  const insightReviewed = insightConfirmed + insightRejected;
  const insightUnreviewed = Math.max(0, insightItems.length - insightReviewed);

  const linkAccepted = linkItems.filter((item) => readDecision(item) === 'ACCEPTED').length;
  const linkRejected = linkItems.filter((item) => readDecision(item) === 'REJECTED').length;
  const linkNeedsReview = linkItems.filter((item) => readDecision(item) === 'NEEDS_REVIEW').length;
  const linkNeedsMoreEvidence = linkItems
    .filter((item) => readDecision(item) === 'NEEDS_MORE_EVIDENCE').length;
  const linkReviewed = linkAccepted + linkRejected + linkNeedsReview + linkNeedsMoreEvidence;
  const linkUnreviewed = Math.max(0, linkItems.length - linkReviewed);

  const accepted = insightConfirmed + linkAccepted;
  const rejected = insightRejected + linkRejected;
  const needsReview = insightNeedsReview + linkNeedsReview;
  const needsMoreEvidence = linkNeedsMoreEvidence;
  const unreviewed = insightUnreviewed + linkUnreviewed;

  return {
    insights: {
      total: insightItems.length,
      reviewed: insightReviewed,
      unreviewed: insightUnreviewed,
      confirmed: insightConfirmed,
      rejected: insightRejected,
      needsReview: insightNeedsReview,
    },
    traceabilityLinks: {
      total: linkItems.length,
      reviewed: linkReviewed,
      unreviewed: linkUnreviewed,
      accepted: linkAccepted,
      rejected: linkRejected,
      needsReview: linkNeedsReview,
      needsMoreEvidence: linkNeedsMoreEvidence,
    },
    decisions: {
      accepted,
      rejected,
      needsReview,
      needsMoreEvidence,
      needsClarification: needsReview + needsMoreEvidence + unreviewed,
      unreviewed,
    },
    evidence: {
      strong: readQualityCount(params.evidenceQualitySummary, 'strongSourceEvidence', 'STRONG_SOURCE_EVIDENCE', 'evidenced'),
      weak: readQualityCount(params.evidenceQualitySummary, 'weakSourceEvidence', 'WEAK_SOURCE_EVIDENCE', 'weakEvidence'),
      missing: readQualityCount(params.evidenceQualitySummary, 'missingEvidence', 'MISSING_EVIDENCE'),
      conflicting: readQualityCount(params.evidenceQualitySummary, 'conflictingEvidence', 'CONFLICTING_EVIDENCE'),
      reviewRequired: readQualityCount(params.evidenceQualitySummary, 'reviewRequired', 'REVIEW_REQUIRED'),
    },
  };
}

export function buildReportReviewCoverageSummaryFromSnapshot(params: {
  reviewDecisionsSnapshot: unknown;
  evidenceQualitySummarySnapshot: unknown;
}): ReportReviewCoverageSummary {
  return buildReportReviewCoverageSummary({
    items: Array.isArray(params.reviewDecisionsSnapshot)
      ? params.reviewDecisionsSnapshot.filter(isEvidenceQualityItem)
      : [],
    evidenceQualitySummary: isRecord(params.evidenceQualitySummarySnapshot)
      ? params.evidenceQualitySummarySnapshot as Partial<EvidenceQualitySummary>
      : null,
  });
}

function readDecision(item: EvidenceQualityItem): string | null {
  const decision = item.reviewDecision;
  if (!isRecord(decision)) {
    return null;
  }
  return typeof decision.decision === 'string' ? decision.decision : null;
}

function readQualityCount(
  summary: Partial<EvidenceQualitySummary> | null | undefined,
  ...keys: Array<keyof EvidenceQualitySummary>
): number {
  if (!summary) return 0;
  for (const key of keys) {
    const value = summary[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
  }
  return 0;
}

function isEvidenceQualityItem(value: unknown): value is EvidenceQualityItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.artifact === 'string' &&
    typeof value.quality === 'string' &&
    Array.isArray(value.reasons)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
