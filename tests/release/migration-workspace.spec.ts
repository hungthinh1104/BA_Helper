import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMigrationWorkspace } from '../../scripts/lib/migration-upgrade-workspace';

describe('migration upgrade workspace', () => {
  let root: string;
  const initial = '20260101000000_initial';
  const upgrade = '20260201000000_upgrade';

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
