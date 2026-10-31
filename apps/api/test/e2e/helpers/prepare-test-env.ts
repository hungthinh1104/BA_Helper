import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

let testInfraPrepared = false;

async function ensureTestDatabase(databaseUrl: string): Promise<void> {
  const targetUrl = new URL(databaseUrl);
  const databaseName = targetUrl.pathname.replace(/^\//, '');
  if (!databaseName) {
    throw new Error('DATABASE_URL_TEST must include a database name.');
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const client = new Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const existing = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [databaseName],
    );

    if (existing.rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName.replace(/"/g, '""')}"`);
    }
  } finally {
    await client.end();
  }

  const targetClient = new Client({ connectionString: targetUrl.toString() });
  await targetClient.connect();
  try {
    await targetClient.query('CREATE EXTENSION IF NOT EXISTS vector');
  } finally {
    await targetClient.end();
  }
}

function ensureTestSchema(databaseUrl: string): void {
  execFileSync(
    process.execPath,
    [path.resolve('apps/api/node_modules/prisma/build/index.js'),
      'migrate', 'deploy', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'],
    {
      cwd: path.resolve('apps/api'),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'pipe',
    },
  );
}

function redisTarget(urlValue: string): string {
  let url: URL;
  try {
    url = new URL(urlValue);
  } catch {
    throw new Error('REDIS_URL_TEST must be a valid Redis URL.');
  }

  if (url.protocol !== 'redis:' && url.protocol !== 'rediss:') {
    throw new Error('REDIS_URL_TEST must use redis:// or rediss://.');
  }

  const databaseText = url.pathname.replace(/^\//, '');
  const database = databaseText === '' ? 0 : Number(databaseText);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_URL_TEST must select a numeric Redis database.');
  }

  const defaultPort = url.protocol === 'rediss:' ? '6380' : '6379';
  return `${url.hostname.toLowerCase()}:${url.port || defaultPort}/${database}`;
}

function assertTestRedisIsIsolated(testRedisUrl: string): void {
  const developmentRedisUrl =
    process.env.BA_HELPER_DEVELOPMENT_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379';
  if (redisTarget(testRedisUrl) === redisTarget(developmentRedisUrl)) {
    throw new Error(
      'REDIS_URL_TEST must use a different Redis database or instance from REDIS_URL.',
    );
  }
}

export async function prepareIsolatedTestEnv(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

  const testDatabaseUrl = process.env.DATABASE_URL_TEST;
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL_TEST is required for tests.');
  }
  const testRedisUrl = process.env.REDIS_URL_TEST;
  if (!testRedisUrl) {
    throw new Error('REDIS_URL_TEST is required to isolate test queues.');
  }
  assertTestRedisIsIsolated(testRedisUrl);

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.REDIS_URL = testRedisUrl;
  Object.assign(process.env, { NODE_ENV: 'test' });
  process.env.AI_PROVIDER = 'fake';
  process.env.EMBEDDING_PROVIDER = 'fake';

  if (!testInfraPrepared) {
    await ensureTestDatabase(testDatabaseUrl);
    ensureTestSchema(testDatabaseUrl);
    testInfraPrepared = true;
  }
}
