import {
  finalReviewedReportResponseSchema,
  localeAwareReportQuerySchema,
  reviewCompletionResponseSchema,
  type FinalReviewedReportResponse,
} from './src';

describe('review report locale contracts', () => {
  it('defaults report locale to English', () => {
    expect(localeAwareReportQuerySchema.parse({})).toEqual({ locale: 'en' });
  });

  it('accepts explicit Vietnamese locale', () => {
    expect(localeAwareReportQuerySchema.parse({ locale: 'vi-VN' })).toEqual({ locale: 'vi-VN' });
  });

  it('rejects unsupported locales', () => {
    expect(() => localeAwareReportQuerySchema.parse({ locale: 'fr' })).toThrow();
  });

  it('includes the selected locale in final reviewed report responses', () => {
    const payload: FinalReviewedReportResponse = {
      analysisId: 'analysis-1',
      snapshotId: 'snapshot-1',
      locale: 'vi-VN',
      markdown: '# Báo cáo phân tích tác động',
      createdAt: '2026-06-25T00:00:00.000Z',
      reviewCompletion: {
        analysisId: 'analysis-1',
        totalLinks: 1,
        accepted: 1,
        rejected: 0,
        needsReview: 0,
        needsMoreEvidence: 0,
        unreviewed: 0,
        isComplete: true,
        hasReviewedSnapshot: true,
        latestSnapshotId: 'snapshot-1',
        blockingReasons: [],
      },
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: {},
      evaluationContextSnapshot: null,
      createdByUserId: null,
    };

    expect(finalReviewedReportResponseSchema.parse(payload)).toEqual(payload);
  });

  it('accepts backend-authored critical approval blocking reasons', () => {
    const payload = {
      analysisId: 'analysis-1',
      totalLinks: 1,
      accepted: 0,
      rejected: 0,
      needsReview: 0,
      needsMoreEvidence: 0,
      unreviewed: 1,
      isComplete: false,
      hasReviewedSnapshot: false,
      latestSnapshotId: null,
      blockingReasons: [
        'UNREVIEWED_TRACEABILITY_LINKS',
        'CONFLICTING_EVIDENCE_UNREVIEWED',
        'CRITICAL_MISSING_EVIDENCE',
        'REVIEW_REQUIRED_ITEMS',
        'HIGH_RISK_INSIGHT_UNREVIEWED',
      ],
    };

    expect(reviewCompletionResponseSchema.parse(payload)).toEqual(payload);
  });
});
