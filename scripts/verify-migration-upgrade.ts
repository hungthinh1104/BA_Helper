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
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { config } from 'dotenv';
import { seedLegacyTestTraceData, verifyLegacyTestTraceData } from '../tests/release/test-trace-migration.fixture';
import { createMigrationWorkspace } from './lib/migration-upgrade-workspace';

const root = process.cwd();
config({ path: path.join(root, '.env.test'), quiet: true });

// Migrations added on this branch — treated as "the upgrade" under test.
const UPGRADE_MIGRATIONS = [
  '20260726000000_normalize_user_email',
  '20260726010000_index_domain_event_type',
  '20261019000000_dependency_edge_provenance',
  '20261019010000_code_artifact_test_metadata',
  '20261020000000_reviewed_report_test_trace',
  '20261024130000_comprehension_projection_indexes',
];

const TEMP_DB = `ba_helper_upgrade_${process.pid}_${randomBytes(4).toString('hex')}`;
const SEED_USER_ID = '00000000-0000-4000-8000-0000000abcde';
const SEED_EVENT_KEY = 'migration-upgrade-seed-1';

function baseConnectionString(): string {
  return (
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL ||
    'postgresql://ba_helper:ba_helper@localhost:5432/ba_helper_test'
  );
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

async function withClient<T>(connectionString: string, fn: (c: Client) => Promise<T>): Promise<T> {
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
    });

    // 4. Add upgrades to the scratch chain, apply, then prove a repeat is safe.
    workspace.includeUpgrades();
    migrateDeploy(tempUrl, workspace.configPath);
    migrateDeploy(tempUrl, workspace.configPath);

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

      const emailIndex = await c.query(`SELECT to_regclass('user_email_lower_key') AS idx`);
      if (!emailIndex.rows[0].idx) failures.push('case-insensitive email index missing after upgrade');

      const eventIndex = await c.query(`SELECT to_regclass('"DomainEvent_eventType_createdAt_idx"') AS idx`);
      if (!eventIndex.rows[0].idx) failures.push('domain-event index missing after upgrade');
      const reverseEdgeIndex = await c.query(`SELECT to_regclass('"DependencyEdge_snapshotId_toArtifactId_type_idx"') AS idx`);
      if (!reverseEdgeIndex.rows[0].idx) failures.push('reverse comprehension edge index missing after upgrade');
      const evidenceIndex = await c.query(`SELECT to_regclass('"Evidence_snapshotId_artifactId_idx"') AS idx`);
      if (!evidenceIndex.rows[0].idx) failures.push('comprehension evidence index missing after upgrade');
      failures.push(...await verifyLegacyTestTraceData(c));
    });

    if (failures.length > 0) {
      for (const failure of failures) console.error(`- ${failure}`);
      throw new Error(`Migration upgrade verification failed (${failures.length} issue(s)).`);
    }

    console.log('Migration upgrade verified: legacy data survived and upgrades applied.');
  } finally {
    workspace.cleanup();
    if (databaseCreated) await withClient(adminConnectionString(), async c => {
      await c.query(`DROP DATABASE IF EXISTS "${TEMP_DB}"`);
    });
  }
}

main().catch((error) => {
  console.error(error instanceof Error && error.message ? error.message :
    'Migration upgrade verification failed. Check PostgreSQL/pgvector and DATABASE_URL_TEST.');
  process.exit(1);
});
