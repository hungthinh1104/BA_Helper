import { mapTraceabilityList } from '../../apps/api/src/modules/traceability/api/traceability.mapper';

describe('Traceability list mapping', () => {
  it('maps evidence fields to contract shape', () => {
    const result = mapTraceabilityList([
      {
        id: 'link-1',
        artifactId: 'a3',
        artifact: {
          name: 'PaymentService.refund',
          artifactKey: 'service-method:payment.service.refund',
          filePath: 'src/payment/payment.service.ts',
          universalKind: 'DOMAIN_SERVICE',
        },
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
              artifactId: 'a3',
              artifact: {
                artifactKey: 'service-method:payment.service.refund',
              },
            },
          },
        ],
      },
    ]);

    expect(result).toEqual([
      {
        id: 'link-1',
        artifactId: 'a3',
        artifactName: 'PaymentService.refund',
        artifactKey: 'service-method:payment.service.refund',
        filePath: 'src/payment/payment.service.ts',
        universalKind: 'DOMAIN_SERVICE',
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
            artifactId: 'a3',
            artifactKey: 'service-method:payment.service.refund',
          },
        ],
      },
    ]);
  });
});
