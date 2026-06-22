import { rest } from 'msw';

export const handlers = [
  // Fallback handlers. Specific tests will override these using server.use()
  rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/review-completion', (req, res, ctx) => {
    return res(
      ctx.json({
        analysisId: 'test-analysis-id',
        isComplete: false,
        totalLinks: 0,
        accepted: 0,
        rejected: 0,
        needsReview: 0,
        needsMoreEvidence: 0,
        unreviewed: 0,
        hasReviewedSnapshot: false,
        blockingReasons: [],
      })
    );
  }),
  
  rest.get('http://localhost:3000/api/v1/impact-analyses/:analysisId/final-reviewed-report', (req, res, ctx) => {
    return res(
      ctx.json({
        analysisId: 'test-analysis-id',
        snapshotId: 'test-snapshot-id',
        markdown: '# Default Test Report',
        createdAt: new Date().toISOString(),
        reviewCompletion: {
          analysisId: 'test-analysis-id',
          isComplete: true,
          totalLinks: 0,
          accepted: 0,
          rejected: 0,
          needsReview: 0,
          needsMoreEvidence: 0,
          unreviewed: 0,
          hasReviewedSnapshot: true,
          blockingReasons: [],
        },
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {},
        evaluationContextSnapshot: null,
        createdByUserId: null,
      })
    );
  }),
];
