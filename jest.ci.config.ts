import type { Config } from 'jest';
import { backendTransform, backendTransformIgnorePatterns } from './jest.transforms.cjs';

const config: Config = {
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
  transform: backendTransform,
  transformIgnorePatterns: backendTransformIgnorePatterns,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@ba-helper/contracts$': '<rootDir>/packages/contracts/src/index.ts',
    '^@ba-helper/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@ba-helper/analyzer$': '<rootDir>/packages/analyzer/src/index.ts',
    '^@ba-helper/application/(.*)$': '<rootDir>/packages/application/src/$1/index.ts',
    '^@ba-helper/application$': '<rootDir>/packages/application/src/index.ts',
    '^@ba-helper/backend-runtime/(.*)$': '<rootDir>/packages/backend-runtime/src/$1/index.ts',
    '^@ba-helper/backend-runtime$': '<rootDir>/packages/backend-runtime/src/index.ts',
  },
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/tests/fixtures/',
    '/tests/demo/',
    '/tests/analyzer/',
  ],
};

export default config;
