import { DomainPackRegistry } from './domain-pack.registry';
import { AppError } from '../../../shared/app-error';

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
      expect(result.normalizedPackId).toBe('booking');
      expect(result.selectedBy).toBe('manual_config');
    });

    it('selects repository BOOKING with selectedBy repository_profile', () => {
      const result = registry.selectPack({ repositoryProfileDomain: 'BOOKING' });
      expect(result.pack.id).toBe('booking');
      expect(result.normalizedPackId).toBe('booking');
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
});
