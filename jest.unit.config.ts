import type { Config } from 'jest';
import { createBackendSharedOptions } from './jest.shared.config.cjs';

const config: Config = {
  ...createBackendSharedOptions({ webAlias: true, ignore: ['/tests/demo/', '/tests/analyzer/'] }),
  testMatch: ['**/*.spec.ts', '!**/*.integration-spec.ts', '!**/*.fixture-spec.ts'],
};

export default config;
