import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Client as PgClient } from 'pg';
import {
  assertCrossMultiRepoChildLineageHistoryPreserved,
  seedCrossMultiRepoChildLineageHistory,
  seedLegacyMultiRepoRun,
} from '../../tests/release/multi-repo-project-scope-migration.fixture';
import { seedLegacyTestTraceData } from '../../tests/release/test-trace-migration.fixture';
import { UPGRADE_MIGRATIONS } from './migration-upgrade-plan';
import { createMigrationWorkspace } from './migration-upgrade-workspace';

const root = process.cwd();
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = apiRequire('pg') as { Client: typeof PgClient };
const USER_ID = '00000000-0000-4000-8000-0000000abcde';
const PREFLIGHT_ERROR = 'Cannot enforce multi-repo child lineage';

function baseUrl(): URL {
  const value = process.env.DATABASE_URL_TEST;
  if (!value) throw new Error('Migration verification requires DATABASE_URL_TEST.');
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.pathname !== '/ba_helper_test') {
    throw new Error('Multi-repo child-lineage migration verification requires local ba_helper_test.');
  }
  return url;
}

async function withClient<T>(connectionString: string, action: (client: PgClient) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
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

export async function verifyCrossMultiRepoChildLineageHistoryFailsClosed(): Promise<void> {
  const invalidName = `ba_helper_upgrade_child_lineage_${process.pid}_${randomBytes(4).toString('hex')}`;
  const adminUrl = baseUrl();
  adminUrl.pathname = '/postgres';
  const invalidUrl = baseUrl();
  invalidUrl.pathname = `/${invalidName}`;
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let created = false;

  try {
    await withClient(adminUrl.toString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidName}"`);
      created = true;
    });
    await withClient(invalidUrl.toString(), async (client) => {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    });
    migrateDeploy(invalidUrl.toString(), workspace.configPath);

    await withClient(invalidUrl.toString(), async (client) => {
      await client.query(`INSERT INTO "user" (id, email, name, updated_at)
        VALUES ($1, 'legacy.user@example.com', 'Legacy User', now())`, [USER_ID]);
      await seedLegacyTestTraceData(client);
      await seedLegacyMultiRepoRun(client, USER_ID);
      await seedCrossMultiRepoChildLineageHistory(client, USER_ID);
      const mismatch = await client.query(`SELECT 1 FROM "ImpactAnalysis" AS analysis
        JOIN "RepositorySnapshot" AS snapshot ON snapshot.id = analysis."snapshotId"
        JOIN "Repository" AS repository ON repository.id = snapshot."repositoryId"
        JOIN "RequirementRevision" AS revision ON revision.id = analysis."requirementRevisionId"
        JOIN "Requirement" AS requirement ON requirement.id = revision."requirementId"
        JOIN "MultiRepoAnalysisRun" AS run ON run.id = analysis."multiRepoRunId"
        WHERE analysis.id = 'upgrade-analysis'
          AND (repository."projectId" <> run."projectId"
            OR revision.id <> run."requirementRevisionId")`);
      if (mismatch.rowCount !== 1) {
        throw new Error('Expected the scratch database to contain one cross-lineage child analysis before upgrade.');
      }
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl.toString(), workspace.configPath);
    } catch (error) {
      migrationError = errorText(error);
    }
    if (!migrationError.includes(PREFLIGHT_ERROR)) {
      throw new Error(
        `Invalid historical multi-repo child lineage did not fail the upgrade with the expected preflight. ` +
        `Captured migration output: ${migrationError.slice(-1600) || '[no migration error]'} `,
      );
    }
    await withClient(invalidUrl.toString(), assertCrossMultiRepoChildLineageHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (created) {
      await withClient(adminUrl.toString(), async (client) => {
        await client.query(`DROP DATABASE IF EXISTS "${invalidName}"`);
      });
    }
  }
}
