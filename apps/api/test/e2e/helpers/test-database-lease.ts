import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import type { PrismaService } from '@ba-helper/backend-runtime';
import { validateTestTargets } from './test-target-safety';

const LEASE_NAMESPACE = 1_430_512_971;
const LEASE_APP_PREFIX = 'ba-helper-test-lease-';

export interface AdvisoryLeaseClient {
  connect(): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
}

export type AdvisoryLeaseClientFactory = (connectionString: string) => AdvisoryLeaseClient;

export interface TestDatabaseLease {
  environment: NodeJS.ProcessEnv;
  assertHeld(): Promise<void>;
  release(): Promise<void>;
}

export function testDatabaseLeaseClaim(env: NodeJS.ProcessEnv): { id: string; pid: number; appName: string } | undefined {
  const id = env.BA_HELPER_TEST_LEASE_ID;
  const pid = Number(env.BA_HELPER_TEST_LEASE_PID);
  const appName = env.BA_HELPER_TEST_LEASE_APP_NAME;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id) || !Number.isInteger(pid) || pid < 1 || !appName || appName !== `${LEASE_APP_PREFIX}${id}`) return undefined;
  return { id, pid, appName };
}

export async function acquireTestDatabaseLease(env: NodeJS.ProcessEnv, runId = randomUUID(), createClient: AdvisoryLeaseClientFactory = defaultClient): Promise<TestDatabaseLease> {
  const targets = validateTestTargets(env);
  const adminUrl = adminConnectionUrl(env.DATABASE_URL_TEST!);
  const client = createClient(adminUrl);
  await client.connect();
  let released = false;
  try {
    await assertLocalPostgresIdentity(client, targets.database.host, targets.database.port, 'postgres');
    const identity = `${targets.database.host}:${targets.database.port}/${targets.database.name.toLowerCase()}`;
    const lock = await client.query<{ acquired: boolean; pid: number }>(
      'SELECT pg_try_advisory_lock($1, hashtext($2)) AS acquired, pg_backend_pid() AS pid',
      [LEASE_NAMESPACE, identity],
    );
    if (!lock.rows[0]?.acquired) throw new Error('Another invocation holds the local test database lease.');
    const pid = Number(lock.rows[0].pid);
    const appName = `${LEASE_APP_PREFIX}${runId}`;
    await client.query('SELECT set_config($1, $2, false)', ['application_name', appName]);
    const environment: NodeJS.ProcessEnv = {
      BA_HELPER_TEST_LEASE_ID: runId,
      BA_HELPER_TEST_LEASE_PID: String(pid),
      BA_HELPER_TEST_LEASE_APP_NAME: appName,
      BA_HELPER_TEST_DATABASE_IDENTITY: `${targets.database.host}:${targets.database.port}/${targets.database.name}`,
    };
    const lease: TestDatabaseLease = {
      environment,
      assertHeld: async () => {
        if (released || !(await ownsAdvisoryLease(client, pid, appName))) throw new Error('The local test database lease was lost.');
      },
      release: async () => {
        if (released) return;
        released = true;
        try { await client.query('SELECT pg_advisory_unlock($1, hashtext($2))', [LEASE_NAMESPACE, identity]); }
        finally { await client.end().catch(() => undefined); }
      },
    };
    await lease.assertHeld();
    return lease;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

export async function assertTestDatabaseLeaseClaim(env: NodeJS.ProcessEnv, createClient: AdvisoryLeaseClientFactory = defaultClient): Promise<void> {
  const claim = testDatabaseLeaseClaim(env);
  if (!claim) throw new Error('A valid live BA_Helper test database lease is required before database setup.');
  const targets = validateTestTargets(env);
  const client = createClient(adminConnectionUrl(env.DATABASE_URL_TEST!));
  await client.connect();
  try {
    await assertLocalPostgresIdentity(client, targets.database.host, targets.database.port, 'postgres');
    if (!(await ownsAdvisoryLease(client, claim.pid, claim.appName))) throw new Error('The supplied test database lease is not active on this local PostgreSQL server.');
  } finally { await client.end(); }
}

export async function assertActiveTestDatabaseLease(prisma: PrismaService, env = process.env): Promise<void> {
  const claim = testDatabaseLeaseClaim(env);
  if (!claim) throw new Error('A valid live BA_Helper test database lease is required before database reset.');
  const targets = validateTestTargets(env);
  const rows = await prisma.$queryRaw<Array<{ database: string; port: number; lease_held: boolean }>>`
    SELECT current_database() AS database,
      inet_server_port() AS port,
      EXISTS (
        SELECT 1
        FROM pg_stat_activity activity
        JOIN pg_locks lock ON lock.pid = activity.pid
        WHERE activity.pid = ${claim.pid}
          AND activity.application_name = ${claim.appName}
          AND activity.datname = 'postgres'
          AND lock.locktype = 'advisory'
          AND lock.granted
      ) AS lease_held
  `;
  const row = rows[0];
  if (!row || row.database.toLowerCase() !== targets.database.name.toLowerCase() || Number(row.port) !== targets.database.port || !row.lease_held) {
    throw new Error('The active PostgreSQL connection is not protected by the matching local test database lease.');
  }
}

function adminConnectionUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = '/postgres';
  url.searchParams.set('application_name', `${LEASE_APP_PREFIX}bootstrap`);
  return url.toString();
}

async function assertLocalPostgresIdentity(client: AdvisoryLeaseClient, host: string, port: number, database: string): Promise<void> {
  const result = await client.query<{ database: string; port: number }>(
    'SELECT current_database() AS database, inet_server_port() AS port',
  );
  const actual = result.rows[0];
  if (!actual || actual.database !== database || Number(actual.port) !== port || host !== 'localhost') {
    throw new Error('Connected PostgreSQL server identity does not match the explicitly configured local test target.');
  }
}

async function ownsAdvisoryLease(client: AdvisoryLeaseClient, pid: number, appName: string): Promise<boolean> {
  const result = await client.query<{ held: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM pg_stat_activity activity
       JOIN pg_locks lock ON lock.pid = activity.pid
       WHERE activity.pid = $1 AND activity.application_name = $2
         AND activity.datname = 'postgres' AND lock.locktype = 'advisory' AND lock.granted
     ) AS held`,
    [pid, appName],
  );
  return result.rows[0]?.held === true;
}

function defaultClient(connectionString: string): AdvisoryLeaseClient {
  return new Client({ connectionString }) as unknown as AdvisoryLeaseClient;
}
