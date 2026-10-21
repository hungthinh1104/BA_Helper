import type { Config } from 'jest';
import { backendTransform, backendTransformIgnorePatterns } from './jest.transforms.cjs';

const config: Config = {
  testMatch: ['**/*.spec.ts', '!**/*.integration-spec.ts', '!**/*.fixture-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: backendTransform,
  transformIgnorePatterns: backendTransformIgnorePatterns,
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
