import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Client as PgClient } from 'pg';
import {
  seedLegacyEmbeddingChunk,
} from '../../tests/release/embedding-chunk-migration.fixture';
import { seedLegacyTestTraceData } from '../../tests/release/test-trace-migration.fixture';
import { UPGRADE_MIGRATIONS } from './migration-upgrade-plan';
import { createMigrationWorkspace } from './migration-upgrade-workspace';

const root = process.cwd();
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = apiRequire('pg') as { Client: typeof PgClient };
const EMBEDDING_PROVENANCE_MIGRATION = '20261030150000_embedding_chunk_provenance_scope';
const MIGRATION_PREFLIGHT = 'Cannot enforce EmbeddingChunk provenance';
const INVALID_COMMIT_SHA = 'c'.repeat(40);
const EMBEDDING_CHUNK_ID = 'upgrade-embedding-chunk';
const newConstraintNames = [
  'EmbeddingChunk_tenantId_projectId_check',
  'EmbeddingChunk_repositoryId_projectId_fkey',
  'EmbeddingChunk_snapshotId_repositoryId_commitSha_fkey',
  'EmbeddingChunk_artifactId_snapshotId_fkey',
];
const newParentIndexes = [
  'Repository_id_projectId_key',
  'RepositorySnapshot_id_repositoryId_commitSha_key',
  'CodeArtifact_id_snapshotId_key',
];

function testDatabaseUrl(): URL {
  const value = process.env.DATABASE_URL_TEST;
  if (!value) throw new Error('Embedding provenance migration verification requires DATABASE_URL_TEST.');
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.pathname !== '/ba_helper_test') {
    throw new Error('Embedding provenance migration verification requires local ba_helper_test.');
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

async function assertInvalidHistoryPreserved(client: PgClient): Promise<void> {
  const row = await client.query(`SELECT "tenantId", "projectId", "repositoryId", "snapshotId",
      "artifactId", "commitSha", content
    FROM "EmbeddingChunk" WHERE id = $1`, [EMBEDDING_CHUNK_ID]);
  if (row.rowCount !== 1 || row.rows[0].commitSha !== INVALID_COMMIT_SHA ||
      row.rows[0].content !== 'synthetic historical embedding content') {
    throw new Error('Rejected embedding provenance migration changed or removed the invalid historical row.');
  }

  const constraints = await client.query(`SELECT conname FROM pg_constraint
    WHERE conrelid = '"EmbeddingChunk"'::regclass AND conname = ANY($1::text[])`, [newConstraintNames]);
  if (constraints.rowCount !== 0) {
    throw new Error('Rejected embedding provenance migration left partial EmbeddingChunk constraints.');
  }

  const indexes = await client.query(`SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ANY($1::text[])`, [newParentIndexes]);
  if (indexes.rowCount !== 0) {
    throw new Error('Rejected embedding provenance migration left partial composite identity indexes.');
  }
}

async function assertInvalidPreconditionExists(client: PgClient): Promise<void> {
  const result = await client.query(`SELECT chunk."commitSha" AS chunk_commit,
      snapshot."commitSha" AS snapshot_commit
    FROM "EmbeddingChunk" AS chunk
    JOIN "RepositorySnapshot" AS snapshot ON snapshot.id = chunk."snapshotId"
    WHERE chunk.id = $1`, [EMBEDDING_CHUNK_ID]);
  if (result.rowCount !== 1 || result.rows[0].chunk_commit !== INVALID_COMMIT_SHA ||
      result.rows[0].snapshot_commit === INVALID_COMMIT_SHA) {
    throw new Error('Embedding provenance migration fixture did not create a persisted snapshot/commit mismatch.');
  }
}

export async function verifyEmbeddingChunkProvenanceHistoryFailsClosed(): Promise<void> {
  const baseUrl = testDatabaseUrl();
  const adminUrl = new URL(baseUrl);
  adminUrl.pathname = '/postgres';
  const databaseName = `ba_helper_embedding_scope_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = new URL(baseUrl);
  invalidUrl.pathname = `/${databaseName}`;
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;

  try {
    await withClient(adminUrl.toString(), async (client) => {
      await client.query(`CREATE DATABASE "${databaseName}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl.toString(), (client) => client.query('CREATE EXTENSION IF NOT EXISTS vector').then(() => undefined));
    migrateDeploy(invalidUrl.toString(), workspace.configPath);

    await withClient(invalidUrl.toString(), async (client) => {
      await seedLegacyTestTraceData(client);
      await seedLegacyEmbeddingChunk(client);
      await client.query('UPDATE "EmbeddingChunk" SET "commitSha" = $1 WHERE id = $2', [
        INVALID_COMMIT_SHA,
        EMBEDDING_CHUNK_ID,
      ]);
      await assertInvalidPreconditionExists(client);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl.toString(), workspace.configPath);
    } catch (error) {
      migrationError = errorText(error);
    }
    if (!migrationError.includes(EMBEDDING_PROVENANCE_MIGRATION) || !migrationError.includes(MIGRATION_PREFLIGHT)) {
      throw new Error(
        `Invalid historical embedding provenance did not produce the expected preflight error while applying its migration. ` +
        `Migration output: ${migrationError.slice(-1600) || '[no migration error]'}`,
      );
    }
    await withClient(invalidUrl.toString(), assertInvalidHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) {
      await withClient(adminUrl.toString(), async (client) => {
        await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
      });
    }
  }
}
