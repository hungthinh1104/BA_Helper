import { assertTestDatabaseLeaseClaim } from '../apps/api/test/e2e/helpers/test-database-lease';

export default async function globalSetup(): Promise<void> {
  await assertTestDatabaseLeaseClaim(process.env);
}
