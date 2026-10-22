import { createHash } from 'node:crypto';
import { isAbsolute, relative, resolve } from 'node:path';
import type { ScanArtifact } from '../scanner/scanner.types';
import type { RuntimeTraceOutcome } from './jest-runtime-trace.types';

export function indexStaticCases(artifacts: readonly ScanArtifact[]): Map<string, ScanArtifact[]> {
  const index = new Map<string, ScanArtifact[]>();
  for (const value of artifacts as readonly unknown[]) {
    if (!isRecord(value) || value.type !== 'JEST_TEST_CASE' || !isRecord(value.testCase)
      || value.testCase.framework !== 'jest' || typeof value.stableId !== 'string' || !value.stableId
      || typeof value.filePath !== 'string') continue;
    const artifact = value as unknown as ScanArtifact;
    const relativePath = strictRepositoryPath(artifact.filePath);
    if (!relativePath || !Number.isSafeInteger(artifact.startLine) || artifact.startLine < 1) continue;
    const key = `${relativePath}:${artifact.startLine}`;
    const candidates = index.get(key);
    if (candidates) candidates.push(artifact);
    else index.set(key, [artifact]);
  }
  return index;
}

export function repositoryRelativePath(repoRoot: string, rawPath: unknown): string | null {
  if (typeof rawPath !== 'string' || rawPath.length === 0) return null;
  const absolutePath = resolve(repoRoot, rawPath);
  const pathFromRoot = relative(resolve(repoRoot), absolutePath);
  if (!pathFromRoot || pathFromRoot === '..' || pathFromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`)
    || isAbsolute(pathFromRoot)) return null;
  return strictRepositoryPath(pathFromRoot);
}

export function strictRepositoryPath(path: string): string | null {
  const normalized = path.replace(/\\/g, '/');
  if (!normalized || normalized.length > 1000 || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) return null;
  const segments = normalized.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) return null;
  return segments.join('/');
}

export function readLocation(value: unknown, columnBase: 0 | 1): { line: number; column: number } | null {
  if (!isRecord(value)) return null;
  return Number.isSafeInteger(value.line) && (value.line as number) > 0
    && Number.isSafeInteger(value.column) && (value.column as number) >= columnBase
    ? { line: value.line as number, column: (value.column as number) + (columnBase === 0 ? 1 : 0) } : null;
}

export function readOutcome(value: unknown): RuntimeTraceOutcome {
  if (value === 'passed') return 'PASSED';
  if (value === 'failed') return 'FAILED';
  if (value === 'pending') return 'PENDING';
  if (value === 'todo') return 'TODO';
  return 'UNKNOWN';
}

export function finiteNonnegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function normalizeCommit(value: string): string {
  if (!/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(value)) throw new TypeError('Commit SHA must be a full hexadecimal SHA-1 or SHA-256.');
  return value.toLowerCase();
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function increment(values: Map<string, number>, code: string): void {
  values.set(code, (values.get(code) ?? 0) + 1);
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
