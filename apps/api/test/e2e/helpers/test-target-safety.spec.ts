import { assertPrestartedPlaywrightNamespace, redisUrlIdentityOnly, validateTestTargets } from './test-target-safety';
import { acquireTestDatabaseLease, assertTestDatabaseLeaseClaim, type AdvisoryLeaseClient } from './test-database-lease';

const isolated = (): NodeJS.ProcessEnv => ({
  DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
  BA_HELPER_TEST_DATABASE_IDENTITY: 'localhost:5432/ba_helper_test',
  REDIS_URL_TEST: 'redis://localhost:6379/1',
  REDIS_URL: 'redis://localhost:6379/0',
});

describe('test target safety', () => {
  it('accepts explicitly named test services and reports only masked identities', () => {
    expect(validateTestTargets(isolated())).toEqual({
      database: { host: 'localhost', port: 5432, name: 'ba_helper_test' },
      redis: { host: 'localhost', port: 6379, database: 1 },
    });
  });

  it('requires an explicit local endpoint identity matching host, port, and database', () => {
    const env = isolated();
    delete env.BA_HELPER_TEST_DATABASE_IDENTITY;
    expect(() => validateTestTargets(env)).toThrow(/BA_HELPER_TEST_DATABASE_IDENTITY is required/);
    expect(() => validateTestTargets({
      ...isolated(),
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5433/ba_helper_test',
    })).toThrow(/does not match DATABASE_URL_TEST/);
  });

  it('rejects remote PostgreSQL targets even when their database is named for tests', () => {
    expect(() => validateTestTargets({
      ...isolated(),
      DATABASE_URL_TEST: 'postgresql://test:test@db.example.invalid:5432/ba_helper_test',
      BA_HELPER_TEST_DATABASE_IDENTITY: 'db.example.invalid:5432/ba_helper_test',
    })).toThrow(/local loopback/);
  });

  it('rejects an unsafe PostgreSQL URL before attempting a connection', async () => {
    const createClient = jest.fn(() => { throw new Error('a rejected URL must not connect'); });
    const remote = {
      ...isolated(),
      DATABASE_URL_TEST: 'postgresql://test:test@db.example.invalid:5432/ba_helper_test',
      BA_HELPER_TEST_DATABASE_IDENTITY: 'db.example.invalid:5432/ba_helper_test',
    };

    await expect(acquireTestDatabaseLease(remote, undefined, createClient)).rejects.toThrow(/local loopback/);
    expect(createClient).not.toHaveBeenCalled();
    await expect(acquireTestDatabaseLease({
      ...isolated(),
      REDIS_URL_TEST: 'redis://redis.example.invalid:6379/1',
    }, undefined, createClient)).rejects.toThrow(/REDIS_URL_TEST must target a local loopback/);
    expect(createClient).not.toHaveBeenCalled();
    expect(() => validateTestTargets({ ...isolated(), DATABASE_URL_TEST: 'not-a-postgresql-url' }))
      .toThrow(/valid PostgreSQL URL/);
  });

  it('rejects a missing lease claim before connecting to PostgreSQL', async () => {
    const createClient = jest.fn(() => { throw new Error('a missing lease must not connect'); });
    await expect(assertTestDatabaseLeaseClaim(isolated(), createClient)).rejects.toThrow(/valid live BA_Helper test database lease/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('normalizes loopback aliases while preserving the port in target identity', () => {
    expect(validateTestTargets({
      ...isolated(),
      DATABASE_URL_TEST: 'postgresql://test:test@127.0.0.1/ba_helper_test',
    }).database).toEqual({ host: 'localhost', port: 5432, name: 'ba_helper_test' });
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
    expect(() => validateTestTargets({ ...isolated(), REDIS_URL_TEST: 'redis://redis.example.invalid:6379/1' }))
      .toThrow(/local loopback/);
    expect(() => validateTestTargets({ ...isolated(), REDIS_URL_TEST: 'redis://localhost:0/1' }))
      .toThrow(/valid Redis port/);
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

  it('holds an exclusive advisory lease and releases it on the same PostgreSQL session', async () => {
    const pg = fakeLeaseClient({ lockAcquired: true, leaseHeld: true });
    const lease = await acquireTestDatabaseLease(isolated(), '12345678-1234-4234-8234-123456789abc', () => pg.client);

    expect(lease.environment.BA_HELPER_TEST_LEASE_PID).toBe('4321');
    expect(pg.queries.some((query) => query.includes('pg_try_advisory_lock'))).toBe(true);
    await lease.assertHeld();
    await lease.release();
    expect(pg.queries.some((query) => query.includes('pg_advisory_unlock'))).toBe(true);
    expect(pg.ended).toBe(true);
  });

  it('rejects a competing invocation before it can continue to setup', async () => {
    const pg = fakeLeaseClient({ lockAcquired: false, leaseHeld: false });
    await expect(acquireTestDatabaseLease(isolated(), undefined, () => pg.client))
      .rejects.toThrow(/Another invocation holds the local test database lease/);
    expect(pg.queries.some((query) => query.includes('pg_try_advisory_lock'))).toBe(true);
    expect(pg.queries.some((query) => query.includes('CREATE DATABASE') || query.includes('DROP DATABASE'))).toBe(false);
    expect(pg.ended).toBe(true);
  });

  it('rejects a forged or stale lease claim when no live owner lock exists', async () => {
    const pg = fakeLeaseClient({ lockAcquired: false, leaseHeld: false });
    const env = {
      ...isolated(),
      BA_HELPER_TEST_LEASE_ID: '12345678-1234-4234-8234-123456789abc',
      BA_HELPER_TEST_LEASE_PID: '4321',
      BA_HELPER_TEST_LEASE_APP_NAME: 'ba-helper-test-lease-12345678-1234-4234-8234-123456789abc',
    };

    await expect(assertTestDatabaseLeaseClaim(env, () => pg.client)).rejects.toThrow(/supplied test database lease is not active/);
    expect(pg.queries.every((query) => query.startsWith('SELECT'))).toBe(true);
    expect(pg.ended).toBe(true);
  });

  it('requires the matching test queue namespace for prestarted browser servers', () => {
    expect(() => assertPrestartedPlaywrightNamespace({ PW_PRESTARTED_SERVERS: '1' }))
      .toThrow(/matching ba-helper-playwright/);
    expect(() => assertPrestartedPlaywrightNamespace({
      PW_PRESTARTED_SERVERS: '1', BULLMQ_PREFIX: 'ba-helper-playwright-test-1',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/ba_helper_test',
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
      REDIS_URL: 'redis://localhost:6379/1', REDIS_URL_TEST: 'redis://localhost:6379/1',
      BA_HELPER_TEST_LEASE_ID: '12345678-1234-4234-8234-123456789abc',
      BA_HELPER_TEST_LEASE_PID: '4321',
      BA_HELPER_TEST_LEASE_APP_NAME: 'ba-helper-test-lease-12345678-1234-4234-8234-123456789abc',
    })).not.toThrow();
    expect(() => assertPrestartedPlaywrightNamespace({
      PW_PRESTARTED_SERVERS: '1', BULLMQ_PREFIX: 'ba-helper-playwright-test-1',
      DATABASE_URL: 'postgresql://dev:dev@localhost:5432/ba_helper_dev',
      DATABASE_URL_TEST: 'postgresql://test:test@localhost:5432/ba_helper_test',
      REDIS_URL: 'redis://localhost:6379/0', REDIS_URL_TEST: 'redis://localhost:6379/1',
      BA_HELPER_TEST_LEASE_ID: '12345678-1234-4234-8234-123456789abc',
      BA_HELPER_TEST_LEASE_PID: '4321',
      BA_HELPER_TEST_LEASE_APP_NAME: 'ba-helper-test-lease-12345678-1234-4234-8234-123456789abc',
    })).toThrow(/running API to use DATABASE_URL_TEST/);
    expect(() => assertPrestartedPlaywrightNamespace({ PW_PRESTARTED_SERVERS: '1', BULLMQ_PREFIX: 'ba-helper-playwright-test-1' }))
      .toThrow(/lease owner identity/);
  });
});

function fakeLeaseClient(options: { lockAcquired: boolean; leaseHeld: boolean }) {
  const queries: string[] = [];
  let ended = false;
  const query = jest.fn(async (sql: string) => {
    queries.push(sql);
    if (sql.includes('current_database')) return { rows: [{ database: 'postgres', port: 5432 }] };
    if (sql.includes('pg_try_advisory_lock')) return { rows: [{ acquired: options.lockAcquired, pid: 4321 }] };
    if (sql.includes('SELECT EXISTS')) return { rows: [{ held: options.leaseHeld }] };
    return { rows: [{}] };
  }) as unknown as AdvisoryLeaseClient['query'];
  const client: AdvisoryLeaseClient = {
    connect: async () => undefined,
    query,
    end: async () => { ended = true; },
  };
  return { client, queries, get ended() { return ended; } };
}
