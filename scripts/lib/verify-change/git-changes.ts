import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { ChangedPath, ChangeKind } from './types';

export function collectChangedPaths(root: string, explicit?: string[], base?: string): ChangedPath[] {
  const current = parsePorcelain(execGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  const committed = base ? parseDiffNames(root, base) : [];
  const all = unique([...committed, ...current]);
  if (!explicit) return all;
  const selected = new Set(explicit.map((file) => normalizeRepoPath(root, file)));
  return unique([...selected].map((file) => ({
    ...(all.find((change) => change.path === file) ?? { kind: 'modified' as const }),
    path: file,
    source: 'explicit' as const,
  })));
}

export function parsePorcelain(output: string): ChangedPath[] {
  const fields = output.split('\0');
  const changes: ChangedPath[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const record = fields[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const currentPath = record.slice(3).replace(/\\/g, '/');
    if (status.includes('R') || status.includes('C')) {
      const previousPath = (fields[++index] ?? '').replace(/\\/g, '/');
      changes.push({ path: previousPath, kind: 'renamed-from', source: 'working-tree' });
      changes.push({ path: currentPath, kind: 'renamed-to', source: 'working-tree' });
    } else {
      changes.push({ path: currentPath, kind: statusKind(status), source: 'working-tree' });
    }
  }
  return changes;
}

export function diffFingerprint(root: string, changed: ChangedPath[]): string {
  const hash = createHash('sha256');
  for (const args of [['diff', '--binary', 'HEAD'], ['diff', '--binary', '--cached', 'HEAD']] as const) {
    hash.update(execGit(root, [...args]));
  }
  for (const item of [...changed].sort((left, right) => left.path.localeCompare(right.path))) {
    hash.update(`${item.source}:${item.kind}:${item.path}\0`);
    const absolute = path.join(root, item.path);
    if (existsSync(absolute) && !item.kind.includes('from') && item.kind !== 'deleted') hash.update(readFileSync(absolute));
  }
  return hash.digest('hex');
}

export function normalizeRepoPath(root: string, value: string): string {
  const absolute = path.resolve(root, value);
  const relative = path.relative(root, absolute);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Verification path is outside the repository: ${value}`);
  }
  return relative.split(path.sep).join('/');
}

export function execGit(root: string, args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function parseDiffNames(root: string, base: string): ChangedPath[] {
  const mergeBase = execGit(root, ['merge-base', base, 'HEAD']).trim();
  const fields = execGit(root, ['diff', '--name-status', '-z', '--find-renames', mergeBase, 'HEAD']).split('\0');
  const changes: ChangedPath[] = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ path: fields[index++].replace(/\\/g, '/'), kind: 'renamed-from', source: 'committed' });
      changes.push({ path: fields[index++].replace(/\\/g, '/'), kind: 'renamed-to', source: 'committed' });
    } else {
      changes.push({ path: fields[index++].replace(/\\/g, '/'), kind: statusKind(status), source: 'committed' });
    }
  }
  return changes;
}

function statusKind(status: string): ChangeKind {
  if (status.includes('D')) return 'deleted';
  if (status === '??' || status.includes('A')) return 'added';
  return 'modified';
}

function unique(items: ChangedPath[]): ChangedPath[] {
  const result = new Map<string, ChangedPath>();
  const priority = (item: ChangedPath): number => item.source === 'working-tree' ? 3 : item.source === 'committed' ? 2 : 1;
  for (const item of items) {
    const previous = result.get(item.path);
    if (!previous || priority(item) >= priority(previous)) result.set(item.path, item);
  }
  return [...result.values()].sort((left, right) => left.path.localeCompare(right.path));
}
