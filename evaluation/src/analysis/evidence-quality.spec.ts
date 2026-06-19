import {
  isCodeLikeEvidence,
  isLocationOnlyEvidence,
  summarizeEvidenceQuality,
} from '../analysis/evidence-quality';

describe('evidence-quality helpers', () => {
  it('handles an empty excerpt', () => {
    expect(summarizeEvidenceQuality()).toEqual({
      hasEvidence: false,
      excerptLength: 0,
      excerptPreview: '',
      isLocationOnly: false,
      isCodeLike: false,
    });
  });

  it('detects location-only evidence', () => {
    const excerpt = 'src/foo.ts:10-20 (SomeService.method)';

    expect(isLocationOnlyEvidence(excerpt)).toBe(true);
    expect(isCodeLikeEvidence(excerpt)).toBe(false);
  });

  it('detects a TypeScript method body as code-like', () => {
    const excerpt = `
      async cancelBooking(id: string) {
        const booking = await this.repository.findById(id);
        if (!booking) throw new Error('missing');
        return booking;
      }
    `;

    expect(isLocationOnlyEvidence(excerpt)).toBe(false);
    expect(isCodeLikeEvidence(excerpt)).toBe(true);
  });

  it('detects a NestJS decorator excerpt as code-like', () => {
    const excerpt = `
      @Controller('bookings')
      export class BookingController {
        @Post(':id/cancel')
        async cancel() {
          return this.service.cancel();
        }
      }
    `;

    expect(isLocationOnlyEvidence(excerpt)).toBe(false);
    expect(isCodeLikeEvidence(excerpt)).toBe(true);
  });

  it('detects a Jest test excerpt as code-like', () => {
    const excerpt = `
      describe('refund flow', () => {
        it('prevents double refunds', () => {
          expect(result).toBeDefined();
        });
      });
    `;

    expect(isLocationOnlyEvidence(excerpt)).toBe(false);
    expect(isCodeLikeEvidence(excerpt)).toBe(true);
  });
});
