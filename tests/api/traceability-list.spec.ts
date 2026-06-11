import { mapTraceabilityList } from '../../apps/api/src/modules/traceability/api/traceability.mapper';

describe('Traceability list mapping', () => {
  it('maps evidence fields to contract shape', () => {
    const result = mapTraceabilityList([
      {
        id: 'link-1',
        artifactId: 'a3',
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
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
        id: 'link-1',
        artifactId: 'a3',
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
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
