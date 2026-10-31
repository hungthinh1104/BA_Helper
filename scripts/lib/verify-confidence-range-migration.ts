import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Client as PgClient } from 'pg';
import { seedLegacyTestTraceData } from '../../tests/release/test-trace-migration.fixture';
import { seedLegacyTraceabilityLink } from '../../tests/release/traceability-link-snapshot-migration.fixture';
import { UPGRADE_MIGRATIONS } from './migration-upgrade-plan';
import { createMigrationWorkspace } from './migration-upgrade-workspace';

const root = process.cwd();
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = apiRequire('pg') as { Client: typeof PgClient };

type InvalidHistory = {
  table: 'BaInsight' | 'TraceabilityLink';
  id: string;
  confidence: number;
  preflight: string;
};

const invalidHistories: InvalidHistory[] = [
  {
    table: 'BaInsight',
    id: 'upgrade-invalid-confidence-insight',
    confidence: 1.25,
    preflight: 'Cannot enforce BaInsight confidence range',
  },
  {
    table: 'TraceabilityLink',
    id: 'upgrade-traceability-link',
    confidence: -0.25,
    preflight: 'Cannot enforce TraceabilityLink confidence range',
  },
];

function baseUrl(): URL {
  const value = process.env.DATABASE_URL_TEST;
  if (!value) throw new Error('Confidence migration verification requires DATABASE_URL_TEST.');
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.pathname !== '/ba_helper_test') {
    throw new Error('Confidence migration verification requires local ba_helper_test.');
  }
  return url;
}

async function withClient<T>(url: string, action: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

function migrateDeploy(databaseUrl: string, configPath: string): void {
  execFileSync(
    process.execPath,
    [path.join(root, 'apps/api/node_modules/prisma/build/index.js'), 'migrate', 'deploy', '--config', configPath],
    { cwd: path.join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' },
  );
}

function errorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const result = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [result.message, result.stdout, result.stderr]
    .map((item) => item?.toString?.() ?? '')
    .join('\n')
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[database-url]');
}

async function seedInvalidHistory(client: PgClient, history: InvalidHistory): Promise<void> {
  await seedLegacyTestTraceData(client);
  if (history.table === 'TraceabilityLink') {
    await seedLegacyTraceabilityLink(client);
    await client.query('UPDATE "TraceabilityLink" SET confidence = $1 WHERE id = $2', [history.confidence, history.id]);
    return;
  }

  await client.query(`INSERT INTO "BaInsight"
    (id, "impactAnalysisId", "insightKey", "insightType", certainty, "reviewStatus", confidence,
      title, description, "createdAt", "updatedAt")
    VALUES ($1, 'upgrade-analysis', 'upgrade-invalid-confidence', 'CLAIM', 'INFERRED', 'NEEDS_REVIEW',
      $2, 'Historical confidence fixture', 'Must remain untouched by a rejected migration.', now(), now())`,
  [history.id, history.confidence]);
}

async function assertHistoryPreserved(client: PgClient, history: InvalidHistory): Promise<void> {
  const row = await client.query(`SELECT confidence FROM "${history.table}" WHERE id = $1`, [history.id]);
  if (row.rowCount !== 1 || Number(row.rows[0].confidence) !== history.confidence) {
    throw new Error(`Rejected confidence migration changed historical ${history.table} row ${history.id}.`);
  }
  const constraintName = `${history.table}_confidence_range`;
  const constraint = await client.query(`SELECT 1 FROM pg_constraint
    WHERE conrelid = '"${history.table}"'::regclass AND conname = $1`, [constraintName]);
  if (constraint.rowCount !== 0) {
    throw new Error(`Rejected confidence migration partially added ${constraintName}.`);
  }
}

export async function verifyConfidenceRangeHistoryFailsClosed(): Promise<void> {
  const adminUrl = baseUrl();
  adminUrl.pathname = '/postgres';
  for (const history of invalidHistories) {
    const databaseName = `ba_helper_confidence_${process.pid}_${randomBytes(4).toString('hex')}`;
    const invalidUrl = baseUrl();
    invalidUrl.pathname = `/${databaseName}`;
    const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
    let created = false;
    try {
      await withClient(adminUrl.toString(), async (client) => {
        await client.query(`CREATE DATABASE "${databaseName}"`);
        created = true;
      });
      await withClient(invalidUrl.toString(), async (client) => {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      });
      migrateDeploy(invalidUrl.toString(), workspace.configPath);
      await withClient(invalidUrl.toString(), (client) => seedInvalidHistory(client, history));

      workspace.includeUpgrades();
      let migrationError = '';
      try {
        migrateDeploy(invalidUrl.toString(), workspace.configPath);
      } catch (error) {
        migrationError = errorText(error);
      }
      if (!migrationError.includes(history.preflight)) {
        throw new Error(
          `Invalid historical ${history.table} confidence did not fail with the expected preflight. ` +
          `Migration output: ${migrationError.slice(-1600) || '[no migration error]'}`,
        );
      }
      await withClient(invalidUrl.toString(), (client) => assertHistoryPreserved(client, history));
    } finally {
      workspace.cleanup();
      if (created) {
        await withClient(adminUrl.toString(), async (client) => {
          await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
        });
      }
    }
  }
}
