import nextJest from 'next/jest.js';
import { createRequire } from 'module';

const req = createRequire(import.meta.url);

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost:3000/',
    customExportConditions: [''],
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@mswjs|msw|rettime|outvariant|strict-event-emitter)/)'
  ],
  testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@ba-helper/contracts$': '<rootDir>/../../packages/contracts/src/index.ts',
    '^react$': req.resolve('react'),
    '^react-dom$': req.resolve('react-dom'),
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
export default createJestConfig(customJestConfig);
