import type { Config } from 'jest';
import { createBackendSharedOptions } from './jest.shared.config.cjs';

const config: Config = {
  ...createBackendSharedOptions({ webAlias: true }),
  testMatch: ['**/*.spec.ts'],
};

export default config;
