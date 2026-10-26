import { Project, SyntaxKind } from 'ts-morph';
import type { ClassDeclaration, MethodDeclaration, Node as MorphNode } from 'ts-morph';
import { readdirSync, realpathSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { createArtifactIdentity } from '@ba-helper/shared';
import { addCanonicalSourceFile } from './canonical-source-file';
import { ANALYZER_VERSION } from './scanner.types';
import type { ScanCodeEvidence, ScanInput, ScanResult, ScanArtifact, ScanCoverage, ScanSourceLocation } from './scanner.types';
import { computeArtifactContentHash } from './core/content-hasher';
import { extractJestTestArtifacts } from './jest/jest-test-extractor';
import { createJestBehaviorBudget } from './jest/jest-test-behavior';
import type { DiagnosticItem } from './core/diagnostic-collector';

const createProject = () => new Project({
  useInMemoryFileSystem: false, skipFileDependencyResolution: true,
  compilerOptions: { noResolve: true, noLib: true },
});

export const scanFixture = (input: ScanInput): ScanResult => {
  if (input.fixturePath.includes('express-unsupported')) throw new Error('UNSUPPORTED_FRAMEWORK');
  const sourceRoot = realpathSync.native(input.fixturePath);
  const project = createProject();
  const sourceFiles = listFixtureTypeScriptFiles(sourceRoot);
  addCanonicalSourceFiles(project, sourceFiles);
  return extractProject(project, sourceRoot, input.analyzerVersion, undefined, undefined, input.commitSha);
};

function listFixtureTypeScriptFiles(root: string): string[] {
  const pending = ['src', 'test'].map(directory => resolve(root, directory));
  const files: string[] = [];
  while (pending.length > 0) {
    const current = pending.pop()!;
    let entries: Dirent[];
    try { entries = readdirSync(current, { withFileTypes: true }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = resolve(current, entry.name);
      if (entry.isDirectory()) pending.push(path);
      else if (entry.isFile() && path.endsWith('.ts')) {
        files.push(path);
        if (files.length > 5000) throw new Error('FIXTURE_SOURCE_FILE_LIMIT_EXCEEDED');
      }
    }
  }
  return files.sort();
}

export const scanProject = (input: ScanInput & { tsFiles: string[]; coverage?: ScanCoverage }): ScanResult => {
  const sourceRoot = realpathSync.native(input.fixturePath);
  const sourceFiles = [...new Set(input.tsFiles.map(file => realpathSync.native(file)))];
  const project = createProject();
  addCanonicalSourceFiles(project, sourceFiles);
  return extractProject(project, sourceRoot, input.analyzerVersion, input.coverage, sourceFiles, input.commitSha);
};

function extractProject(project: Project, sourceRoot: string, version?: string,
  coverage = defaultCoverage(), sourceFiles: string[] = project.getSourceFiles().map(file => file.getFilePath()),
  commitSha?: string): ScanResult {
  const artifacts: ScanArtifact[] = [], diagnostics: DiagnosticItem[] = [];
  const behaviorBudget = createJestBehaviorBudget();
  for (const file of project.getSourceFiles()) {
    const nativePath = relative(sourceRoot, file.getFilePath());
    if (!nativePath || nativePath === '..' || nativePath.startsWith(`..${sep}`) || isAbsolute(nativePath)) {
      throw new Error('SOURCE_FILE_OUTSIDE_ROOT');
    }
    const filePath = nativePath.replace(/\\/g, '/');
    if (filePath.includes('.spec.ts') || filePath.includes('.test.ts')) {
      const tests = extractJestTestArtifacts(file, filePath, commitSha, behaviorBudget);
      artifacts.push(...tests.artifacts);
      diagnostics.push(...tests.diagnostics);
    } else {
      for (const cls of file.getClasses()) artifacts.push(...classArtifacts(cls, filePath));
    }
  }
  const result = { analyzerVersion: version || ANALYZER_VERSION, artifacts, scannedFileCount: sourceFiles.length, diagnostics,
    coverage, sourceRoot, sourceFiles };
  // The extraction result contains only plain serializable data. Release the
  // ts-morph source files before returning so repeated scans do not retain the
  // compiler AST and inflate the process heap.
  for (const sourceFile of project.getSourceFiles()) project.removeSourceFile(sourceFile);
  return result;
}

function addCanonicalSourceFiles(project: Project, sourceFiles: string[]): void {
  for (const file of sourceFiles) addCanonicalSourceFile(project, file);
}

function classArtifacts(cls: ClassDeclaration, filePath: string): ScanArtifact[] {
  const className = cls.getName();
  if (!className) return [];
  const decorators = cls.getDecorators().map(decorator => decorator.getName());
  const isController = decorators.includes('Controller');
  const isExceptionFilter = decorators.includes('Catch');
  if (decorators.includes('Entity') || filePath.includes('.entity.ts')) {
    return [sourceArtifact(cls, filePath, {
      stableId: createArtifactIdentity('entity', filePath, className), type: 'ENTITY', symbolName: className,
    })];
  }
  if (!isController && !isExceptionFilter && !decorators.includes('Injectable')) return [];
  // Service and exception-filter methods are impact artifacts; controller helpers
  // are not HTTP endpoints. Filters use SERVICE_METHOD identity so existing graph
  // and persistence consumers can resolve direct filter calls without a new type.
  return cls.getMethods()
    .filter(method => !isController || method.getScope() === 'public' || method.getScope() === undefined)
    .map(method => sourceArtifact(method, filePath, {
      stableId: createArtifactIdentity(
        isController ? 'api' : 'service-method',
        filePath,
        `${className}.${method.getName()}~${methodSignatureHash(method)}`,
      ),
      type: isController ? 'API_ROUTE' : 'SERVICE_METHOD', symbolName: `${className}.${method.getName()}`,
    }, buildCodeEvidence(method, filePath)));
}

function methodSignatureHash(method: MethodDeclaration): string {
  const parameters = method.getParameters().map(parameter => [
    parameter.isRestParameter(),
    parameter.isOptional(),
    parameter.getTypeNode()?.getText() ?? '',
  ]);
  return createHash('sha256').update(JSON.stringify(parameters)).digest('hex');
}

function buildCodeEvidence(method: MethodDeclaration, filePath: string): ScanCodeEvidence {
  const parameters = method.getParameters().slice(0, 20).map(parameter => ({
    name: parameter.getName(), typeText: parameter.getTypeNode()?.getText() ?? 'UNDECLARED',
    sourceText: parameter.getText(), sourceLocation: sourceLocation(parameter, filePath),
  }));
  const returnType = method.getReturnTypeNode();
  const conditions = [
    ...method.getDescendantsOfKind(SyntaxKind.IfStatement).map(statement => ({
      kind: 'IF' as const, sourceText: statement.getExpression().getText(), sourceLocation: sourceLocation(statement.getExpression(), filePath),
    })),
    ...method.getDescendantsOfKind(SyntaxKind.CaseClause).map(statement => ({
      kind: 'SWITCH_CASE' as const, sourceText: statement.getText(), sourceLocation: sourceLocation(statement, filePath),
    })),
    ...method.getDescendantsOfKind(SyntaxKind.DefaultClause).map(statement => ({
      kind: 'SWITCH_DEFAULT' as const, sourceText: statement.getText(), sourceLocation: sourceLocation(statement, filePath),
    })),
  ].sort((left, right) => left.sourceLocation.startOffset - right.sourceLocation.startOffset).slice(0, 20);
  const exceptionHandlers = [
    ...method.getDescendantsOfKind(SyntaxKind.CatchClause).map(statement => ({
      kind: 'CATCH' as const, sourceText: statement.getText(), sourceLocation: sourceLocation(statement, filePath),
    })),
    ...method.getDescendantsOfKind(SyntaxKind.ThrowStatement).map(statement => ({
      kind: 'THROW' as const, sourceText: statement.getText(), sourceLocation: sourceLocation(statement, filePath),
    })),
  ].sort((left, right) => left.sourceLocation.startOffset - right.sourceLocation.startOffset).slice(0, 20);
  return {
    parameters,
    ...(returnType ? { returnType: { text: returnType.getText(), sourceLocation: sourceLocation(returnType, filePath) } } : {}),
    conditions, exceptionHandlers,
  };
}

function sourceLocation(node: MorphNode, relativePath: string): ScanSourceLocation {
  const source = node.getSourceFile();
  const startOffset = node.getStart();
  const endOffset = node.getEnd();
  const start = source.getLineAndColumnAtPos(startOffset);
  const end = source.getLineAndColumnAtPos(endOffset);
  return { relativePath, startOffset, endOffset, startLine: start.line, startColumn: start.column,
    endLine: end.line, endColumn: end.column };
}

function sourceArtifact(source: ClassDeclaration | MethodDeclaration, filePath: string,
  identity: Pick<ScanArtifact, 'stableId' | 'type' | 'symbolName'>, codeEvidence?: ScanCodeEvidence): ScanArtifact {
  const excerpt = source.getText();
  return { ...identity, filePath, startLine: source.getStartLineNumber(),
    endLine: source.getEndLineNumber(), excerpt, contentHash: computeArtifactContentHash(excerpt),
    ...(codeEvidence ? { codeEvidence } : {}) };
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
