import type { Config } from 'jest';

const config: Config = {
  testMatch: ['**/*.integration-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['@swc/jest'],
  },
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/tests/fixtures/'],
};

export default config;
