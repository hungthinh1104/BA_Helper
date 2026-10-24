import type { Config } from 'jest';
import { backendTransform, backendTransformIgnorePatterns } from './jest.transforms.cjs';

const config: Config = {
  // The fixture is a source-to-persistence-mapper integration check. Keep the
  // explicit integration suffix for future DB-backed suites, while ensuring
  // this gate exercises at least one real cross-package path today.
  testMatch: ['**/*.integration-spec.ts', '**/qa-test-trace.fixture-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: backendTransform,
  transformIgnorePatterns: backendTransformIgnorePatterns,
  moduleNameMapper: {
    '^@ba-helper/contracts$': '<rootDir>/packages/contracts/src/index.ts',
    '^@ba-helper/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@ba-helper/analyzer$': '<rootDir>/packages/analyzer/src/index.ts',
    '^@ba-helper/application/(.*)$': '<rootDir>/packages/application/src/$1/index.ts',
    '^@ba-helper/application$': '<rootDir>/packages/application/src/index.ts',
    '^@ba-helper/backend-runtime/(.*)$': '<rootDir>/packages/backend-runtime/src/$1/index.ts',
    '^@ba-helper/backend-runtime$': '<rootDir>/packages/backend-runtime/src/index.ts',
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/tests/fixtures/'],
};

export default config;
