import * as dotenv from 'dotenv';
import path from 'node:path';
import { assertTestDatabaseLeaseClaim } from '../apps/api/test/e2e/helpers/test-database-lease';

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(__dirname, '..', '.env.test'), quiet: true });
  await assertTestDatabaseLeaseClaim(process.env);
}

main().catch((error: unknown) => {
  process.stderr.write(`[test-db-lease] ${error instanceof Error ? error.message : 'No live test database lease'}\n`);
  process.exitCode = 1;
});
