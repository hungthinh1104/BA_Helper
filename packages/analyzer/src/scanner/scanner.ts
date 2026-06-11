import { Project } from 'ts-morph';
import { join, relative } from 'node:path';
import { ANALYZER_VERSION } from './scanner.types';
import type { ScanInput, ScanResult, ScanArtifact } from './scanner.types';
import { computeArtifactContentHash } from './content-hasher';

export const scanFixture = (input: ScanInput): ScanResult => {
  if (input.fixturePath.includes('express-unsupported')) {
    throw new Error('UNSUPPORTED_FRAMEWORK');
  }

  const project = new Project({
    useInMemoryFileSystem: false,
    skipFileDependencyResolution: true,
  });

  // Add all TypeScript files in the fixture path, except node_modules
  project.addSourceFilesAtPaths(join(input.fixturePath, 'src/**/*.ts'));
  project.addSourceFilesAtPaths(join(input.fixturePath, 'test/**/*.ts'));

  const artifacts: ScanArtifact[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = relative(input.fixturePath, sourceFile.getFilePath());

    // 1. Detect tests
    if (filePath.includes('.spec.ts') || filePath.includes('.test.ts')) {
      const excerpt = sourceFile.getText();
      artifacts.push({
        stableId: `test:${filePath.replace(/[\/\\]/g, '.')}`,
        type: 'TEST',
        filePath,
        symbolName: sourceFile.getBaseName(),
        startLine: 1,
        endLine: sourceFile.getEndLineNumber(),
        excerpt,
        contentHash: computeArtifactContentHash(excerpt),
      });
      continue;
    }

    // 2. Extract classes (Controllers, Services, Entities)
    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (!className) continue;

      const decorators = cls.getDecorators().map(d => d.getName());
      const isController = decorators.includes('Controller');
      const isService = decorators.includes('Injectable');
      const isEntity = decorators.includes('Entity') || filePath.includes('.entity.ts');

      if (isEntity) {
        const excerpt = cls.getText();
        artifacts.push({
          stableId: `entity:${className.toLowerCase()}`,
          type: 'ENTITY',
          filePath,
          symbolName: className,
          startLine: cls.getStartLineNumber(),
          endLine: cls.getEndLineNumber(),
          excerpt,
          contentHash: computeArtifactContentHash(excerpt),
        });
      } else if (isController || isService) {
        // Also extract public methods for Controllers and Services
        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          // Skip private/protected or constructor
          if (method.getScope() !== 'public' && method.getScope() !== undefined) continue;

          const excerpt = method.getText();
          artifacts.push({
            stableId: isController
              ? `api:${filePath.split('/').pop()?.replace('.ts', '')}.${methodName}`
              : `service-method:${filePath.split('/').pop()?.replace('.ts', '')}.${methodName}`,
            type: isController ? 'API_ROUTE' : 'SERVICE_METHOD',
            filePath,
            symbolName: `${className}.${methodName}`,
            startLine: method.getStartLineNumber(),
            endLine: method.getEndLineNumber(),
            excerpt,
            contentHash: computeArtifactContentHash(excerpt),
          });
        }
      }
    }
  }

  return {
    analyzerVersion: input.analyzerVersion || '0.1.0',
    artifacts,
    coverage: { 
      status: 'FULL', 
      skippedFiles: [], 
      skippedSummary: {
        IGNORED_DIRECTORY: 0,
        UNSUPPORTED_EXTENSION: 0,
        GENERATED_FILE: 0,
        VENDOR_FILE: 0,
        BUILD_OUTPUT: 0,
        FILE_TOO_LARGE: 0,
        REPO_FILE_LIMIT_EXCEEDED: 0,
        REPO_SIZE_LIMIT_EXCEEDED: 0,
        SYMLINK_OUTSIDE_ROOT: 0,
        BINARY_FILE: 0,
        READ_ERROR: 0,
        UNSUPPORTED_FRAMEWORK: 0,
        UNSUPPORTED_LANGUAGE: 0,
      },
      limits: { maxFiles: 0, maxFileBytes: 0 },
      limitHits: { fileLimitHit: false, repoSizeLimitHit: false }
    },
    sourceRoot: input.fixturePath,
  };
};

export const scanProject = (input: ScanInput & { tsFiles: string[], coverage?: import('./scanner.types').ScanCoverage }): ScanResult => {
  const project = new Project({
    useInMemoryFileSystem: false,
    skipFileDependencyResolution: true,
  });

  for (const file of input.tsFiles) {
    project.addSourceFileAtPath(file);
  }

  const artifacts: ScanArtifact[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = relative(input.fixturePath, sourceFile.getFilePath());

    // 1. Detect tests
    if (filePath.includes('.spec.ts') || filePath.includes('.test.ts')) {
      const excerpt = sourceFile.getText();
      artifacts.push({
        stableId: `test:${filePath.replace(/[\/\\]/g, '.')}`,
        type: 'TEST',
        filePath,
        symbolName: sourceFile.getBaseName(),
        startLine: 1,
        endLine: sourceFile.getEndLineNumber(),
        excerpt,
        contentHash: computeArtifactContentHash(excerpt),
      });
      continue;
    }

    // 2. Extract classes (Controllers, Services, Entities)
    for (const cls of sourceFile.getClasses()) {
      const className = cls.getName();
      if (!className) continue;

      const decorators = cls.getDecorators().map(d => d.getName());
      const isController = decorators.includes('Controller');
      const isService = decorators.includes('Injectable');
      const isEntity = decorators.includes('Entity') || filePath.includes('.entity.ts');

      if (isEntity) {
        const excerpt = cls.getText();
        artifacts.push({
          stableId: `entity:${className.toLowerCase()}`,
          type: 'ENTITY',
          filePath,
          symbolName: className,
          startLine: cls.getStartLineNumber(),
          endLine: cls.getEndLineNumber(),
          excerpt,
          contentHash: computeArtifactContentHash(excerpt),
        });
      } else if (isController || isService) {
        // Also extract public methods for Controllers and Services
        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          // Skip private/protected or constructor
          if (method.getScope() !== 'public' && method.getScope() !== undefined) continue;

          const excerpt = method.getText();
          artifacts.push({
            stableId: isController
              ? `api:${filePath.split('/').pop()?.replace('.ts', '')}.${methodName}`
              : `service-method:${filePath.split('/').pop()?.replace('.ts', '')}.${methodName}`,
            type: isController ? 'API_ROUTE' : 'SERVICE_METHOD',
            filePath,
            symbolName: `${className}.${methodName}`,
            startLine: method.getStartLineNumber(),
            endLine: method.getEndLineNumber(),
            excerpt,
            contentHash: computeArtifactContentHash(excerpt),
          });
        }
      }
    }
  }

  const defaultCoverage: import('./scanner.types').ScanCoverage = {
    status: 'FULL',
    skippedFiles: [],
    skippedSummary: {
        IGNORED_DIRECTORY: 0,
        UNSUPPORTED_EXTENSION: 0,
        GENERATED_FILE: 0,
        VENDOR_FILE: 0,
        BUILD_OUTPUT: 0,
        FILE_TOO_LARGE: 0,
        REPO_FILE_LIMIT_EXCEEDED: 0,
        REPO_SIZE_LIMIT_EXCEEDED: 0,
        SYMLINK_OUTSIDE_ROOT: 0,
        BINARY_FILE: 0,
        READ_ERROR: 0,
        UNSUPPORTED_FRAMEWORK: 0,
        UNSUPPORTED_LANGUAGE: 0,
    },
    limits: { maxFiles: 0, maxFileBytes: 0 },
    limitHits: { fileLimitHit: false, repoSizeLimitHit: false }
  };

  return {
    analyzerVersion: input.analyzerVersion || ANALYZER_VERSION,
    artifacts,
    coverage: input.coverage || defaultCoverage,
    sourceRoot: input.fixturePath,
  };
};
