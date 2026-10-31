import type { Config } from 'jest';
import { createBackendSharedOptions } from './jest.shared.config.cjs';

const config: Config = {
  ...createBackendSharedOptions(),
  testMatch: ['**/*.e2e-spec.ts'],
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/apps/api/test/e2e/helpers/bootstrap-test-environment.ts'],
  // These tests exercise a real API plus PostgreSQL/Redis, so use a bounded
  // integration-test window instead of Jest's 5-second unit-test default.
  testTimeout: 30_000,
  // E2E tests will run sequentially since they interact with a real DB.
};

export default config;
