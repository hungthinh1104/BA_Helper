import { buildReportReviewCoverageSummary, buildReportReviewCoverageSummaryFromSnapshot, EvidenceQualityItem, EvidenceQualitySummary } from "@ba-helper/backend-runtime";

describe('buildReportReviewCoverageSummary', () => {
  it('counts reviewed and unreviewed insights, traceability decisions, and evidence quality buckets', () => {
    const items: EvidenceQualityItem[] = [
      insight('i1', 'CONFIRMED', 'STRONG_SOURCE_EVIDENCE'),
      insight('i2', 'NEEDS_REVIEW', 'REVIEW_REQUIRED'),
      insight('i3', 'REJECTED', 'CONFLICTING_EVIDENCE'),
      link('l1', 'ACCEPTED', 'STRONG_SOURCE_EVIDENCE'),
      link('l2', 'REJECTED', 'WEAK_SOURCE_EVIDENCE'),
      link('l3', 'NEEDS_MORE_EVIDENCE', 'MISSING_EVIDENCE'),
      link('l4', null, 'REVIEW_REQUIRED'),
    ];

    const summary = buildReportReviewCoverageSummary({
      items,
      evidenceQualitySummary: qualitySummary({
        strongSourceEvidence: 2,
        weakSourceEvidence: 1,
        missingEvidence: 1,
        conflictingEvidence: 1,
        reviewRequired: 2,
      }),
    });

    expect(summary.insights).toEqual({
      total: 3,
      reviewed: 2,
      unreviewed: 1,
      confirmed: 1,
      rejected: 1,
      needsReview: 1,
    });
    expect(summary.traceabilityLinks).toEqual({
      total: 4,
      reviewed: 3,
      unreviewed: 1,
      accepted: 1,
      rejected: 1,
      needsReview: 0,
      needsMoreEvidence: 1,
    });
    expect(summary.decisions).toEqual({
      accepted: 2,
      rejected: 2,
      needsReview: 1,
      needsMoreEvidence: 1,
      needsClarification: 4,
      unreviewed: 2,
    });
    expect(summary.evidence).toEqual({
      strong: 2,
      weak: 1,
      missing: 1,
      conflicting: 1,
      reviewRequired: 2,
    });
  });

  it('reads legacy evidence quality aliases from reviewed snapshots', () => {
    const summary = buildReportReviewCoverageSummaryFromSnapshot({
      reviewDecisionsSnapshot: [
        insight('i1', 'CONFIRMED', 'STRONG_SOURCE_EVIDENCE'),
        link('l1', 'ACCEPTED', 'STRONG_SOURCE_EVIDENCE'),
      ],
      evidenceQualitySummarySnapshot: {
        evidenced: 1,
        weakEvidence: 2,
        missingEvidence: 3,
        reviewRequired: 4,
      },
    });

    expect(summary.insights.reviewed).toBe(1);
    expect(summary.traceabilityLinks.reviewed).toBe(1);
    expect(summary.evidence.strong).toBe(1);
    expect(summary.evidence.weak).toBe(2);
    expect(summary.evidence.missing).toBe(3);
    expect(summary.evidence.reviewRequired).toBe(4);
  });
});

function insight(
  id: string,
  reviewStatus: string,
  quality: EvidenceQualityItem['quality'],
): EvidenceQualityItem {
  return {
    itemType: 'INSIGHT',
    itemId: id,
    insightId: id,
    artifact: `Insight ${id}`,
    quality,
    reasons: [],
    reviewStatus,
    reviewDecision: null,
  };
}

function link(
  id: string,
  decision: string | null,
  quality: EvidenceQualityItem['quality'],
): EvidenceQualityItem {
  return {
    itemType: 'TRACEABILITY_LINK',
    itemId: id,
    linkId: id,
    artifact: `src/${id}.ts`,
    quality,
    reasons: [],
    reviewStatus: decision === 'ACCEPTED' ? 'CONFIRMED' : 'NEEDS_REVIEW',
    reviewDecision: decision
      ? {
          id: `decision-${id}`,
          analysisId: 'analysis-1',
          traceabilityLinkId: id,
          decision,
          reviewedAt: new Date().toISOString(),
        }
      : null,
  };
}

function qualitySummary(
  overrides: Partial<EvidenceQualitySummary>,
): Partial<EvidenceQualitySummary> {
  return overrides;
}
