import { Project } from 'ts-morph';
import type { ClassDeclaration, MethodDeclaration } from 'ts-morph';
import { realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ANALYZER_VERSION } from './scanner.types';
import type { ScanInput, ScanResult, ScanArtifact, ScanCoverage } from './scanner.types';
import { computeArtifactContentHash } from './core/content-hasher';
import { extractJestTestArtifacts } from './jest/jest-test-extractor';
import type { DiagnosticItem } from './core/diagnostic-collector';

const createProject = () => new Project({
  useInMemoryFileSystem: false, skipFileDependencyResolution: true,
  compilerOptions: { noResolve: true, noLib: true },
});

export const scanFixture = (input: ScanInput): ScanResult => {
  if (input.fixturePath.includes('express-unsupported')) throw new Error('UNSUPPORTED_FRAMEWORK');
  const sourceRoot = realpathSync.native(input.fixturePath);
  const project = createProject();
  project.addSourceFilesAtPaths(join(sourceRoot, 'src/**/*.ts'));
  project.addSourceFilesAtPaths(join(sourceRoot, 'test/**/*.ts'));
  return extractProject(project, sourceRoot, input.analyzerVersion);
};

export const scanProject = (input: ScanInput & { tsFiles: string[]; coverage?: ScanCoverage }): ScanResult => {
  const sourceRoot = realpathSync.native(input.fixturePath);
  const sourceFiles = [...new Set(input.tsFiles.map(file => realpathSync.native(file)))];
  const project = createProject();
  for (const file of sourceFiles) project.addSourceFileAtPath(file);
  return extractProject(project, sourceRoot, input.analyzerVersion, input.coverage, sourceFiles);
};

function extractProject(project: Project, sourceRoot: string, version?: string,
  coverage = defaultCoverage(), sourceFiles: string[] = project.getSourceFiles().map(file => file.getFilePath())): ScanResult {
  const artifacts: ScanArtifact[] = [], diagnostics: DiagnosticItem[] = [];
  for (const file of project.getSourceFiles()) {
    const filePath = relative(sourceRoot, file.getFilePath()).replace(/\\/g, '/');
    if (filePath.includes('.spec.ts') || filePath.includes('.test.ts')) {
      const tests = extractJestTestArtifacts(file, filePath);
      artifacts.push(...tests.artifacts);
      diagnostics.push(...tests.diagnostics);
    } else {
      for (const cls of file.getClasses()) artifacts.push(...classArtifacts(cls, filePath));
    }
  }
  return { analyzerVersion: version || ANALYZER_VERSION, artifacts, diagnostics,
    coverage, sourceRoot, sourceFiles };
}

function classArtifacts(cls: ClassDeclaration, filePath: string): ScanArtifact[] {
  const className = cls.getName();
  if (!className) return [];
  const decorators = cls.getDecorators().map(decorator => decorator.getName());
  const isController = decorators.includes('Controller');
  if (decorators.includes('Entity') || filePath.includes('.entity.ts')) {
    return [sourceArtifact(cls, filePath, {
      stableId: `entity:${className.toLowerCase()}`, type: 'ENTITY', symbolName: className,
    })];
  }
  if (!isController && !decorators.includes('Injectable')) return [];
  // Service helpers are impact artifacts; controller helpers are not HTTP endpoints.
  return cls.getMethods()
    .filter(method => !isController || method.getScope() === 'public' || method.getScope() === undefined)
    .map(method => sourceArtifact(method, filePath, {
      stableId: `${isController ? 'api' : 'service-method'}:${filePath.split('/').pop()?.replace('.ts', '')}.${method.getName()}`,
      type: isController ? 'API_ROUTE' : 'SERVICE_METHOD', symbolName: `${className}.${method.getName()}`,
    }));
}

function sourceArtifact(source: ClassDeclaration | MethodDeclaration, filePath: string,
  identity: Pick<ScanArtifact, 'stableId' | 'type' | 'symbolName'>): ScanArtifact {
  const excerpt = source.getText();
  return { ...identity, filePath, startLine: source.getStartLineNumber(),
    endLine: source.getEndLineNumber(), excerpt, contentHash: computeArtifactContentHash(excerpt) };
}

function defaultCoverage(): ScanCoverage {
  return {
    status: 'FULL', skippedFiles: [],
    skippedSummary: {
      IGNORED_DIRECTORY: 0, UNSUPPORTED_EXTENSION: 0, GENERATED_FILE: 0, VENDOR_FILE: 0,
      BUILD_OUTPUT: 0, FILE_TOO_LARGE: 0, REPO_FILE_LIMIT_EXCEEDED: 0, REPO_SIZE_LIMIT_EXCEEDED: 0,
      SYMLINK_OUTSIDE_ROOT: 0, BINARY_FILE: 0, READ_ERROR: 0, UNSUPPORTED_FRAMEWORK: 0, UNSUPPORTED_LANGUAGE: 0,
    },
    limits: { maxFiles: 0, maxFileBytes: 0 },
    limitHits: { fileLimitHit: false, repoSizeLimitHit: false },
  };
}
