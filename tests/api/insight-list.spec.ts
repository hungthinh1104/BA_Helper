import { mapInsightList } from '../../apps/api/src/modules/insight/api/insight.mapper';

describe('Insight list mapping', () => {
  it('maps evidence fields to contract shape', () => {
    const result = mapInsightList([
      {
        id: 'ins-1',
        insightType: 'CLAIM',
        description: 'Cancellation triggers a refund operation.',
        certainty: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 1,
        evidenceLinks: [
          {
            evidence: {
              id: 'ev-1',
              sourceType: 'CODE',
              sourcePath: 'src/payment/payment.service.ts',
              startLine: 6,
              endLine: 10,
              excerpt:
                'src/payment/payment.service.ts:6-10 (PaymentService.refund)',
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        id: 'ins-1',
        category: 'CLAIM',
        statement: 'Cancellation triggers a refund operation.',
        certainty: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 1,
        evidence: [
          {
            id: 'ev-1',
            sourceType: 'CODE',
            filePath: 'src/payment/payment.service.ts',
            startLine: 6,
            endLine: 10,
            excerpt: 'src/payment/payment.service.ts:6-10 (PaymentService.refund)',
          },
        ],
      },
    ]);
  });
});
