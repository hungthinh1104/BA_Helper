import type { Config } from 'jest';
import { createBackendSharedOptions } from './jest.shared.config.cjs';

const config: Config = {
  ...createBackendSharedOptions(),
  // The fixture is a source-to-persistence-mapper integration check. Keep the
  // explicit integration suffix for future DB-backed suites, while ensuring
  // this gate exercises at least one real cross-package path today.
  testMatch: ['**/*.integration-spec.ts', '**/qa-test-trace.fixture-spec.ts'],
};

export default config;
