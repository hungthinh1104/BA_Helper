import { mapEvidenceList } from '../../apps/api/src/modules/evidence/api/evidence.mapper';

describe('Evidence list mapping', () => {
  it('maps evidence fields to contract shape', () => {
    const result = mapEvidenceList([
      {
        id: 'ev-1',
        sourceType: 'CODE',
        sourcePath: 'src/payment/payment.service.ts',
        startLine: 6,
        endLine: 10,
        excerpt: 'src/payment/payment.service.ts:6-10 (PaymentService.refund)',
      },
    ]);

    expect(result).toEqual([
      {
        id: 'ev-1',
        sourceType: 'CODE',
        filePath: 'src/payment/payment.service.ts',
        startLine: 6,
        endLine: 10,
        excerpt: 'src/payment/payment.service.ts:6-10 (PaymentService.refund)',
      },
    ]);
  });
});
