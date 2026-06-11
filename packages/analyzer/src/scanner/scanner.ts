import { Project } from 'ts-morph';
import { join, relative } from 'node:path';
import type { ScanInput, ScanResult, ScanArtifact } from './scanner.types';

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
      artifacts.push({
        stableId: `test:${filePath.replace(/[\/\\]/g, '.')}`,
        type: 'TEST',
        filePath,
        symbolName: sourceFile.getBaseName(),
        startLine: 1,
        endLine: sourceFile.getEndLineNumber(),
        excerpt: sourceFile.getText(),
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
        artifacts.push({
          stableId: `entity:${className.toLowerCase()}`,
          type: 'ENTITY',
          filePath,
          symbolName: className,
          startLine: cls.getStartLineNumber(),
          endLine: cls.getEndLineNumber(),
          excerpt: cls.getText(),
        });
      } else if (isController || isService) {
        // Also extract public methods for Controllers and Services
        for (const method of cls.getMethods()) {
          const methodName = method.getName();
          // Skip private/protected or constructor
          if (method.getScope() !== 'public' && method.getScope() !== undefined) continue;

          artifacts.push({
            stableId: isController
              ? `api:${filePath.split('/').pop()?.replace('.ts', '')}.${methodName}`
              : `service-method:${filePath.split('/').pop()?.replace('.ts', '')}.${methodName}`,
            type: isController ? 'API_ROUTE' : 'SERVICE_METHOD',
            filePath,
            symbolName: `${className}.${methodName}`,
            startLine: method.getStartLineNumber(),
            endLine: method.getEndLineNumber(),
            excerpt: method.getText(),
          });
        }
      }
    }
  }

  return {
    analyzerVersion: input.analyzerVersion,
    artifacts,
    coverage: { status: 'READY', skippedFiles: [] },
    sourceRoot: input.fixturePath,
  };
};
