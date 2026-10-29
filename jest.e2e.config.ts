import type { Config } from 'jest';
import { backendTransform, backendTransformIgnorePatterns } from './jest.transforms.cjs';

const config: Config = {
  roots: ['<rootDir>/apps', '<rootDir>/packages', '<rootDir>/scripts', '<rootDir>/tests'],
  testMatch: ['**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: backendTransform,
  transformIgnorePatterns: backendTransformIgnorePatterns,
  moduleNameMapper: {
    '^@ba-helper/contracts$': '<rootDir>/packages/contracts/src/index.ts',
    '^@ba-helper/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@ba-helper/analyzer$': '<rootDir>/packages/analyzer/src/index.ts',
    '^@ba-helper/application/(.*)$': '<rootDir>/packages/application/src/$1/index.ts',
    '^@ba-helper/backend-runtime/(.*)$': '<rootDir>/packages/backend-runtime/src/$1/index.ts',
    '^@ba-helper/backend-runtime$': '<rootDir>/packages/backend-runtime/src/index.ts',
    '^@ba-helper/application$': '<rootDir>/packages/application/src/index.ts',
  },
  testEnvironment: 'node',
  // These tests exercise a real API plus PostgreSQL/Redis, so use a bounded
  // integration-test window instead of Jest's 5-second unit-test default.
  testTimeout: 30_000,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/tests/fixtures/'],
  // E2E tests will run sequentially since they interact with a real DB.
};

export default config;
