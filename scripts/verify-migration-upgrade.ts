/**
 * Migration-upgrade / data-survival gate.
 *
 * Proves that the migrations introduced on this branch upgrade a populated
 * database without losing data:
 *   1. Apply a scratch copy of the PREVIOUS migration chain.
 *   2. Seed representative legacy data (a mixed-case email, a domain event).
 *   3. Apply the CURRENT migrations (the upgrade).
 *   4. Verify the seeded data survived and the upgrade took effect (email
 *      normalized, new indexes present).
 *
 * Runs against a throwaway database so it never touches dev/test data.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Client as PgClient } from 'pg';
import { config } from 'dotenv';
import { seedLegacyTestTraceData, verifyLegacyTestTraceData } from '../tests/release/test-trace-migration.fixture';
import { seedLegacyClarificationItem, verifyLegacyClarificationItem } from '../tests/release/clarification-item-analysis-scope-migration.fixture';
import {
  seedLegacyReviewClarificationRequest,
  verifyLegacyReviewClarificationRequest,
} from '../tests/release/review-clarification-request-analysis-scope-migration.fixture';
import { seedLegacyEmbeddingChunk, verifyLegacyEmbeddingChunk } from '../tests/release/embedding-chunk-migration.fixture';
import {
  assertMissingEvidenceOriginHistoryPreserved,
  assertHistoricalEvidencePreserved,
  seedMissingEvidenceOriginHistory,
  seedCrossSnapshotEvidenceHistory,
  seedLegacyEvidence,
  verifyLegacyEvidence,
} from '../tests/release/evidence-provenance-migration.fixture';
import {
  assertHistoricalTraceabilityLinkPreserved,
  seedCrossSnapshotTraceabilityHistory,
  seedLegacyTraceabilityLink,
  verifyLegacyTraceabilityLink,
} from '../tests/release/traceability-link-snapshot-migration.fixture';
import {
  assertCrossProjectMultiRepoHistoryPreserved,
  seedCrossProjectMultiRepoHistory,
  seedLegacyMultiRepoChildAnalysis,
  seedLegacyMultiRepoRun,
  verifyLegacyMultiRepoRun,
} from '../tests/release/multi-repo-project-scope-migration.fixture';
import {
  assertCrossRepositoryScanJobHistoryPreserved,
  seedCrossRepositoryScanJobHistory,
  seedLegacyScanJob,
  verifyLegacyScanJob,
} from '../tests/release/scan-job-repository-scope-migration.fixture';
import {
  assertCrossRepositoryImpactAnalysisHistoryPreserved,
  seedCrossRepositoryImpactAnalysisHistory,
  verifyLegacyImpactAnalysisRepositoryScope,
} from '../tests/release/impact-analysis-repository-scope-migration.fixture';
import {
  assertCrossProjectImpactAnalysisHistoryPreserved,
  seedCrossProjectImpactAnalysisHistory,
  verifyLegacyImpactAnalysisProjectScope,
} from '../tests/release/impact-analysis-project-scope-migration.fixture';
import { UPGRADE_MIGRATIONS } from './lib/migration-upgrade-plan';
import { createMigrationWorkspace } from './lib/migration-upgrade-workspace';
import { verifyCrossMultiRepoChildLineageHistoryFailsClosed } from './lib/verify-multi-repo-child-lineage-migration';
import { verifyCrossAnalysisClarificationHistoryFailsClosed } from './lib/verify-clarification-item-analysis-scope-migration';
import { verifyCrossAnalysisReviewClarificationHistoryFailsClosed } from './lib/verify-review-clarification-request-analysis-scope-migration';
import { verifyConfidenceRangeHistoryFailsClosed } from './lib/verify-confidence-range-migration';
import { verifyEmbeddingChunkProvenanceHistoryFailsClosed } from './lib/verify-embedding-chunk-provenance-migration';

const root = process.cwd();
const apiRequire = createRequire(path.join(root, 'apps/api/package.json'));
const { Client } = apiRequire('pg') as { Client: typeof PgClient };
config({ path: path.join(root, '.env.test'), quiet: true });

const TEMP_DB = `ba_helper_upgrade_${process.pid}_${randomBytes(4).toString('hex')}`;
const SEED_USER_ID = '00000000-0000-4000-8000-0000000abcde';
const SEED_EVENT_KEY = 'migration-upgrade-seed-1';
const CROSS_SNAPSHOT_PREFLIGHT_ERROR = 'Cannot enforce DependencyEdge snapshot provenance';
const CROSS_SNAPSHOT_EVIDENCE_PREFLIGHT_ERROR = 'Cannot enforce Evidence artifact snapshot provenance';
const EVIDENCE_SOURCE_ORIGIN_PREFLIGHT_ERROR = 'Cannot enforce Evidence source origin scope';
const CROSS_SNAPSHOT_TRACEABILITY_PREFLIGHT_ERROR = 'Cannot enforce TraceabilityLink snapshot provenance';
const CROSS_ANALYSIS_REPORT_PREFLIGHT_ERROR = 'Cannot enforce reviewed report document analysis scope';
const CROSS_ANALYSIS_DOCUMENT_JOB_PREFLIGHT_ERROR = 'Cannot enforce DocumentJob generated document analysis scope';
const CROSS_PROJECT_MULTI_REPO_PREFLIGHT_ERROR = 'Cannot enforce multi-repo project/revision provenance';
const CROSS_REPOSITORY_SCAN_JOB_PREFLIGHT_ERROR = 'Cannot enforce ScanJob repository provenance';
const CROSS_REPOSITORY_IMPACT_ANALYSIS_PREFLIGHT_ERROR = 'Cannot enforce ImpactAnalysis repository provenance';
const CROSS_PROJECT_IMPACT_ANALYSIS_PREFLIGHT_ERROR = 'Cannot enforce ImpactAnalysis project provenance';

function baseConnectionString(): string {
  const value = process.env.DATABASE_URL_TEST;
  if (!value) throw new Error('Migration upgrade verification requires DATABASE_URL_TEST.');
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname) || url.pathname !== '/ba_helper_test') {
    throw new Error('Migration upgrade verification only permits the local ba_helper_test database as its disposable database host.');
  }
  return value;
}

function tempConnectionString(): string {
  const url = new URL(baseConnectionString());
  url.pathname = `/${TEMP_DB}`;
  return url.toString();
}

function adminConnectionString(): string {
  const url = new URL(baseConnectionString());
  url.pathname = '/postgres';
  return url.toString();
}

async function withClient<T>(connectionString: string, fn: (c: PgClient) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

function migrateDeploy(databaseUrl: string, configPath: string): void {
  execFileSync(
    process.execPath,
    [path.join(root, 'apps/api/node_modules/prisma/build/index.js'),
      'migrate', 'deploy', '--config', configPath],
    { cwd: path.join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' },
  );
}

function verifyPrismaSchemaCatalogParity(databaseUrl: string): void {
  try {
    execFileSync(
      process.execPath,
      [
        path.join(root, 'apps/api/node_modules/prisma/build/index.js'),
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--exit-code',
      ],
      {
        cwd: path.join(root, 'apps/api'),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      },
    );
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error
      ? String(error.status)
      : 'unknown';
    throw new Error(
      `Prisma schema/catalog parity check failed (migrate diff exit ${status}). ${commandErrorText(error).slice(-4_000)}`,
    );
  }
}

async function main(): Promise<void> {
  const tempUrl = tempConnectionString();
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async c => {
      await c.query(`CREATE DATABASE "${TEMP_DB}"`);
      databaseCreated = true;
    });
    await withClient(tempUrl, async c => { await c.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(tempUrl, workspace.configPath);

    // 3. Seed representative legacy data on the previous schema.
    await withClient(tempUrl, async (c) => {
      await c.query(
        `INSERT INTO "user" (id, email, name, updated_at) VALUES ($1, $2, $3, now())`,
        [SEED_USER_ID, 'Legacy.USER@Example.COM', 'Legacy User'],
      );
      await c.query(
        `INSERT INTO "DomainEvent" (id, "eventType", "idempotencyKey", payload) VALUES ($1, $2, $3, $4::jsonb)`,
        ['11111111-1111-4111-8111-111111111111', 'AUTH_LOGIN_SUCCEEDED', SEED_EVENT_KEY, JSON.stringify({ actorUserId: SEED_USER_ID })],
      );
      await seedLegacyTestTraceData(c);
      await seedLegacyClarificationItem(c);
      await seedLegacyReviewClarificationRequest(c, SEED_USER_ID);
      await seedLegacyEmbeddingChunk(c);
      await seedLegacyEvidence(c);
      await seedLegacyTraceabilityLink(c);
      await seedLegacyMultiRepoRun(c, SEED_USER_ID);
      await seedLegacyMultiRepoChildAnalysis(c);
      await seedLegacyScanJob(c);
    });

    // 4. Add upgrades to the scratch chain, apply, then prove a repeat is safe.
    workspace.includeUpgrades();
    migrateDeploy(tempUrl, workspace.configPath);
    migrateDeploy(tempUrl, workspace.configPath);
    verifyPrismaSchemaCatalogParity(tempUrl);

    // 5. Verify data survived AND the upgrade took effect.
    const failures: string[] = [];
    await withClient(tempUrl, async (c) => {
      const user = await c.query('SELECT email FROM "user" WHERE id = $1', [SEED_USER_ID]);
      if (user.rowCount !== 1) failures.push('seeded user row was lost');
      else if (user.rows[0].email !== 'legacy.user@example.com') {
        failures.push(`email not normalized: got "${user.rows[0].email}"`);
      }

      const event = await c.query('SELECT 1 FROM "DomainEvent" WHERE "idempotencyKey" = $1', [SEED_EVENT_KEY]);
      if (event.rowCount !== 1) failures.push('seeded domain event was lost');

      const requirement = await c.query(
        'SELECT "requestKey", "requestPayloadHash" FROM "Requirement" WHERE id = $1',
        ['upgrade-requirement'],
      );
      if (requirement.rowCount !== 1 || !requirement.rows[0].requestKey ||
          requirement.rows[0].requestPayloadHash !== '') {
        failures.push('legacy requirement was not preserved and assigned an idempotency key');
      }
      const requirementIndex = await c.query(
        `SELECT to_regclass('"Requirement_projectId_requestKey_key"') AS idx`,
      );
      if (!requirementIndex.rows[0].idx) failures.push('requirement request-key index missing after upgrade');

      const multiRepoHashColumn = await c.query(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'MultiRepoAnalysisRun'
           AND column_name = 'requestPayloadHash'`,
      );
      if (multiRepoHashColumn.rowCount !== 1 || multiRepoHashColumn.rows[0].is_nullable !== 'YES') {
        failures.push('multi-repo request payload hash column missing or not nullable after upgrade');
      }

      const multiRepoPlanColumn = await c.query(
        `SELECT is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'MultiRepoAnalysisRun'
           AND column_name = 'requestPlan'`,
      );
      if (multiRepoPlanColumn.rowCount !== 1 || multiRepoPlanColumn.rows[0].is_nullable !== 'YES') {
        failures.push('multi-repo request plan column missing or not nullable after upgrade');
      }

      const emailIndex = await c.query(`SELECT to_regclass('user_email_lower_key') AS idx`);
      if (!emailIndex.rows[0].idx) failures.push('case-insensitive email index missing after upgrade');

      const eventIndex = await c.query(`SELECT to_regclass('"DomainEvent_eventType_createdAt_idx"') AS idx`);
      if (!eventIndex.rows[0].idx) failures.push('domain-event index missing after upgrade');
      const reverseEdgeIndex = await c.query(`SELECT to_regclass('"DependencyEdge_snapshotId_toArtifactId_type_idx"') AS idx`);
      if (!reverseEdgeIndex.rows[0].idx) failures.push('reverse comprehension edge index missing after upgrade');
      const evidenceIndex = await c.query(`SELECT to_regclass('"Evidence_snapshotId_artifactId_idx"') AS idx`);
      if (!evidenceIndex.rows[0].idx) failures.push('comprehension evidence index missing after upgrade');
      failures.push(...await verifyLegacyTestTraceData(c));
      failures.push(...await verifyLegacyClarificationItem(c));
      failures.push(...await verifyLegacyReviewClarificationRequest(c, SEED_USER_ID));
      failures.push(...await verifyLegacyEmbeddingChunk(c));
      failures.push(...await verifyLegacyEvidence(c));
      failures.push(...await verifyLegacyTraceabilityLink(c));
      failures.push(...await verifyLegacyMultiRepoRun(c, SEED_USER_ID));
      failures.push(...await verifyLegacyScanJob(c));
      failures.push(...await verifyLegacyImpactAnalysisRepositoryScope(c));
      failures.push(...await verifyLegacyImpactAnalysisProjectScope(c));
    });

    if (failures.length > 0) {
      for (const failure of failures) console.error(`- ${failure}`);
      throw new Error(`Migration upgrade verification failed (${failures.length} issue(s)).`);
    }

    await verifyCrossSnapshotHistoryFailsClosed();
    await verifyCrossAnalysisReportHistoryFailsClosed();
    await verifyCrossAnalysisDocumentJobHistoryFailsClosed();
    await verifyCrossSnapshotEvidenceHistoryFailsClosed();
    await verifyMissingEvidenceOriginHistoryFailsClosed();
    await verifyCrossSnapshotTraceabilityHistoryFailsClosed();
    await verifyCrossProjectMultiRepoHistoryFailsClosed();
    await verifyCrossMultiRepoChildLineageHistoryFailsClosed();
    await verifyCrossRepositoryScanJobHistoryFailsClosed();
    await verifyCrossRepositoryImpactAnalysisHistoryFailsClosed();
    await verifyCrossProjectImpactAnalysisHistoryFailsClosed();
    await verifyCrossAnalysisClarificationHistoryFailsClosed();
    await verifyCrossAnalysisReviewClarificationHistoryFailsClosed();
    await verifyConfidenceRangeHistoryFailsClosed();
    await verifyEmbeddingChunkProvenanceHistoryFailsClosed();
    process.stdout.write('Migration upgrade verified: legacy data survived, snapshot, document-job report, multi-repo run/child, scan-job, impact-analysis repository/project, clarification analysis-scope, confidence-range, and embedding provenance constraints were enforced, and invalid history failed closed without data loss.\n');
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async c => {
      await c.query(`DROP DATABASE IF EXISTS "${TEMP_DB}"`);
    });
  }
}

async function verifyCrossRepositoryImpactAnalysisHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_analysis_scope_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await seedLegacyTestTraceData(client);
      await seedCrossRepositoryImpactAnalysisHistory(client);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_REPOSITORY_IMPACT_ANALYSIS_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-repository ImpactAnalysis history did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertCrossRepositoryImpactAnalysisHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossProjectImpactAnalysisHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_analysis_project_scope_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await seedLegacyTestTraceData(client);
      await seedCrossProjectImpactAnalysisHistory(client);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_PROJECT_IMPACT_ANALYSIS_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-project ImpactAnalysis history did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertCrossProjectImpactAnalysisHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossRepositoryScanJobHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_scan_scope_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await client.query(`INSERT INTO "user" (id, email, name, updated_at)
        VALUES ($1, 'legacy.user@example.com', 'Legacy User', now())`, [SEED_USER_ID]);
      await seedLegacyTestTraceData(client);
      await seedCrossRepositoryScanJobHistory(client);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_REPOSITORY_SCAN_JOB_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-repository ScanJob history did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertCrossRepositoryScanJobHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossSnapshotEvidenceHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_evidence_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await seedLegacyTestTraceData(client);
      await seedCrossSnapshotEvidenceHistory(client);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_SNAPSHOT_EVIDENCE_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-snapshot historical Evidence did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertHistoricalEvidencePreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyMissingEvidenceOriginHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_evidence_origin_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, seedMissingEvidenceOriginHistory);

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(EVIDENCE_SOURCE_ORIGIN_PREFLIGHT_ERROR)) {
      throw new Error(`Missing Evidence origin history did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertMissingEvidenceOriginHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossSnapshotTraceabilityHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_traceability_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await seedLegacyTestTraceData(client);
      await seedCrossSnapshotTraceabilityHistory(client);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_SNAPSHOT_TRACEABILITY_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-snapshot historical TraceabilityLink did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertHistoricalTraceabilityLinkPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossSnapshotHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await seedCrossSnapshotHistory(invalidUrl);

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_SNAPSHOT_PREFLIGHT_ERROR)) {
      throw new Error('Cross-snapshot historical edge did not produce the expected actionable migration error.');
    }
    await assertHistoricalEdgePreserved(invalidUrl);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossProjectMultiRepoHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_multi_repo_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await client.query(`INSERT INTO "user" (id, email, name, updated_at)
        VALUES ($1, 'legacy.user@example.com', 'Legacy User', now())`, [SEED_USER_ID]);
      await seedLegacyTestTraceData(client);
      await seedLegacyMultiRepoRun(client, SEED_USER_ID);
      await seedCrossProjectMultiRepoHistory(client, SEED_USER_ID);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_PROJECT_MULTI_REPO_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-project multi-repo history did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, assertCrossProjectMultiRepoHistoryPreserved);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossAnalysisReportHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_report_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await seedLegacyTestTraceData(client);
      await client.query(`INSERT INTO "GeneratedDocument"
        (id, "impactAnalysisId", type, status, content, "createdAt", "updatedAt")
        VALUES ('upgrade-other-document', 'upgrade-other-analysis', 'IMPACT_REPORT', 'APPROVED', '# Other analysis', now(), now())`);
      await client.query(`UPDATE reviewed_report_snapshot
        SET approved_document_id = 'upgrade-other-document'
        WHERE id = 'upgrade-report'`);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_ANALYSIS_REPORT_PREFLIGHT_ERROR)) {
      throw new Error('Cross-analysis reviewed-report history did not produce the expected actionable migration error.');
    }
    await assertHistoricalReportLinkPreserved(invalidUrl);
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function verifyCrossAnalysisDocumentJobHistoryFailsClosed(): Promise<void> {
  const invalidDb = `ba_helper_upgrade_document_job_reject_${process.pid}_${randomBytes(4).toString('hex')}`;
  const invalidUrl = tempConnectionStringFor(invalidDb);
  const workspace = createMigrationWorkspace(root, UPGRADE_MIGRATIONS);
  let databaseCreated = false;
  try {
    await withClient(adminConnectionString(), async (client) => {
      await client.query(`CREATE DATABASE "${invalidDb}"`);
      databaseCreated = true;
    });
    await withClient(invalidUrl, async (client) => { await client.query('CREATE EXTENSION IF NOT EXISTS vector'); });
    migrateDeploy(invalidUrl, workspace.configPath);
    await withClient(invalidUrl, async (client) => {
      await seedLegacyTestTraceData(client);
      await client.query(`INSERT INTO "GeneratedDocument"
        (id, "impactAnalysisId", type, status, content, "createdAt", "updatedAt")
        VALUES ('upgrade-other-document', 'upgrade-other-analysis', 'IMPACT_REPORT', 'APPROVED',
          '# Other analysis', now(), now())`);
      await client.query(`UPDATE document_job
        SET generated_document_id = 'upgrade-other-document'
        WHERE id = 'upgrade-document-job'`);
    });

    workspace.includeUpgrades();
    let migrationError = '';
    try {
      migrateDeploy(invalidUrl, workspace.configPath);
    } catch (error) {
      migrationError = commandErrorText(error);
    }
    if (!migrationError.includes(CROSS_ANALYSIS_DOCUMENT_JOB_PREFLIGHT_ERROR)) {
      throw new Error(`Cross-analysis document-job history did not produce the expected actionable migration error (${safeMigrationErrorSummary(migrationError)}).`);
    }
    await withClient(invalidUrl, async (client) => {
      const job = await client.query(`SELECT analysis_id, generated_document_id
        FROM document_job WHERE id = 'upgrade-document-job'`);
      if (job.rowCount !== 1 || job.rows[0].analysis_id !== 'upgrade-analysis' ||
          job.rows[0].generated_document_id !== 'upgrade-other-document') {
        throw new Error('Fail-closed document-job migration changed or deleted the invalid historical link.');
      }
      const oldConstraint = await client.query(`SELECT 1 FROM pg_constraint
        WHERE conrelid = 'document_job'::regclass
          AND conname = 'document_job_generated_document_id_fkey'`);
      const newColumn = await client.query(`SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'document_job'
          AND column_name = 'generated_document_analysis_id'`);
      const newConstraint = await client.query(`SELECT 1 FROM pg_constraint
        WHERE conrelid = 'document_job'::regclass
          AND conname = 'document_job_generated_document_analysis_scope_fkey'`);
      if (oldConstraint.rowCount !== 1 || newColumn.rowCount !== 0 || newConstraint.rowCount !== 0) {
        throw new Error('Failed document-job migration partially replaced its identity constraint.');
      }
    });
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async (client) => {
      await client.query(`DROP DATABASE IF EXISTS "${invalidDb}"`);
    });
  }
}

async function seedCrossSnapshotHistory(connectionString: string): Promise<void> {
  await withClient(connectionString, async (client) => {
    await seedLegacyTestTraceData(client);
    await client.query(`INSERT INTO "RepositorySnapshot"
      (id, "repositoryId", "commitSha", "analyzerVersion", "coverageStatus", "updatedAt")
      VALUES ('upgrade-invalid-snapshot', 'upgrade-repository', $1, 'analyzer@0.3.0', 'READY', now())`, ['c'.repeat(40)]);
    await client.query(`INSERT INTO "CodeArtifact"
      (id, "snapshotId", "artifactKey", name, "artifactType", "filePath", "contentHash", "updatedAt")
      VALUES ('upgrade-invalid-artifact', 'upgrade-invalid-snapshot', 'method:invalid', 'invalid',
        'SERVICE_METHOD', 'invalid.service.ts', 'invalid-hash', now())`);
    await client.query(`INSERT INTO "DependencyEdge" (id, "snapshotId", "fromArtifactId", "toArtifactId", type)
      VALUES ('upgrade-invalid-edge', 'upgrade-snapshot', 'upgrade-invalid-artifact', 'upgrade-method', 'TESTS')`);
  });
}

async function assertHistoricalEdgePreserved(connectionString: string): Promise<void> {
  await withClient(connectionString, async (client) => {
    const edge = await client.query(`SELECT "snapshotId", "fromArtifactId", "toArtifactId"
      FROM "DependencyEdge" WHERE id='upgrade-invalid-edge'`);
    if (edge.rowCount !== 1 || edge.rows[0].snapshotId !== 'upgrade-snapshot' ||
        edge.rows[0].fromArtifactId !== 'upgrade-invalid-artifact' || edge.rows[0].toArtifactId !== 'upgrade-method') {
      throw new Error('Fail-closed migration changed or deleted the invalid historical dependency edge.');
    }
    const constraints = await client.query(`SELECT conname FROM pg_constraint
      WHERE conrelid='"DependencyEdge"'::regclass
        AND conname IN ('DependencyEdge_fromArtifactId_fkey', 'DependencyEdge_toArtifactId_fkey',
          'DependencyEdge_fromArtifactId_snapshotId_fkey', 'DependencyEdge_toArtifactId_snapshotId_fkey')`);
    const names = new Set(constraints.rows.map((row) => row.conname));
    if (!names.has('DependencyEdge_fromArtifactId_fkey') || !names.has('DependencyEdge_toArtifactId_fkey') ||
        names.has('DependencyEdge_fromArtifactId_snapshotId_fkey') || names.has('DependencyEdge_toArtifactId_snapshotId_fkey')) {
      throw new Error('Failed migration partially changed the dependency edge constraints.');
    }
  });
}

async function assertHistoricalReportLinkPreserved(connectionString: string): Promise<void> {
  await withClient(connectionString, async (client) => {
    const snapshot = await client.query(`SELECT approved_document_id FROM reviewed_report_snapshot WHERE id = 'upgrade-report'`);
    if (snapshot.rowCount !== 1 || snapshot.rows[0].approved_document_id !== 'upgrade-other-document') {
      throw new Error('Fail-closed migration changed or deleted the invalid historical approved-document link.');
    }
    const shadowColumn = await client.query(`SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reviewed_report_snapshot'
        AND column_name = 'approved_document_analysis_id'`);
    if (shadowColumn.rowCount !== 0) {
      throw new Error('Failed report-scope migration partially added its identity column.');
    }
    const constraints = await client.query(`SELECT conname FROM pg_constraint
      WHERE conrelid = 'reviewed_report_snapshot'::regclass
        AND conname IN ('reviewed_report_snapshot_approved_document_id_fkey',
          'reviewed_report_snapshot_approved_document_id_analysis_id_fkey')`);
    const names = new Set(constraints.rows.map((row) => row.conname));
    if (!names.has('reviewed_report_snapshot_approved_document_id_fkey') ||
        names.has('reviewed_report_snapshot_approved_document_id_analysis_id_fkey')) {
      throw new Error('Failed report-scope migration partially changed the approved-document constraints.');
    }
  });
}

function tempConnectionStringFor(databaseName: string): string {
  const url = new URL(baseConnectionString());
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function commandErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const candidate = error as { message?: unknown; stdout?: unknown; stderr?: unknown };
  return [candidate.message, candidate.stdout, candidate.stderr]
    .map((value) => value?.toString?.() ?? '')
    .join('\n');
}

function safeMigrationErrorSummary(message: string): string {
  const codes = Array.from(new Set(message.match(/\bP\d{4}\b/g) ?? []));
  const detail = message.match(/(?:ERROR|Error):\s*([^\r\n]+)/i)?.[1]
    ?.replace(/(?:postgres(?:ql)?|redis):\/\/[^\s"']+/gi, '[connection-url]')
    ?.replace(/\b(password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, '$1=[REDACTED]')
    ?.slice(0, 180);
  return `Prisma codes ${codes.join(',') || 'none'}; detail ${detail || 'unavailable'}`;
}

main().catch((error) => {
  console.error(error instanceof Error && error.message ? error.message :
    'Migration upgrade verification failed. Check PostgreSQL/pgvector and DATABASE_URL_TEST.');
  process.exit(1);
});
