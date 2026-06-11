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
    'pnpm',
    ['--dir', 'apps/api', 'exec', 'prisma', 'db', 'push', '--accept-data-loss'],
    {
      cwd: path.resolve(process.cwd()),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
      stdio: 'pipe',
    },
  );
}

export async function prepareIsolatedTestEnv(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

  const testDatabaseUrl = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error('DATABASE_URL_TEST or DATABASE_URL is required for tests.');
  }

  process.env.DATABASE_URL = testDatabaseUrl;
  if (process.env.REDIS_URL_TEST) {
    process.env.REDIS_URL = process.env.REDIS_URL_TEST;
  }
  Object.assign(process.env, { NODE_ENV: 'test' });
  process.env.AI_PROVIDER = 'fake';
  process.env.EMBEDDING_PROVIDER = 'fake';

  if (!testInfraPrepared) {
    await ensureTestDatabase(testDatabaseUrl);
    ensureTestSchema(testDatabaseUrl);
    testInfraPrepared = true;
  }
}
