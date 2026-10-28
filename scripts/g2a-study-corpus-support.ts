import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Project } from 'ts-morph';
import type { scanPinnedRepository } from './pinned-proof-scan';

export const CORPUS_SHA = '0c30a1828af52cf6528d0b3e9ddf86fc459723f6';
export const CORPUS_URL = 'https://github.com/mutoe/nestjs-realworld-example-app';
export const OUTPUT = path.resolve('artifacts/evaluation/g2a-study-corpus-readiness.json');
export const TESTS_BY_TASK: Record<string, { path: string; titles: string[] }> = {
  'T1-explain-validation': { path: 'src/auth/auth.service.spec.ts', titles: [
    'should return user info without password when validate successful',
    'should throw bad request exception when invalid user',
    'should throw bad request exception when invalid password',
  ] },
  'T2-verify-login-evidence': { path: 'src/auth/auth.service.spec.ts', titles: [
    'should return user profile when login successful',
  ] },
  'T3-predict-controller-error': { path: 'src/auth/auth.controller.spec.ts', titles: [
    'should call login service when call login controller',
  ] },
  'T4-prepare-registration-change': { path: 'src/auth/auth.service.spec.ts', titles: [
    'should return user profile when register successful',
    'should throw error when user name is exist',
    'should throw error when email is exist',
  ] },
  'T5-verify-token-claim': { path: 'src/auth/auth.service.spec.ts', titles: ['should return JWT'] },
};
const REQUIRED_FILES = ['LICENSE', 'package.json', ...new Set(Object.values(TESTS_BY_TASK).flatMap(test => [
  test.path, test.path.replace(/\.spec\.ts$/, '.ts'),
]))];

export type StudyTask = { taskId: string; taskFamily: string; repositoryCommitSha: string;
  target: { filePath: string; symbol: string } };

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, ...args], { encoding: 'utf8' }).trim();
}

export function verifyCorpus(root: string, tasks: StudyTask[]) {
  const head = git(root, 'rev-parse', 'HEAD');
  const dirty = git(root, 'status', '--porcelain', '--untracked-files=all');
  if (head !== CORPUS_SHA || dirty) throw new Error('G2A corpus must be clean and at the exact pinned commit.');
  if (tasks.length !== 5 || tasks.some(task => task.repositoryCommitSha !== CORPUS_SHA)) {
    throw new Error('Study tasks do not match the pinned G2A corpus.');
  }
  const paths = [...new Set([...REQUIRED_FILES, ...tasks.map(task => task.target.filePath)])].sort();
  const files = paths.map(filePath => {
    if (path.isAbsolute(filePath) || filePath.split(/[\\/]/).includes('..')) throw new Error(`Unsafe source path: ${filePath}`);
    const blobSha = git(root, 'rev-parse', `HEAD:${filePath}`);
    const workingTreeSha = git(root, 'hash-object', `--path=${filePath}`, '--', path.join(root, filePath));
    if (blobSha !== workingTreeSha) throw new Error(`Pinned Git blob mismatch: ${filePath}`);
    return { path: filePath, blobSha, workingTreeSha, matchesPinnedGitObject: true };
  });
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
    license?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string>;
  };
  if (packageJson.license !== 'MIT' || !packageJson.devDependencies?.jest || !packageJson.dependencies?.['@nestjs/core']) {
    throw new Error('Pinned package metadata does not confirm the expected MIT/NestJS/Jest corpus.');
  }
  const tree = git(root, 'ls-tree', '-r', 'HEAD').split(/\r?\n/);
  const submodules = tree.filter(line => line.startsWith('160000 commit '));
  const attributes = tree.some(line => line.endsWith('\t.gitattributes')) ? git(root, 'show', 'HEAD:.gitattributes') : '';
  if (submodules.length || /(^|\s)filter=/m.test(attributes)) {
    throw new Error('Submodules or external checkout filters require separate safety review.');
  }
  return { head, clean: true, treeSha: git(root, 'rev-parse', 'HEAD^{tree}'), files,
    licenseId: packageJson.license, jestVersion: packageJson.devDependencies.jest,
    nestVersion: packageJson.dependencies['@nestjs/core'], submoduleCount: submodules.length,
    checkoutFilters: 'NONE' as const };
}

export function sourceIdentities(root: string, tasks: StudyTask[]) {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  return tasks.map(task => {
    const [className, methodName] = task.target.symbol.split('.');
    const file = project.addSourceFileAtPath(path.join(root, task.target.filePath));
    const cls = file.getClass(className);
    const method = cls?.getMethod(methodName);
    return { taskId: task.taskId, filePath: task.target.filePath, qualifiedSymbol: task.target.symbol,
      sourceClassFound: Boolean(cls), sourceMethodFound: Boolean(method),
      classStartLine: cls?.getStartLineNumber() ?? null, methodStartLine: method?.getStartLineNumber() ?? null,
      methodEndLine: method?.getEndLineNumber() ?? null,
      classDecorators: cls?.getDecorators().map(item => item.getName()) ?? [] };
  });
}

export function taskTestEvidence(scanResult: Awaited<ReturnType<typeof scanPinnedRepository>>['scanResult'], task: StudyTask) {
  const testSpec = TESTS_BY_TASK[task.taskId];
  if (!testSpec) throw new Error(`No pinned test selection is defined for ${task.taskId}.`);
  const tests = scanResult.artifacts.filter(item => item.type === 'JEST_TEST_CASE' && item.filePath === testSpec.path);
  const selected = tests.filter(item => testSpec.titles.includes(item.testCase?.title ?? ''));
  return { specPath: testSpec.path, discoveredDeclarationCount: tests.length,
    selectedDeclarations: selected.map(item => ({ artifactKey: item.stableId, title: item.testCase?.title,
      startLine: item.startLine, endLine: item.endLine,
      behaviorEvidenceKinds: [...new Set((item.testCase?.behaviorEvidence ?? []).map(claim => claim.kind))],
      assertionCount: (item.testCase?.behaviorEvidence ?? []).filter(claim => claim.kind === 'ASSERTION').length,
      invocationCount: (item.testCase?.behaviorEvidence ?? []).filter(claim => claim.kind === 'ACTION').length,
      mockCount: (item.testCase?.behaviorEvidence ?? []).filter(claim => claim.kind === 'MOCK').length,
      assertionInvocationAssociations: (item.testCase?.behaviorEvidence ?? [])
        .filter(claim => claim.relatedInvocationSourceLocation).length })),
    missingSelectedTitles: testSpec.titles.filter(title => !selected.some(item => item.testCase?.title === title)) };
}

export function summarizeValues(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: sorted.length, p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}
