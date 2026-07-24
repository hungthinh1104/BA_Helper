import { DomainPackRegistry } from './domain-pack.registry';
import { AppError } from '@ba-helper/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('DomainPackRegistry', () => {
  let registry: DomainPackRegistry;

  beforeEach(() => {
    registry = new DomainPackRegistry();
  });

  describe('normalizePackId', () => {
    it('normalizes uppercase string', () => {
      expect(registry.normalizePackId('BOOKING')).toBe('booking');
    });

    it('normalizes padded string', () => {
      expect(registry.normalizePackId(' booking ')).toBe('booking');
    });

    it('strips version numbers', () => {
      expect(registry.normalizePackId('booking@0.1.0')).toBe('booking');
    });
  });

  describe('selectPack', () => {
    it('selects manual booking with selectedBy EXPLICIT', () => {
      const result = registry.selectPack({ manualPackId: 'booking' });
      expect(result.pack.id).toBe('booking');
      expect(result.pack.version).toBe('0.1.0');
      expect(result.pack.status).toBe('STABLE');
      expect(result.normalizedPackId).toBe('booking');
      expect(result.selectedBy).toBe('EXPLICIT');
      expect(result.resolved).toMatchObject({
        requestedDomainPackId: 'booking',
        resolvedDomainPackId: 'booking',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'STABLE',
        selectedBy: 'EXPLICIT',
      });
    });

    it('selects repository BOOKING with selectedBy REPOSITORY_PROFILE', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'BOOKING' });
      expect(result.pack.id).toBe('booking');
      expect(result.normalizedPackId).toBe('booking');
      expect(result.selectedBy).toBe('REPOSITORY_PROFILE');
    });

    it('requires explicit selection for repository RENTAL partial profile', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'RENTAL' });
      expect(result.pack.id).toBe('general');
      expect(result.selectedBy).toBe('FALLBACK');

      const explicit = registry.selectPack({ manualPackId: 'rental' });
      expect(explicit.pack.id).toBe('rental');
      expect(explicit.pack.version).toBe('0.1.0');
      expect(explicit.pack.status).toBe('PARTIAL');
      expect(explicit.normalizedPackId).toBe('rental');
      expect(explicit.selectedBy).toBe('EXPLICIT');
    });

    it('requires explicit selection for repository ECOMMERCE partial profile', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'ECOMMERCE' });
      expect(result.pack.id).toBe('general');
      expect(result.selectedBy).toBe('FALLBACK');

      const explicit = registry.selectPack({ manualPackId: 'ecommerce' });
      expect(explicit.pack.id).toBe('ecommerce');
      expect(explicit.pack.version).toBe('0.1.0');
      expect(explicit.pack.status).toBe('PARTIAL');
      expect(explicit.normalizedPackId).toBe('ecommerce');
      expect(explicit.selectedBy).toBe('EXPLICIT');
    });

    it('manual config overrides repository profile', () => {
      const result = registry.selectPack({
        manualPackId: 'booking',
        repositoryProfileDomain: 'UNKNOWN',
      });
      expect(result.pack.id).toBe('booking');
      expect(result.selectedBy).toBe('EXPLICIT');
    });

    it('undefined or null selects general@0.0.0 with FALLBACK', () => {
      const result1 = registry.selectPack({});
      expect(result1.pack.id).toBe('general');
      expect(result1.pack.status).toBe('FALLBACK');
      expect(result1.selectedBy).toBe('FALLBACK');

      const result2 = registry.selectPack({ manualPackId: null, repositoryProfileDomain: null });
      expect(result2.pack.id).toBe('general');
      expect(result2.selectedBy).toBe('FALLBACK');
    });

    it('UNKNOWN profile selects general@0.0.0', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'UNKNOWN' });
      expect(result.pack.id).toBe('general');
      expect(result.normalizedPackId).toBe('general');
      expect(result.selectedBy).toBe('FALLBACK');
    });

    it('unsupported or explicit-only repository profile selects general@0.0.0', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'HEALTHCARE' });
      expect(result.pack.id).toBe('general');
      expect(result.normalizedPackId).toBe('general'); // It falls back and normalizes the fallback ID
      expect(result.selectedBy).toBe('FALLBACK'); // Explicit-only partial packs do not auto-select from scanner profile.
    });

    it('manual healthcare alias resolves to healthcare@0.1.0', () => {
      const result = registry.selectPack({ manualPackId: 'HEALTHCARE' });
      expect(result.pack.id).toBe('healthcare');
      expect(result.pack.version).toBe('0.1.0');
      expect(result.pack.status).toBe('PARTIAL');
      expect(result.selectedBy).toBe('EXPLICIT');
      expect(result.resolved.requestedDomainPackId).toBe('healthcare');
    });

    it('manual versioned alias resolves to canonical requested domain id', () => {
      const result = registry.selectPack({ manualPackId: 'ECOMMERCE@0.1.0' });
      expect(result.pack.id).toBe('ecommerce');
      expect(result.pack.status).toBe('PARTIAL');
      expect(result.selectedBy).toBe('EXPLICIT');
      expect(result.resolved).toMatchObject({
        requestedDomainPackId: 'ecommerce',
        resolvedDomainPackId: 'ecommerce',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'PARTIAL',
      });
    });

    it('unsupported manual pack version throws controlled error', () => {
      expect(() => {
        registry.selectPack({ manualPackId: 'booking@9.9.9' });
      }).toThrow(AppError);
    });
  });

  describe('listProfiles', () => {
    it('exposes bounded profile registry entries with capability status', () => {
      const profiles = registry.listProfiles();

      expect(profiles).toEqual([
        expect.objectContaining({
          id: 'booking',
          version: '0.1.0',
          status: 'STABLE',
          glossaryMetadata: [
            { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 6 },
            { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 6 },
          ],
        }),
        expect.objectContaining({
          id: 'ecommerce',
          canonicalId: 'ecommerce@0.1.0',
          displayName: 'Ecommerce Order Fulfillment (PARTIAL)',
          version: '0.1.0',
          status: 'PARTIAL',
          requiresExplicitSelection: true,
          aliases: ['ecommerce', 'ecommerce@0.1.0'],
          glossaryMetadata: [
            { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 8 },
            { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 8 },
          ],
        }),
        expect.objectContaining({
          id: 'general',
          version: '0.0.0',
          status: 'FALLBACK',
          glossaryMetadata: [],
        }),
        expect.objectContaining({
          id: 'healthcare',
          canonicalId: 'healthcare@0.1.0',
          displayName: 'Healthcare Admin Workflows (PARTIAL)',
          version: '0.1.0',
          status: 'PARTIAL',
          requiresExplicitSelection: true,
          aliases: ['healthcare', 'healthcare@0.1.0'],
          glossaryMetadata: [
            { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 8 },
            { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 8 },
          ],
        }),
        expect.objectContaining({
          id: 'rental',
          version: '0.1.0',
          status: 'PARTIAL',
          glossaryMetadata: [
            { locale: 'en', status: 'foundation', version: '1.0.0', termCount: 9 },
            { locale: 'vi', status: 'foundation', version: '1.0.0', termCount: 9 },
          ],
        }),
      ]);
    });

    it('does not expose executable hints or templates in registry summaries', () => {
      const booking = registry.getProfileById('booking') as Record<string, unknown>;

      expect(booking.concepts).toBeUndefined();
      expect(booking.retrievalHints).toBeUndefined();
      expect(booking.riskTemplates).toBeUndefined();
      expect(booking.qaTemplates).toBeUndefined();
      expect(booking.unknownTemplates).toBeUndefined();
    });

    it('keeps glossary metadata term counts aligned with glossary assets', () => {
      for (const profile of registry.listProfiles()) {
        for (const metadata of profile.glossaryMetadata) {
          const glossary = readGlossary(profile.id, metadata.locale);

          expect(glossary.domain).toBe(profile.id);
          expect(glossary.locale).toBe(metadata.locale);
          expect(glossary.status).toBe(metadata.status);
          expect(glossary.version).toBe(metadata.version);
          expect(Object.keys(glossary.terms).length).toBe(metadata.termCount);
        }
      }
    });
  });
});

function readGlossary(
  domain: string,
  locale: string,
): {
  domain: string;
  locale: string;
  status: string;
  version: string;
  terms: Record<string, string>;
} {
  const file = resolve(
    process.cwd(),
    'packages/domain-packs',
    domain,
    `${locale}.glossary.json`,
  );
  return JSON.parse(readFileSync(file, 'utf-8'));
}
