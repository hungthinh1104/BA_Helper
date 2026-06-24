import { DomainPackRegistry } from '../../apps/api/src/modules/domain-pack/application/domain-pack.registry';
import { BookingDomainPack } from '../../apps/api/src/modules/domain-pack/packs/booking.v0.1.0';

describe('Domain Pack Concept Matching', () => {
  let registry: DomainPackRegistry;

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  describe('booking@0.1.0', () => {
    const pack = BookingDomainPack;

    it('is the only stable domain profile in the current registry', () => {
      expect(pack.status).toBe('STABLE');
      expect(pack.glossaryMetadata.map((item) => item.locale)).toEqual(['en', 'vi']);
    });

    it('"money back" maps to refund', () => {
      const keys = registry.matchConcepts('user wants their money back', pack);
      expect(keys).toContain('refund');
    });

    it('"refund" maps to refund', () => {
      const keys = registry.matchConcepts('issue a refund', pack);
      expect(keys).toContain('refund');
    });

    it('"cancel booking" maps to cancellation and booking', () => {
      const keys = registry.matchConcepts('cancel the booking', pack);
      expect(keys).toContain('cancellation');
      expect(keys).toContain('booking');
    });

    it('"payment callback retry" maps to payment', () => {
      const keys = registry.matchConcepts('payment callback retry idempotency', pack);
      expect(keys).toContain('payment');
    });

    it('aliases normalize deterministically regardless of case', () => {
      const keys1 = registry.matchConcepts('Refund the Payment', pack);
      const keys2 = registry.matchConcepts('refund the payment', pack);
      const keys3 = registry.matchConcepts('REFUND THE PAYMENT', pack);
      
      expect(keys1).toEqual(keys2);
      expect(keys2).toEqual(keys3);
      expect(keys1).toEqual(['payment', 'refund']);
    });

    it('concept ordering is deterministic (insertion order of pack concepts)', () => {
      // If we match multiple things, they should appear in the order defined in the pack
      const keys = registry.matchConcepts('user will cancel booking and request money back for payment', pack);
      expect(keys).toEqual(['booking', 'payment', 'refund', 'cancellation']); 
    });
  });

  describe('general@0.0.0 (fallback)', () => {
    it('general@0.0.0 has no booking-specific concepts/hints', () => {
      const pack = registry.getPackById('general');
      expect(pack.status).toBe('FALLBACK');
      expect(pack.concepts.length).toBe(0);
      expect(pack.retrievalHints.length).toBe(0);

      const keys = registry.matchConcepts('cancel the booking and refund payment', pack);
      expect(keys).toEqual([]);
    });

    it('unknown/no domain does not fallback to booking', () => {
      const pack1 = registry.selectForRepository(null);
      const pack2 = registry.selectForRepository(undefined);
      const pack3 = registry.selectForRepository('UNKNOWN');
      const pack4 = registry.selectForRepository('HEALTHCARE');

      expect(pack1.id).toBe('general');
      expect(pack2.id).toBe('general');
      expect(pack3.id).toBe('general');
      expect(pack4.id).toBe('general');
    });
  });
});
