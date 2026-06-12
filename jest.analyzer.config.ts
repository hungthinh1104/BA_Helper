import type { Config } from 'jest';

const config: Config = {
  testMatch: ['**/*.fixture-spec.ts', '**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['@swc/jest', {}],
  },
  roots: [
    '<rootDir>/packages/analyzer/tests',
    '<rootDir>/tests/analyzer'
  ],
  testPathIgnorePatterns: [
    '/node_modules/', 
    '/dist/', 
    '/build/', 
    '/tests/fixtures/'
  ],
};

export default config;
