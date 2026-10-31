export interface TestTargetSummary {
  database: { host: string; name: string };
  redis: { host: string; port: number; database: number };
}

const TEST_SEGMENT = /(?:^|[_-])(?:test|e2e)(?:[_-]|$)/i;
const UNSAFE_SEGMENT = /(?:^|[_-])(?:dev|development|prod|production)(?:[_-]|$)/i;

export function validateTestTargets(env: NodeJS.ProcessEnv): TestTargetSummary {
  const databaseUrl = env.DATABASE_URL_TEST;
  const redisUrl = env.REDIS_URL_TEST;
  if (!databaseUrl) throw new Error('DATABASE_URL_TEST is required for isolated test runs.');
  if (!redisUrl) throw new Error('REDIS_URL_TEST is required for isolated test queues.');

  const database = parseDatabaseTarget(databaseUrl);
  if (!TEST_SEGMENT.test(database.name) || UNSAFE_SEGMENT.test(database.name)) {
    throw new Error('DATABASE_URL_TEST must target a database with a test/e2e name segment and no development/production segment.');
  }

  const redis = parseRedisTarget(redisUrl);
  const developmentRedisUrl = env.BA_HELPER_DEVELOPMENT_REDIS_URL || env.REDIS_URL || 'redis://localhost:6379/0';
  if (redisIdentity(redisUrl) === redisIdentity(developmentRedisUrl)) {
    throw new Error('REDIS_URL_TEST must use a different Redis database or instance from the development Redis target.');
  }

  if (env.DATABASE_URL) {
    const application = parseDatabaseTarget(env.DATABASE_URL);
    if (sameDatabase(database, application) && !TEST_SEGMENT.test(application.name)) {
      throw new Error('DATABASE_URL_TEST cannot point to the configured non-test application database.');
    }
  }

  return { database, redis };
}

export function assertPrestartedPlaywrightNamespace(env: NodeJS.ProcessEnv): void {
  if (env.PW_PRESTARTED_SERVERS !== '1') return;
  if (!env.BULLMQ_PREFIX?.startsWith('ba-helper-playwright-')) {
    throw new Error('PW_PRESTARTED_SERVERS requires the matching ba-helper-playwright-* BULLMQ_PREFIX.');
  }
  if (!env.DATABASE_URL) throw new Error('PW_PRESTARTED_SERVERS requires DATABASE_URL set to DATABASE_URL_TEST for the running servers.');
  if (!sameDatabase(parseDatabaseTarget(env.DATABASE_URL), parseDatabaseTarget(required(env.DATABASE_URL_TEST, 'DATABASE_URL_TEST')))) {
    throw new Error('PW_PRESTARTED_SERVERS requires the running API to use DATABASE_URL_TEST.');
  }
  if (!env.REDIS_URL || redisIdentity(env.REDIS_URL) !== redisIdentity(required(env.REDIS_URL_TEST, 'REDIS_URL_TEST'))) {
    throw new Error('PW_PRESTARTED_SERVERS requires the running API/worker to use REDIS_URL_TEST.');
  }
}

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required for prestarted browser servers.`);
  return value;
}

function parseDatabaseTarget(value: string): { host: string; name: string } {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL_TEST must be a valid PostgreSQL URL.'); }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL_TEST must use postgres:// or postgresql://.');
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name || ['postgres', 'template0', 'template1'].includes(name.toLowerCase())) {
    throw new Error('DATABASE_URL_TEST must name a dedicated test database.');
  }
  return { host: url.hostname.toLowerCase(), name };
}

function parseRedisTarget(value: string): { host: string; port: number; database: number } {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('REDIS_URL_TEST must be a valid Redis URL.'); }
  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL_TEST must use redis:// or rediss://.');
  }
  const databaseText = url.pathname.replace(/^\//, '');
  const database = databaseText === '' ? 0 : Number(databaseText);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_URL_TEST must select a numeric Redis database.');
  }
  return {
    host: url.hostname.toLowerCase(),
    port: Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379)),
    database,
  };
}

function redisIdentity(value: string): string {
  const target = parseRedisTarget(value);
  return `${target.host}:${target.port}/${target.database}`;
}

export function redisUrlIdentityOnly(value: string): string {
  const target = parseRedisTarget(value);
  const url = new URL(value);
  return `${url.protocol}//${target.host}:${target.port}/${target.database}`;
}

function sameDatabase(left: { host: string; name: string }, right: { host: string; name: string }): boolean {
  return left.host === right.host && left.name.toLowerCase() === right.name.toLowerCase();
}
