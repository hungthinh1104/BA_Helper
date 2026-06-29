import {
  getRuntimeConfig,
  parseCorsAllowedOrigins,
  validateRuntimeConfig,
  resolveAuthMode,
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
      const env = {
        NODE_ENV: 'production',
        ENABLE_DEV_LOGIN: 'true',
        CORS_ALLOWED_ORIGINS: 'https://web.example.com',
      };
      const config = getRuntimeConfig(env);
      expect(() => validateRuntimeConfig(config, env)).toThrow('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in production/staging environments.');
    });

    it('throws if ENABLE_DEV_LOGIN is true in staging', () => {
      const env = {
        NODE_ENV: 'staging',
        ENABLE_DEV_LOGIN: 'true',
        CORS_ALLOWED_ORIGINS: 'https://web.example.com',
      };
      const config = getRuntimeConfig(env);
      expect(() => validateRuntimeConfig(config, env)).toThrow('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in production/staging environments.');
    });

    it('throws if ENABLE_DEV_LOGIN is true in public preview', () => {
      const env = {
        NODE_ENV: 'development',
        ENABLE_DEV_LOGIN: 'true',
        PUBLIC_PREVIEW_MODE: 'true',
      };
      const config = getRuntimeConfig(env);
      expect(() => validateRuntimeConfig(config, env)).toThrow('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in PUBLIC_PREVIEW_MODE.');
    });

    it('throws if ENABLE_DEV_LOGIN is true in team workspace mode', () => {
      const env = {
        NODE_ENV: 'development',
        ENABLE_DEV_LOGIN: 'true',
        WORKSPACE_MODE: 'team-dev',
      };
      const config = getRuntimeConfig(env);
      expect(() => validateRuntimeConfig(config, env)).toThrow("BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden when workspace mode is 'team-dev'.");
    });

    it('allows dev-login in development with dev-single-user mode', () => {
      const env = {
        NODE_ENV: 'development',
        ENABLE_DEV_LOGIN: 'true',
        WORKSPACE_MODE: 'dev-single-user',
      };
      const config = getRuntimeConfig(env);
      expect(() => validateRuntimeConfig(config, env)).not.toThrow();
      expect(config.enableDevLogin).toBe(true);
    });

    it('defaults to dev-login true in development when not explicitly set', () => {
      const env = {
        NODE_ENV: 'development',
        WORKSPACE_MODE: 'dev-single-user',
      };
      const config = getRuntimeConfig(env);
      expect(() => validateRuntimeConfig(config, env)).not.toThrow();
      expect(config.enableDevLogin).toBe(true);
    });
  });

  describe('resolveAuthMode', () => {
    it('resolves dev-login for development when not explicitly set', () => {
      expect(resolveAuthMode({ NODE_ENV: 'development' })).toBe('dev-login');
    });

    it('resolves unsupported for development when explicitly disabled', () => {
      expect(resolveAuthMode({ NODE_ENV: 'development', ENABLE_DEV_LOGIN: 'false' })).toBe('unsupported');
    });

    it('resolves dev-login for development when explicitly enabled', () => {
      expect(resolveAuthMode({ NODE_ENV: 'development', ENABLE_DEV_LOGIN: 'true' })).toBe('dev-login');
    });

    it('resolves unsupported for production even if enabled', () => {
      expect(resolveAuthMode({ NODE_ENV: 'production', ENABLE_DEV_LOGIN: 'true' })).toBe('unsupported');
    });

    it('resolves unsupported for staging even if enabled', () => {
      expect(resolveAuthMode({ NODE_ENV: 'staging', ENABLE_DEV_LOGIN: 'true' })).toBe('unsupported');
    });

    it('resolves unsupported if PREVIEW_AUTH_ENABLED=true', () => {
      expect(resolveAuthMode({ NODE_ENV: 'development', PREVIEW_AUTH_ENABLED: 'true', ENABLE_DEV_LOGIN: 'true' })).toBe('unsupported');
    });

    it('resolves unsupported if PUBLIC_PREVIEW_MODE=true', () => {
      expect(resolveAuthMode({ NODE_ENV: 'development', PUBLIC_PREVIEW_MODE: 'true', ENABLE_DEV_LOGIN: 'true' })).toBe('unsupported');
    });
  });
});

