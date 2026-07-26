/**
 * Migration-upgrade / data-survival gate.
 *
 * Proves that the migrations introduced on this branch upgrade a populated
 * database without losing data:
 *   1. Apply the PREVIOUS migration chain (this branch's new migrations moved aside).
 *   2. Seed representative legacy data (a mixed-case email, a domain event).
 *   3. Apply the CURRENT migrations (the upgrade).
 *   4. Verify the seeded data survived and the upgrade took effect (email
 *      normalized, new indexes present).
 *
 * Runs against a throwaway database so it never touches dev/test data.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

const root = process.cwd();
const migrationsDir = path.join(root, 'apps/api/prisma/migrations');

// Migrations added on this branch — treated as "the upgrade" under test.
const UPGRADE_MIGRATIONS = [
  '20260726000000_normalize_user_email',
  '20260726010000_index_domain_event_type',
];

const TEMP_DB = 'ba_helper_migration_upgrade_test';
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

function migrateDeploy(databaseUrl: string): void {
  execFileSync(
    'pnpm',
    ['--dir', 'apps/api', 'exec', 'prisma', 'migrate', 'deploy', '--config', 'prisma.config.ts', '--schema', 'prisma/schema.prisma'],
    { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' },
  );
}

async function main(): Promise<void> {
  const tempUrl = tempConnectionString();

  // 1. Fresh throwaway DB with pgvector (the schema uses vector columns).
  await withClient(adminConnectionString(), async (c) => {
    await c.query(`DROP DATABASE IF EXISTS "${TEMP_DB}"`);
    await c.query(`CREATE DATABASE "${TEMP_DB}"`);
  });
  await withClient(tempUrl, async (c) => {
    await c.query('CREATE EXTENSION IF NOT EXISTS vector');
  });

  const holding = path.join(root, '.migration-upgrade-holding');
  fs.mkdirSync(holding, { recursive: true });
  const moved: string[] = [];

  try {
    // 2. Move this branch's migrations aside → "previous" schema.
    for (const name of UPGRADE_MIGRATIONS) {
      const src = path.join(migrationsDir, name);
      if (fs.existsSync(src)) {
        fs.renameSync(src, path.join(holding, name));
        moved.push(name);
      }
    }
    if (moved.length !== UPGRADE_MIGRATIONS.length) {
      throw new Error('Expected upgrade migrations were not all found.');
    }

    migrateDeploy(tempUrl);

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
    });

    // 4. Restore migrations and apply the upgrade.
    for (const name of moved.splice(0)) {
      fs.renameSync(path.join(holding, name), path.join(migrationsDir, name));
    }
    migrateDeploy(tempUrl);

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
    });

    if (failures.length > 0) {
      for (const failure of failures) console.error(`- ${failure}`);
      throw new Error(`Migration upgrade verification failed (${failures.length} issue(s)).`);
    }

    console.log('Migration upgrade verified: legacy data survived and upgrades applied.');
  } finally {
    // Always restore any still-moved migration folders.
    for (const name of moved) {
      const held = path.join(holding, name);
      if (fs.existsSync(held)) fs.renameSync(held, path.join(migrationsDir, name));
    }
    fs.rmSync(holding, { recursive: true, force: true });
    await withClient(adminConnectionString(), async (c) => {
      await c.query(`DROP DATABASE IF EXISTS "${TEMP_DB}"`);
    }).catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
