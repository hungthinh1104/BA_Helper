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
});

