import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMigrationWorkspace } from '../../scripts/lib/migration-upgrade-workspace';
import { UPGRADE_MIGRATIONS } from '../../scripts/lib/migration-upgrade-plan';

describe('migration upgrade workspace', () => {
  let root: string;
  const initial = '20260101000000_initial';
  const upgrade = '20260201000000_upgrade';

  it('withholds idempotency upgrades until legacy rows have been seeded', () => {
    expect(UPGRADE_MIGRATIONS).toContain('20261028150000_requirement_create_idempotency');
    expect(UPGRADE_MIGRATIONS).toContain('20261029120000_multi_repo_request_payload_hash');
    expect(UPGRADE_MIGRATIONS).toContain('20261029130000_multi_repo_request_plan');
    expect(UPGRADE_MIGRATIONS).toContain('20261030180000_evidence_artifact_snapshot_scope');
    expect(UPGRADE_MIGRATIONS).toContain('20261030190000_traceability_link_snapshot_scope');
    expect(UPGRADE_MIGRATIONS).toContain('20261031100000_multi_repo_child_lineage_scope');
    expect(UPGRADE_MIGRATIONS).toContain('20261031110000_clarification_item_analysis_scope');
    expect(UPGRADE_MIGRATIONS).toContain('20261031120000_review_clarification_request_analysis_scope');
    expect(UPGRADE_MIGRATIONS).toContain('20261031160000_evidence_source_origin_scope');
  });

  it('fails closed before adding Evidence source-origin scope constraints', () => {
    const migrationName = '20261031160000_evidence_source_origin_scope';
    const migration = fs.readFileSync(
      path.join(process.cwd(), `apps/api/prisma/migrations/${migrationName}/migration.sql`),
      'utf8',
    );
    const preflight = migration.indexOf('Cannot enforce Evidence source origin scope');
    const constraint = migration.indexOf('ADD CONSTRAINT "Evidence_source_origin_scope_check"');

    expect(preflight).toBeGreaterThanOrEqual(0);
    expect(preflight).toBeLessThan(constraint);
    expect(migration).toContain("'CODE', 'TEST', 'STATIC_ANALYSIS', 'COVERAGE'");
    expect(migration).toContain("'REQUIREMENT_INPUT'");
  });

  it('quotes mixed-case Evidence columns in the historical-origin verifier fixture', () => {
    const fixture = fs.readFileSync(
      path.join(process.cwd(), 'tests/release/evidence-provenance-migration.fixture.ts'),
      'utf8',
    );

    expect(fixture).toContain('"snapshotId", "artifactId", "sourcePath", excerpt');
    expect(fixture).not.toMatch(/, sourcePath, excerpt/);
  });

  it('reports invalid document-job history before locking and rechecks under the write lock', () => {
    const migrationName = '20261031130000_document_job_generated_document_analysis_scope';
    expect(UPGRADE_MIGRATIONS).toContain(migrationName);
    const migration = fs.readFileSync(
      path.join(process.cwd(), `apps/api/prisma/migrations/${migrationName}/migration.sql`),
      'utf8',
    );
    const diagnosticPreflight = migration.indexOf('Cannot enforce DocumentJob generated document analysis scope');
    const begin = migration.indexOf('BEGIN;');
    const lock = migration.indexOf('LOCK TABLE');
    const lockedPreflight = migration.lastIndexOf('Cannot enforce DocumentJob generated document analysis scope');
    const schemaChange = migration.indexOf('ADD COLUMN "generated_document_analysis_id"');

    expect(begin).toBeGreaterThanOrEqual(0);
    expect(diagnosticPreflight).toBeGreaterThanOrEqual(0);
    expect(diagnosticPreflight).toBeLessThan(begin);
    expect(lock).toBeGreaterThan(begin);
    expect(lockedPreflight).toBeGreaterThan(lock);
    expect(schemaChange).toBeGreaterThan(lockedPreflight);
    expect(migration.match(/Cannot enforce DocumentJob generated document analysis scope/g)).toHaveLength(2);
    expect(migration).toMatch(/LOCK TABLE "document_job", "GeneratedDocument"\s+IN SHARE ROW EXCLUSIVE MODE/);
    expect(migration).toContain('"generated_document_analysis_id"');
    expect(migration).toContain('"generated_document_id", "generated_document_analysis_id"');
    expect(migration).toContain('"id", "impactAnalysisId"');
    expect(migration).toContain('document_job_generated_document_analysis_scope_check');
    expect(migration).toContain('ON DELETE SET NULL ON UPDATE CASCADE');
  });

  it('creates the snapshot report identity before removing the legacy report identity', () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        'apps/api/prisma/migrations/20261030100000_generated_document_snapshot_identity/migration.sql',
      ),
      'utf8',
    );
    const snapshotUniqueIndex = migration.indexOf(
      'CREATE UNIQUE INDEX "GeneratedDocument_reviewedReportSnapshotId_type_status_key"',
    );
    const legacyUniqueIndexRemoval = migration.indexOf(
      'DROP INDEX "GeneratedDocument_impactAnalysisId_type_status_key"',
    );
    const legacyNullableIdentityIndex = migration.indexOf(
      'CREATE UNIQUE INDEX "GeneratedDocument_legacy_identity_key"',
    );

    expect(snapshotUniqueIndex).toBeGreaterThanOrEqual(0);
    expect(legacyNullableIdentityIndex).toBeGreaterThanOrEqual(0);
    expect(migration).toContain('WHERE "reviewed_report_snapshot_id" IS NULL');
    expect(legacyNullableIdentityIndex).toBeLessThan(legacyUniqueIndexRemoval);
    expect(legacyUniqueIndexRemoval).toBeGreaterThan(snapshotUniqueIndex);
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-migration-workspace-'));
    const prisma = path.join(root, 'apps/api/prisma');
    fs.mkdirSync(prisma, { recursive: true });
    fs.writeFileSync(path.join(prisma, 'schema.prisma'), '// immutable schema');
    for (const name of [initial, upgrade]) {
      const dir = path.join(prisma, 'migrations', name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'migration.sql'), `-- ${name}`);
    }
    fs.writeFileSync(path.join(prisma, 'migrations/migration_lock.toml'), 'provider = "postgresql"');
  });

  afterEach(() => {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('ba-migration-workspace-') || relative.includes(path.sep)) {
      throw new Error('Unsafe migration fixture cleanup path.');
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('copies the previous chain and restores upgrades only in its scratch directory', () => {
    const workspace = createMigrationWorkspace(root, [upgrade]);
    const original = path.join(root, 'apps/api/prisma/migrations');
    const copied = path.join(path.dirname(workspace.configPath), 'migrations');
    expect(fs.existsSync(path.join(copied, initial, 'migration.sql'))).toBe(true);
    expect(fs.existsSync(path.join(copied, upgrade))).toBe(false);
    expect(fs.readFileSync(path.join(copied, 'migration_lock.toml'), 'utf8')).toContain('postgresql');
    expect(fs.existsSync(path.join(original, upgrade, 'migration.sql'))).toBe(true);
    workspace.includeUpgrades();
    expect(fs.readFileSync(path.join(copied, upgrade, 'migration.sql'), 'utf8')).toBe(`-- ${upgrade}`);
    workspace.cleanup();
    expect(fs.existsSync(path.dirname(workspace.configPath))).toBe(false);
    expect(fs.readFileSync(path.join(original, upgrade, 'migration.sql'), 'utf8')).toBe(`-- ${upgrade}`);
    expect(fs.readFileSync(path.join(root, 'apps/api/prisma/schema.prisma'), 'utf8')).toBe('// immutable schema');
  });

  it('rejects a missing upgrade before creating a scratch workspace', () => {
    expect(() => createMigrationWorkspace(root, ['20260301000000_missing'])).toThrow('Missing upgrade migration');
    expect(fs.existsSync(path.join(root, 'apps/api/tmp'))).toBe(false);
  });

  it.each(['../outside', '/absolute', '20260201000000_upgrade/../../outside'])(
    'rejects an unsafe migration name: %s', name => {
      expect(() => createMigrationWorkspace(root, [name])).toThrow('Invalid upgrade migration name');
    },
  );
});
