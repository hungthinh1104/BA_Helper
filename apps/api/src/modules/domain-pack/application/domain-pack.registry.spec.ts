import { describe, it, expect, beforeEach } from '@jest/globals';
import { DomainPackRegistry } from './domain-pack.registry';
import { GeneralDomainPack } from '../packs/general.v0.0.0';
import { BookingDomainPack } from '../packs/booking.v0.1.0';

describe('DomainPackRegistry', () => {
  let registry: DomainPackRegistry;

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  describe('getPackById', () => {
    it('returns the booking pack when requesting "booking"', () => {
      const pack = registry.getPackById('booking');
      expect(pack).toBeDefined();
      expect(pack.id).toBe('booking');
      expect(pack.version).toBe('0.1.0');
    });

    it('returns the booking pack case-insensitively (e.g. "BOOKING")', () => {
      const pack = registry.getPackById('BOOKING');
      expect(pack.id).toBe('booking');
    });

    it('returns the general default pack for unknown ids', () => {
      const pack = registry.getPackById('unknown-domain-xyz');
      expect(pack.id).toBe('general');
      expect(pack.version).toBe('0.0.0');
    });

    it('returns the general default pack when requesting with null/undefined', () => {
      expect(registry.getPackById(null).id).toBe('general');
      expect(registry.getPackById(undefined).id).toBe('general');
    });
  });

  describe('selectForRepository', () => {
    it('selects booking pack for a repository with domain "booking"', () => {
      const pack = registry.selectForRepository('booking');
      expect(pack).toBe(BookingDomainPack);
    });

    it('selects booking pack for a repository with domain "BOOKING"', () => {
      const pack = registry.selectForRepository('BOOKING');
      expect(pack).toBe(BookingDomainPack);
    });

    it('returns general pack for UNKNOWN domain', () => {
      const pack = registry.selectForRepository('UNKNOWN');
      expect(pack).toBe(GeneralDomainPack);
    });

    it('returns general pack for missing domain', () => {
      const pack = registry.selectForRepository(null);
      expect(pack).toBe(GeneralDomainPack);
    });
  });

  describe('built-in packs determinism', () => {
    it('booking pack concepts aliases normalize correctly', () => {
      const bookingPack = registry.getPackById('booking');
      const refundConcept = bookingPack.concepts.find(c => c.key === 'refund');
      
      expect(refundConcept).toBeDefined();
      expect(refundConcept?.aliases).toContain('refund');
      expect(refundConcept?.aliases).toContain('money back');
    });

    it('packs do not create empty templates by mistake', () => {
      const bookingPack = registry.getPackById('booking');
      expect(bookingPack.qaTemplates.length).toBeGreaterThan(0);
      expect(bookingPack.riskTemplates.length).toBeGreaterThan(0);
      expect(bookingPack.unknownTemplates.length).toBeGreaterThan(0);
    });
  });
});
