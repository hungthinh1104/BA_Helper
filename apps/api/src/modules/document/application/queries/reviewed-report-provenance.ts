import { AppError } from '@ba-helper/shared';
import {
  evaluationContextSnapshotSchema,
  reviewedReportQualitySnapshotSchema,
} from '@ba-helper/contracts';

export function parseFrozenReportContent(snapshot: {
  id: string;
  reviewDecisionsSnapshot: unknown;
  evidenceQualitySummarySnapshot: unknown;
  evaluationContextSnapshot: unknown;
}) {
  const qualitySnapshot = reviewedReportQualitySnapshotSchema.safeParse({
    reviewDecisionsSnapshot: snapshot.reviewDecisionsSnapshot,
    evidenceQualitySummarySnapshot: snapshot.evidenceQualitySummarySnapshot,
  });
  const evaluationContext = evaluationContextSnapshotSchema.safeParse(
    snapshot.evaluationContextSnapshot,
  );
  if (!qualitySnapshot.success || !evaluationContext.success) {
    throw new AppError(
      'REPORT_PROVENANCE_MISMATCH',
      'The frozen report snapshot contains data outside its response contract.',
      { reportSnapshotId: snapshot.id },
    );
  }
  return {
    reviewDecisionsSnapshot: qualitySnapshot.data.reviewDecisionsSnapshot,
    evidenceQualitySummarySnapshot: qualitySnapshot.data.evidenceQualitySummarySnapshot,
    evaluationContextSnapshot: evaluationContext.data,
  };
}

export function findReviewCompletionMismatches(
  completion: {
    totalLinks: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    needsMoreEvidence: number;
    unreviewed: number;
  },
  snapshot: {
    total: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    needsMoreEvidence: number;
    unreviewed: number;
  },
): string[] {
  const fields = [
    ['totalLinks', completion.totalLinks, snapshot.total],
    ['accepted', completion.accepted, snapshot.accepted],
    ['rejected', completion.rejected, snapshot.rejected],
    ['needsReview', completion.needsReview, snapshot.needsReview],
    ['needsMoreEvidence', completion.needsMoreEvidence, snapshot.needsMoreEvidence],
    ['unreviewed', completion.unreviewed, snapshot.unreviewed],
  ] as const;
  return fields
    .filter(([, liveCount, snapshotCount]) => liveCount !== snapshotCount)
    .map(([field]) => field);
}

export function reviewDecisionStatesMatch(live: unknown[], frozen: unknown[]): boolean {
  const canonicalize = (items: unknown[]) => items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const value = item as Record<string, unknown>;
      const itemType = value.itemType ?? (value.linkId ? 'TRACEABILITY_LINK' : value.insightId ? 'INSIGHT' : null);
      const itemId = value.itemId ?? value.linkId ?? value.insightId;
      if (typeof itemType !== 'string' || typeof itemId !== 'string') return null;
      const decision = value.reviewDecision && typeof value.reviewDecision === 'object'
        ? value.reviewDecision as Record<string, unknown>
        : null;
      return {
        key: `${itemType}:${itemId}`,
        reviewStatus: value.reviewStatus ?? null,
        reviewDecision: decision ? {
          id: decision.id ?? null,
          analysisId: decision.analysisId ?? null,
          traceabilityLinkId: decision.traceabilityLinkId ?? null,
          decision: decision.decision ?? null,
          note: decision.note ?? null,
          reviewedByUserId: decision.reviewedByUserId ?? null,
          reviewedAt: decision.reviewedAt ?? null,
        } : null,
      };
    })
    .sort((left, right) => {
      const leftKey = left?.key ?? '';
      const rightKey = right?.key ?? '';
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });

  const liveState = canonicalize(live);
  const frozenState = canonicalize(frozen);
  return liveState.every((item) => item !== null) &&
    frozenState.every((item) => item !== null) &&
    JSON.stringify(liveState) === JSON.stringify(frozenState);
}
