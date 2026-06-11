/**
 * Domain Profile Registry — Unit Tests (Phase 26A)
 *
 * Covers:
 * 1. Known domain profiles load correctly.
 * 2. Unknown/unrecognized domain falls back to UNKNOWN (no throw).
 * 3. Missing/empty domain falls back to BOOKING (MVP default).
 * 4. getDomainGlossary returns non-empty arrays for all known profiles.
 * 5. matchDomainTerms is deterministic and bounded.
 * 6. Domain terms do not hard-filter artifacts — soft lexical hints only.
 * 7. isDomainSupported returns correct truthy/falsy values.
 */
import {
  getDomainProfile,
  getDomainGlossary,
  matchDomainTerms,
  isDomainSupported,
  SUPPORTED_DOMAINS,
} from './index';

describe('DomainProfileRegistry', () => {
  describe('getDomainProfile', () => {
    it('returns BOOKING profile for BOOKING domain', () => {
      const profile = getDomainProfile('BOOKING');
      expect(profile.domain).toBe('BOOKING');
      expect(profile.glossary.length).toBeGreaterThan(0);
      expect(profile.riskCategories.length).toBeGreaterThan(0);
      expect(profile.qaScenarioTemplates.length).toBeGreaterThan(0);
    });

    it('returns PAYMENT profile for PAYMENT domain', () => {
      const profile = getDomainProfile('PAYMENT');
      expect(profile.domain).toBe('PAYMENT');
      expect(profile.glossary).toContain('payment');
      expect(profile.riskCategories.some((r) => r.toLowerCase().includes('duplicate'))).toBe(true);
    });

    it('returns REFUND profile for REFUND domain', () => {
      const profile = getDomainProfile('REFUND');
      expect(profile.domain).toBe('REFUND');
      expect(profile.glossary).toContain('refund');
    });

    it('returns NOTIFICATION profile for NOTIFICATION domain', () => {
      const profile = getDomainProfile('NOTIFICATION');
      expect(profile.domain).toBe('NOTIFICATION');
      expect(profile.glossary).toContain('notification');
    });

    it('returns UNKNOWN fallback profile for unrecognized domain — no throw', () => {
      const profile = getDomainProfile('LEDGER');
      expect(profile.domain).toBe('UNKNOWN');
      expect(profile.glossary.length).toBeGreaterThan(0);
      expect(profile.riskCategories.length).toBeGreaterThan(0);
    });

    it('returns UNKNOWN fallback for domain key "UNKNOWN"', () => {
      const profile = getDomainProfile('UNKNOWN');
      expect(profile.domain).toBe('UNKNOWN');
    });

    it('returns BOOKING profile for undefined domain (MVP default)', () => {
      const profile = getDomainProfile(undefined);
      expect(profile.domain).toBe('BOOKING');
    });

    it('returns BOOKING profile for empty string domain (MVP default)', () => {
      const profile = getDomainProfile('');
      expect(profile.domain).toBe('BOOKING');
    });

    it('returns BOOKING profile for null domain (MVP default)', () => {
      const profile = getDomainProfile(null as unknown as undefined);
      expect(profile.domain).toBe('BOOKING');
    });

    it('all SUPPORTED_DOMAINS have complete profiles', () => {
      for (const domain of SUPPORTED_DOMAINS) {
        const profile = getDomainProfile(domain);
        expect(profile.domain).toBe(domain);
        expect(profile.glossary.length).toBeGreaterThan(0);
        expect(profile.riskCategories.length).toBeGreaterThan(0);
        expect(profile.qaScenarioTemplates.length).toBeGreaterThan(0);
        expect(profile.promptContext.length).toBeGreaterThan(0);
        expect(profile.reportSections.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getDomainGlossary', () => {
    it('returns glossary for BOOKING', () => {
      const glossary = getDomainGlossary('BOOKING');
      expect(glossary).toContain('booking');
      expect(glossary).toContain('refund');
    });

    it('returns glossary for PAYMENT', () => {
      const glossary = getDomainGlossary('PAYMENT');
      expect(glossary).toContain('payment');
      expect(glossary).toContain('charge');
    });

    it('returns UNKNOWN glossary (minimal) for unrecognized domain — no throw', () => {
      const glossary = getDomainGlossary('TOTALLY_UNKNOWN');
      expect(Array.isArray(glossary)).toBe(true);
      expect(glossary.length).toBeGreaterThan(0);
    });

    it('returns BOOKING glossary for undefined domain (MVP default)', () => {
      const glossary = getDomainGlossary(undefined);
      expect(glossary).toContain('booking');
    });
  });

  describe('matchDomainTerms', () => {
    it('matches payment glossary terms in a payment change request', () => {
      const text = 'Allow users to retry a failed payment and receive a refund after cancellation.';
      const terms = matchDomainTerms(text, 'PAYMENT');
      expect(terms).toContain('payment');
      expect(terms).toContain('refund');
      expect(terms).toContain('failed');
    });

    it('returns empty array when text has no domain matches', () => {
      const text = 'Restructure logging infrastructure for improved traceability.';
      const terms = matchDomainTerms(text, 'PAYMENT');
      expect(terms.length).toBe(0);
    });

    it('is case-insensitive', () => {
      const text = 'PAYMENT failed due to REFUND gateway error.';
      const terms = matchDomainTerms(text, 'PAYMENT');
      expect(terms.length).toBeGreaterThan(0);
    });

    it('is deterministic — same input always returns same output', () => {
      const text = 'Cancel a booking and trigger a refund.';
      const first = matchDomainTerms(text, 'BOOKING');
      const second = matchDomainTerms(text, 'BOOKING');
      expect(first).toEqual(second);
    });

    it('returns at most all glossary terms (bounded)', () => {
      const text = Array.from({ length: 200 }, (_, i) => `term${i}`).join(' ');
      const terms = matchDomainTerms(text, 'BOOKING');
      // All returned terms must be actual glossary entries
      const glossary = getDomainGlossary('BOOKING');
      for (const term of terms) {
        expect(glossary).toContain(term);
      }
    });

    it('is safe for UNKNOWN domain — no throw', () => {
      expect(() => matchDomainTerms('some text', 'UNRECOGNIZED')).not.toThrow();
    });
  });

  describe('isDomainSupported', () => {
    it('returns true for all SUPPORTED_DOMAINS', () => {
      for (const domain of SUPPORTED_DOMAINS) {
        expect(isDomainSupported(domain)).toBe(true);
      }
    });

    it('returns false for UNKNOWN domain key', () => {
      expect(isDomainSupported('UNKNOWN')).toBe(false);
    });

    it('returns false for unrecognized domain key', () => {
      expect(isDomainSupported('LEDGER')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isDomainSupported(undefined)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isDomainSupported('')).toBe(false);
    });
  });

  describe('UNKNOWN fallback does not hard-filter or bias results', () => {
    it('UNKNOWN glossary terms are minimal — does not overboost generic artifacts', () => {
      const unknownGlossary = getDomainGlossary('UNKNOWN');
      // Intentionally small — should not contain highly specific domain terms
      const highlyCoupled = ['booking', 'payment', 'refund', 'invoice', 'transaction', 'charge'];
      for (const term of highlyCoupled) {
        expect(unknownGlossary).not.toContain(term);
      }
    });

    it('domain boost uses UNKNOWN fallback for unrecognized domain and does not inject domain-specific terms', () => {
      // LEDGER → UNKNOWN fallback. UNKNOWN glossary must NOT contain payment/booking-specific terms.
      // Even if generic text partially matches UNKNOWN glossary (e.g. 'service', 'state'),
      // it must never match highly specific domain vocabulary from other domains.
      const paymentSpecificText =
        'Retry the failed payment capture and reconcile the invoice with the acquirer.';
      const terms = matchDomainTerms(paymentSpecificText, 'LEDGER');
      const domainSpecific = ['payment', 'charge', 'refund', 'invoice', 'booking', 'transaction', 'capture'];
      for (const term of domainSpecific) {
        expect(terms).not.toContain(term);
      }
    });
  });
});
