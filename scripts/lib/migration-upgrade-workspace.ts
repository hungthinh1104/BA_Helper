import fs from 'node:fs';
import path from 'node:path';

/** The repository's migration chain is never moved or edited during an upgrade drill. */
export function createMigrationWorkspace(root: string, upgrades: readonly string[]) {
  const api = path.resolve(root, 'apps/api');
  const prisma = path.join(api, 'prisma');
  const migrations = path.join(prisma, 'migrations');
  for (const name of upgrades) {
    if (!/^\d{14}_[a-z0-9_]+$/.test(name)) throw new Error('Invalid upgrade migration name.');
    if (!fs.existsSync(path.join(migrations, name, 'migration.sql'))) {
      throw new Error(`Missing upgrade migration: ${name}`);
    }
  }
  const scratchRoot = path.join(api, 'tmp');
  fs.mkdirSync(scratchRoot, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(scratchRoot, 'migration-upgrade-'));
  const configPath = path.join(scratch, 'prisma.config.ts');
  const copiedMigrations = path.join(scratch, 'migrations');
  const cleanup = () => {
    const relative = path.relative(scratchRoot, path.resolve(scratch));
    if (!relative.startsWith('migration-upgrade-') || relative.includes(path.sep)) {
      throw new Error('Unsafe migration workspace cleanup path.');
    }
    fs.rmSync(scratch, { recursive: true, force: true });
  };
  const copy = (name: string) => fs.cpSync(path.join(migrations, name), path.join(copiedMigrations, name), { recursive: true });
  try {
    fs.mkdirSync(copiedMigrations);
    fs.copyFileSync(path.join(prisma, 'schema.prisma'), path.join(scratch, 'schema.prisma'));
    const excluded = new Set(upgrades);
    for (const name of fs.readdirSync(migrations)) {
      if (!excluded.has(name)) copy(name);
    }
    fs.writeFileSync(configPath, `import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: './schema.prisma',
  migrations: { path: './migrations' },
  datasource: { url: process.env.DATABASE_URL },
});
`);
    return { configPath, includeUpgrades: () => { for (const name of upgrades) copy(name); }, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
