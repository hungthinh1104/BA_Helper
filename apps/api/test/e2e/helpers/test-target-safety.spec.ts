import { assertPrestartedPlaywrightNamespace, redisUrlIdentityOnly, validateTestTargets } from './test-target-safety';

const isolated = (): NodeJS.ProcessEnv => ({
  DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
  REDIS_URL_TEST: 'redis://localhost:6379/1',
  REDIS_URL: 'redis://localhost:6379/0',
});

describe('test target safety', () => {
  it('accepts explicitly named test services and reports only masked identities', () => {
    expect(validateTestTargets(isolated())).toEqual({
      database: { host: 'localhost', name: 'ba_helper_test' },
      redis: { host: 'localhost', port: 6379, database: 1 },
    });
  });

  it.each(['ba_helper', 'ba_helper_dev', 'ba_helper_production_test', 'postgres'])('rejects unsafe database name %s', (name) => {
    expect(() => validateTestTargets({ ...isolated(), DATABASE_URL_TEST: `postgresql://x:x@localhost:5432/${name}` }))
      .toThrow(/test\/e2e name segment|dedicated test database/);
  });

  it('requires explicit test URLs', () => {
    const env = isolated();
    delete env.DATABASE_URL_TEST;
    expect(() => validateTestTargets(env)).toThrow('DATABASE_URL_TEST is required');
  });

  it('rejects invalid or development Redis targets before service setup', () => {
    expect(() => validateTestTargets({ ...isolated(), REDIS_URL_TEST: 'redis://localhost:6379/0' }))
      .toThrow(/different Redis database or instance/);
    expect(() => validateTestTargets({ ...isolated(), REDIS_URL_TEST: 'http://localhost:6379/1' }))
      .toThrow(/redis:\/\//);
  });

  it('keeps the comparison Redis identity free of credentials', () => {
    expect(redisUrlIdentityOnly('redis://user:secret@localhost:6379/0'))
      .toBe('redis://localhost:6379/0');
  });

  it('rejects a test URL that aliases the configured development database', () => {
    expect(() => validateTestTargets({
      ...isolated(),
      DATABASE_URL: 'postgresql://dev:dev@localhost:5432/ba_helper_dev',
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_dev',
    })).toThrow(/test\/e2e name segment/);
  });

  it('requires the matching test queue namespace for prestarted browser servers', () => {
    expect(() => assertPrestartedPlaywrightNamespace({ PW_PRESTARTED_SERVERS: '1' }))
      .toThrow(/matching ba-helper-playwright/);
    expect(() => assertPrestartedPlaywrightNamespace({
      PW_PRESTARTED_SERVERS: '1', BULLMQ_PREFIX: 'ba-helper-playwright-test-1',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/ba_helper_test',
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
      REDIS_URL: 'redis://localhost:6379/1', REDIS_URL_TEST: 'redis://localhost:6379/1',
    })).not.toThrow();
    expect(() => assertPrestartedPlaywrightNamespace({
      PW_PRESTARTED_SERVERS: '1', BULLMQ_PREFIX: 'ba-helper-playwright-test-1',
      DATABASE_URL: 'postgresql://dev:dev@localhost:5432/ba_helper_dev',
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
      REDIS_URL: 'redis://localhost:6379/0', REDIS_URL_TEST: 'redis://localhost:6379/1',
    })).toThrow(/running API to use DATABASE_URL_TEST/);
  });
});
