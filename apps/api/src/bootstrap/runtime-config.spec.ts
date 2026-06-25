import {
  getRuntimeConfig,
  parseCorsAllowedOrigins,
  validateRuntimeConfig,
} from './runtime-config';

describe('runtime-config', () => {
  it('parses and deduplicates configured CORS origins', () => {
    expect(
      parseCorsAllowedOrigins(
        'https://web.example.com, https://web.example.com ,http://localhost:3000',
      ),
    ).toEqual(['https://web.example.com', 'http://localhost:3000']);
  });

  it('rejects CORS origins with paths', () => {
    expect(() =>
      parseCorsAllowedOrigins('https://web.example.com/app'),
    ).toThrow('CORS origins must not include path');
  });

  it('fails fast for production-like env without configured CORS allowlist', () => {
    const config = getRuntimeConfig({
      NODE_ENV: 'production',
      PORT: '3001',
      WORKSPACE_MODE: 'dev-single-user',
    });

    expect(() => validateRuntimeConfig(config)).toThrow(
      'CORS_ALLOWED_ORIGINS must be configured',
    );
  });

  it('accepts explicit CORS allowlist in production-like env', () => {
    const config = getRuntimeConfig({
      CORS_ALLOWED_ORIGINS: 'https://web.example.com',
      NODE_ENV: 'production',
      PORT: '3001',
      WORKSPACE_MODE: 'dev-single-user',
    });

    expect(() => validateRuntimeConfig(config)).not.toThrow();
    expect(config.corsAllowedOrigins).toEqual(['https://web.example.com']);
  });

  describe('Dev Login Policy', () => {
    it('throws if ENABLE_DEV_LOGIN is true in production', () => {
      const config = getRuntimeConfig({
        NODE_ENV: 'production',
        ENABLE_DEV_LOGIN: 'true',
        CORS_ALLOWED_ORIGINS: 'https://web.example.com',
      });
      expect(() => validateRuntimeConfig(config)).toThrow('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in production/staging environments.');
    });

    it('throws if ENABLE_DEV_LOGIN is true in staging', () => {
      const config = getRuntimeConfig({
        NODE_ENV: 'staging',
        ENABLE_DEV_LOGIN: 'true',
        CORS_ALLOWED_ORIGINS: 'https://web.example.com',
      });
      expect(() => validateRuntimeConfig(config)).toThrow('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in production/staging environments.');
    });

    it('throws if ENABLE_DEV_LOGIN is true in public preview', () => {
      const config = getRuntimeConfig({
        NODE_ENV: 'development',
        ENABLE_DEV_LOGIN: 'true',
        PUBLIC_PREVIEW_MODE: 'true',
      });
      expect(() => validateRuntimeConfig(config)).toThrow('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in PUBLIC_PREVIEW_MODE.');
    });

    it('throws if ENABLE_DEV_LOGIN is true in team workspace mode', () => {
      const config = getRuntimeConfig({
        NODE_ENV: 'development',
        ENABLE_DEV_LOGIN: 'true',
        WORKSPACE_MODE: 'team-dev',
      });
      expect(() => validateRuntimeConfig(config)).toThrow("BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden when workspace mode is 'team-dev'.");
    });

    it('allows dev-login in development with dev-single-user mode', () => {
      const config = getRuntimeConfig({
        NODE_ENV: 'development',
        ENABLE_DEV_LOGIN: 'true',
        WORKSPACE_MODE: 'dev-single-user',
      });
      expect(() => validateRuntimeConfig(config)).not.toThrow();
      expect(config.enableDevLogin).toBe(true);
    });
  });
});

