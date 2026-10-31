import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { assertTestDatabaseLeaseClaim } from './test-database-lease';
import { configureIsolatedE2EEnvironment } from './test-environment';

export default async function globalSetup(): Promise<void> {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.test'), quiet: true });
  configureIsolatedE2EEnvironment(process.env);
  await assertTestDatabaseLeaseClaim(process.env);
}
