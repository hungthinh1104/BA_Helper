import type { Config } from 'jest';
import { backendTransform, backendTransformIgnorePatterns } from './jest.transforms.cjs';

const config: Config = {
  testMatch: ['**/*.integration-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: backendTransform,
  transformIgnorePatterns: backendTransformIgnorePatterns,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/tests/fixtures/'],
};

export default config;
