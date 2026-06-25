import { DomainPackRegistry } from './domain-pack.registry';
import { AppError } from '@ba-helper/shared';

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
    it('selects manual booking with selectedBy manual_config', () => {
      const result = registry.selectPack({ manualPackId: 'booking' });
      expect(result.pack.id).toBe('booking');
      expect(result.pack.version).toBe('0.1.0');
      expect(result.pack.status).toBe('STABLE');
      expect(result.normalizedPackId).toBe('booking');
      expect(result.selectedBy).toBe('manual_config');
    });

    it('selects repository BOOKING with selectedBy repository_profile', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'BOOKING' });
      expect(result.pack.id).toBe('booking');
      expect(result.normalizedPackId).toBe('booking');
      expect(result.selectedBy).toBe('repository_profile');
    });

    it('selects repository RENTAL as rental@0.1.0 PARTIAL', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'RENTAL' });
      expect(result.pack.id).toBe('rental');
      expect(result.pack.version).toBe('0.1.0');
      expect(result.pack.status).toBe('PARTIAL');
      expect(result.normalizedPackId).toBe('rental');
      expect(result.selectedBy).toBe('repository_profile');
    });

    it('manual config overrides repository profile', () => {
      const result = registry.selectPack({
        manualPackId: 'booking',
        repositoryProfileDomain: 'UNKNOWN',
      });
      expect(result.pack.id).toBe('booking');
      expect(result.selectedBy).toBe('manual_config');
    });

    it('undefined or null selects general@0.0.0 with safe_default', () => {
      const result1 = registry.selectPack({});
      expect(result1.pack.id).toBe('general');
      expect(result1.pack.status).toBe('FALLBACK');
      expect(result1.selectedBy).toBe('safe_default');

      const result2 = registry.selectPack({ manualPackId: null, repositoryProfileDomain: null });
      expect(result2.pack.id).toBe('general');
      expect(result2.selectedBy).toBe('safe_default');
    });

    it('UNKNOWN profile selects general@0.0.0', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'UNKNOWN' });
      expect(result.pack.id).toBe('general');
      expect(result.normalizedPackId).toBe('general');
      expect(result.selectedBy).toBe('safe_default');
    });

    it('unsupported repository profile selects general@0.0.0', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'HEALTHCARE' });
      expect(result.pack.id).toBe('general');
      expect(result.normalizedPackId).toBe('general'); // It falls back and normalizes the fallback ID
      expect(result.selectedBy).toBe('safe_default'); // But safe_default replaces it with General
    });

    it('unsupported manual pack throws controlled error', () => {
      expect(() => {
        registry.selectPack({ manualPackId: 'HEALTHCARE' });
      }).toThrow(AppError);
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
          id: 'general',
          version: '0.0.0',
          status: 'FALLBACK',
          glossaryMetadata: [],
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
  });
});
