const { backendTransform, backendTransformIgnorePatterns } = require('./jest.transforms.cjs');

const roots = ['<rootDir>/apps', '<rootDir>/packages', '<rootDir>/scripts', '<rootDir>/tests'];

function createBackendSharedOptions(options = {}) {
  const moduleNameMapper = {
    '^@ba-helper/contracts$': '<rootDir>/packages/contracts/src/index.ts',
    '^@ba-helper/shared$': '<rootDir>/packages/shared/src/index.ts',
    '^@ba-helper/analyzer$': '<rootDir>/packages/analyzer/src/index.ts',
    '^@ba-helper/application/(.*)$': '<rootDir>/packages/application/src/$1/index.ts',
    '^@ba-helper/application$': '<rootDir>/packages/application/src/index.ts',
    '^@ba-helper/backend-runtime/(.*)$': '<rootDir>/packages/backend-runtime/src/$1/index.ts',
    '^@ba-helper/backend-runtime$': '<rootDir>/packages/backend-runtime/src/index.ts',
  };
  if (options.webAlias) moduleNameMapper['^@/(.*)$'] = '<rootDir>/apps/web/src/$1';
  return {
    roots,
    moduleFileExtensions: ['ts', 'tsx', 'js', 'json'],
    transform: backendTransform,
    transformIgnorePatterns: backendTransformIgnorePatterns,
    moduleNameMapper,
    testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/tests/fixtures/', ...(options.ignore ?? [])],
  };
}

exports.createBackendSharedOptions = createBackendSharedOptions;
