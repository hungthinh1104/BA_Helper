import { EvidencePackFormatter } from './evidence-pack.formatter';

describe('EvidencePackFormatter', () => {
  it('wraps repository content with untrusted content fences', () => {
    const formatted = EvidencePackFormatter.format([
      {
        artifactKey: 'service-method:booking.service.cancelBooking',
        symbolName: 'BookingService.cancelBooking',
        filePath: 'src/booking/booking.service.ts',
        artifactType: 'SERVICE_METHOD',
        excerpt: 'return this.paymentService.refund();',
        retrievalMethod: 'LEXICAL',
      },
    ]);

    expect(formatted).toContain('UNTRUSTED_REPOSITORY_CONTENT_START');
    expect(formatted).toContain('UNTRUSTED_REPOSITORY_CONTENT_END');
    expect(formatted).toContain('artifactKey: service-method:booking.service.cancelBooking');
  });
});
