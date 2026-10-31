import type { Config } from 'jest';
import { createBackendSharedOptions } from './jest.shared.config.cjs';

const config: Config = {
  ...createBackendSharedOptions(),
  testMatch: ['**/*.fixture-spec.ts', '**/*.spec.ts'],
  roots: [
    '<rootDir>/packages/analyzer/tests',
    '<rootDir>/tests/analyzer'
  ],
};

export default config;
