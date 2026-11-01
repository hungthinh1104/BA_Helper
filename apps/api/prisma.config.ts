import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
dotenv.config();

assertTestMigrationLease();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

function assertTestMigrationLease(): void {
  const args = process.argv.map((argument) => argument.toLowerCase());
  const mutatesSchema = args.some((argument, index) => argument === 'migrate' && ['deploy', 'dev', 'reset'].includes(args[index + 1] ?? '')) ||
    args.some((argument, index) => argument === 'db' && ['push', 'pull'].includes(args[index + 1] ?? ''));
  if (!mutatesSchema) return;

  const configuredTestUrl = process.env.DATABASE_URL_TEST;
  const activeUrl = process.env.DATABASE_URL;
  if (process.env.NODE_ENV === 'test' && (!activeUrl || !isTestDatabase(activeUrl))) {
    throw new Error('Prisma schema mutation in test mode requires a dedicated test-named database.');
  }
  if (!configuredTestUrl || !activeUrl || !isTestDatabase(activeUrl)) return;
  if (!isTestDatabase(configuredTestUrl)) throw new Error('DATABASE_URL_TEST must target a dedicated test-named database.');
  if (databaseIdentity(activeUrl) !== databaseIdentity(configuredTestUrl)) {
    throw new Error('Prisma test migration target does not match DATABASE_URL_TEST host, port, and database.');
  }

  const root = path.resolve(__dirname, '..', '..');
  const check = spawnSync(process.execPath, [
    '-r', 'ts-node/register/transpile-only',
    path.join(root, 'scripts/assert-test-database-lease.ts'),
  ], { cwd: root, env: {
    ...process.env,
    TS_NODE_PROJECT: path.join(root, 'apps/api/tsconfig.json'),
    TS_NODE_TRANSPILE_ONLY: 'true',
  }, stdio: 'ignore', shell: false, windowsHide: true, timeout: 10_000 });
  if (check.status !== 0) throw new Error('A live local test database advisory lease is required before Prisma schema mutation.');
}

function isTestDatabase(value: string): boolean {
  try { return /(?:^|[_-])(?:test|e2e)(?:[_-]|$)/i.test(decodeURIComponent(new URL(value).pathname.slice(1))); }
  catch { return false; }
}

function databaseIdentity(value: string): string {
  const url = new URL(value);
  return `${normalizeHost(url.hostname)}:${url.port || '5432'}/${decodeURIComponent(url.pathname.slice(1)).toLowerCase()}`;
}

function normalizeHost(value: string): string {
  const host = value.toLowerCase().replace(/^\[|\]$/g, '');
  return ['localhost', '127.0.0.1', '::1'].includes(host) ? 'localhost' : host;
}
