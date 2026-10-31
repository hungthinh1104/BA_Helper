export interface TestTargetSummary {
  database: { host: string; port: number; name: string };
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
  if (!isLoopback(database.host)) throw new Error('DATABASE_URL_TEST must target a local loopback PostgreSQL service.');
  if (!TEST_SEGMENT.test(database.name) || UNSAFE_SEGMENT.test(database.name)) {
    throw new Error('DATABASE_URL_TEST must target a database with a test/e2e name segment and no development/production segment.');
  }
  const approvedIdentity = env.BA_HELPER_TEST_DATABASE_IDENTITY;
  if (!approvedIdentity) throw new Error('BA_HELPER_TEST_DATABASE_IDENTITY is required for destructive test database operations.');
  if (parseDatabaseIdentity(approvedIdentity) !== databaseIdentity(database)) {
    throw new Error('BA_HELPER_TEST_DATABASE_IDENTITY does not match DATABASE_URL_TEST host, port, and database.');
  }

  if (env.DATABASE_URL && sameDatabase(database, parseDatabaseTarget(env.DATABASE_URL)) && !hasLeaseClaim(env)) {
    throw new Error('DATABASE_URL_TEST aliases DATABASE_URL without an active test database lease.');
  }

  const redis = parseRedisTarget(redisUrl);
  if (!isLoopback(redis.host)) throw new Error('REDIS_URL_TEST must target a local loopback Redis service.');
  const developmentRedisUrl = env.BA_HELPER_DEVELOPMENT_REDIS_URL || env.REDIS_URL || 'redis://localhost:6379/0';
  if (redisIdentity(redisUrl) === redisIdentity(developmentRedisUrl)) {
    throw new Error('REDIS_URL_TEST must use a different Redis database or instance from the development Redis target.');
  }

  return { database, redis };
}

export function hasLeaseClaim(env: NodeJS.ProcessEnv): boolean {
  const id = env.BA_HELPER_TEST_LEASE_ID;
  const pid = Number(env.BA_HELPER_TEST_LEASE_PID);
  return Boolean(id && /^[0-9a-f-]{36}$/i.test(id) && Number.isInteger(pid) && pid > 0 &&
    env.BA_HELPER_TEST_LEASE_APP_NAME === `ba-helper-test-lease-${id}`);
}

export function assertPrestartedPlaywrightNamespace(env: NodeJS.ProcessEnv): void {
  if (env.PW_PRESTARTED_SERVERS !== '1') return;
  if (!env.BULLMQ_PREFIX?.startsWith('ba-helper-playwright-')) {
    throw new Error('PW_PRESTARTED_SERVERS requires the matching ba-helper-playwright-* BULLMQ_PREFIX.');
  }
  if (!hasLeaseClaim(env)) throw new Error('PW_PRESTARTED_SERVERS requires the live test database lease owner identity.');
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

function parseDatabaseTarget(value: string): { host: string; port: number; name: string } {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('DATABASE_URL_TEST must be a valid PostgreSQL URL.'); }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL_TEST must use postgres:// or postgresql://.');
  }
  const name = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!name || ['postgres', 'template0', 'template1'].includes(name.toLowerCase())) {
    throw new Error('DATABASE_URL_TEST must name a dedicated test database.');
  }
  const port = Number(url.port || 5432);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DATABASE_URL_TEST must use a valid PostgreSQL port.');
  return { host: normalizeHost(url.hostname), port, name };
}

function parseDatabaseIdentity(value: string): string {
  const slash = value.lastIndexOf('/');
  const endpoint = value.slice(0, slash);
  const name = value.slice(slash + 1);
  if (slash < 0 || !endpoint || !name) throw new Error('BA_HELPER_TEST_DATABASE_IDENTITY must use host:port/database format.');
  let url: URL;
  try { url = new URL(`postgresql://${endpoint}/${encodeURIComponent(name)}`); }
  catch { throw new Error('BA_HELPER_TEST_DATABASE_IDENTITY must use host:port/database format.'); }
  if (!url.port) throw new Error('BA_HELPER_TEST_DATABASE_IDENTITY must include the PostgreSQL port.');
  return databaseIdentity({ host: normalizeHost(url.hostname), port: Number(url.port), name: decodeURIComponent(url.pathname.slice(1)) });
}

function databaseIdentity(target: { host: string; port: number; name: string }): string {
  return `${target.host}:${target.port}/${target.name.toLowerCase()}`;
}

function normalizeHost(host: string): string {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(normalized) ? 'localhost' : normalized;
}

function isLoopback(host: string): boolean {
  return host === 'localhost';
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
  const port = Number(url.port || (url.protocol === 'rediss:' ? 6380 : 6379));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('REDIS_URL_TEST must use a valid Redis port.');
  }
  return {
    host: normalizeHost(url.hostname),
    port,
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

function sameDatabase(left: { host: string; port: number; name: string }, right: { host: string; port: number; name: string }): boolean {
  return databaseIdentity(left) === databaseIdentity(right);
}
