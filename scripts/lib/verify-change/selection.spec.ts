import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseVerifyArguments } from './arguments';
import { classifyChanges } from './classification';
import { collectChangedPaths, parsePorcelain } from './git-changes';
import { createCommands } from './plan';
import { resolveRelatedCommands, type RunControl } from './runner';
import { chooseRelatedTestPaths } from './selection';
import type { ChangedPath, CommandSpec } from './types';

describe('verify-change CLI and selector', () => {
  it('parses levels, base, explicit paths with spaces, plan, and output', () => {
    expect(parseVerifyArguments([
      '--level', 'focused', '--files', 'apps/api/src/a.ts', 'path with spaces.ts',
      '--base', 'origin/main', '--plan', '--output', 'tmp/evidence dir',
    ])).toEqual({
      level: 'focused', files: ['apps/api/src/a.ts', 'path with spaces.ts'],
      base: 'origin/main', plan: true, outputDirectory: 'tmp/evidence dir',
    });
  });

  it('uses a mapped fallback for an empty native set and leaves a missing fallback empty', () => {
    expect(chooseRelatedTestPaths([], ['mapped-capability.spec.ts'])).toEqual(['mapped-capability.spec.ts']);
    expect(chooseRelatedTestPaths([], [])).toEqual([]);
  });

  it('records an empty related-test set with no fallback as a selector gap', async () => {
    const selection = {
      id: 'related-backend', config: 'jest.config.ts', sourceFiles: [], fallbackFiles: [],
      reason: 'Mapped backend selection.',
    };
    const command: CommandSpec = {
      id: selection.id, executable: 'node', args: [], reason: selection.reason, selection,
    };
    const control: RunControl = {
      signal: new AbortController().signal, checks: [], reportPath: path.join(os.tmpdir(), 'verification.json'),
      ownedChildren: new Set<number>(), onChange: async () => undefined,
    };
    const result = await resolveRelatedCommands([command], process.cwd(), control);
    expect(result.commands).toEqual([]);
    expect(result.gaps).toEqual(expect.arrayContaining([expect.stringContaining('no mapped fallback exists')]));
    expect(control.checks[0]?.status).toBe('FAIL');
  });

  it('parses staged, unstaged, untracked, deleted, and both rename paths without splitting spaces', () => {
    const changes = parsePorcelain([
      'M  staged.ts', ' M worktree file.ts', '?? new file.ts', 'D  deleted.ts',
      'R  destination name.ts', 'source name.ts',
    ].join('\0') + '\0');
    expect(changes).toEqual([
      { path: 'staged.ts', kind: 'modified', source: 'working-tree' },
      { path: 'worktree file.ts', kind: 'modified', source: 'working-tree' },
      { path: 'new file.ts', kind: 'added', source: 'working-tree' },
      { path: 'deleted.ts', kind: 'deleted', source: 'working-tree' },
      { path: 'source name.ts', kind: 'renamed-from', source: 'working-tree' },
      { path: 'destination name.ts', kind: 'renamed-to', source: 'working-tree' },
    ]);
  });

  it('collects Git base changes with staged/unstaged/untracked changes and filters explicit scope', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'verify change repo '));
    try {
      git(root, ['init', '-q']);
      git(root, ['config', 'user.email', 'verify-change@example.test']);
      git(root, ['config', 'user.name', 'Verify Change Test']);
      writeFileSync(path.join(root, 'base.txt'), 'base\n');
      writeFileSync(path.join(root, 'tracked file.ts'), 'old\n');
      writeFileSync(path.join(root, 'rename source.ts'), 'rename\n');
      writeFileSync(path.join(root, 'delete me.ts'), 'delete\n');
      git(root, ['add', '.']); git(root, ['commit', '-qm', 'initial']);
      const base = git(root, ['rev-parse', 'HEAD']).trim();
      writeFileSync(path.join(root, 'committed delta.ts'), 'committed\n');
      git(root, ['add', '.']); git(root, ['commit', '-qm', 'base delta']);
      writeFileSync(path.join(root, 'tracked file.ts'), 'staged\n');
      git(root, ['add', 'tracked file.ts']);
      writeFileSync(path.join(root, 'tracked file.ts'), 'unstaged too\n');
      git(root, ['mv', 'rename source.ts', 'rename destination.ts']);
      rmSync(path.join(root, 'delete me.ts'));
      writeFileSync(path.join(root, 'new untracked.ts'), 'new\n');

      const all = collectChangedPaths(root, undefined, base);
      const paths = new Set(all.map((change) => change.path));
      expect([...paths]).toEqual(expect.arrayContaining([
        'committed delta.ts', 'tracked file.ts', 'rename source.ts', 'rename destination.ts',
        'delete me.ts', 'new untracked.ts',
      ]));
      expect(collectChangedPaths(root, ['tracked file.ts']).map((change) => change.path)).toEqual(['tracked file.ts']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each([
    ['backend service', 'apps/api/src/modules/review/decision.service.ts', 'backend'],
    ['shared contract', 'packages/contracts/src/analysis.contract.ts', 'contracts'],
    ['Prisma', 'apps/api/prisma/schema.prisma', 'prisma'],
    ['embedding/retrieval', 'packages/backend-runtime/src/ai/retrieval.service.ts', 'embedding'],
    ['worker/queue', 'apps/worker/src/queue/scan.processor.ts', 'worker'],
    ['analyzer/test trace', 'packages/analyzer/src/graph/test-trace.ts', 'analyzer'],
    ['frontend runtime', 'apps/web/src/components/workspace/review-panel.tsx', 'frontend'],
    ['unknown executable', 'tools/custom/runner.py', 'full'],
  ])('classifies the %s change area', (_name, file, expected) => {
    const change: ChangedPath = { path: file, kind: 'modified', source: 'explicit' };
    expect(classifyChanges([change]).areas.has(expected as never)).toBe(true);
  });

  it('escalates unknown executable changes to the complete verification plan', () => {
    const root = process.cwd();
    const classification = classifyChanges([{ path: 'tools/custom/runner.py', kind: 'added', source: 'explicit' }]);
    const commands = createCommands(root, 'affected', classification, [], path.join(os.tmpdir(), 'verify change reports'));
    expect(commands.map((command) => command.id)).toContain('dependency-audit');
    expect(commands.map((command) => command.id)).toContain('pinned-comprehension');
    expect(commands.find((command) => command.id === 'analyzer-tests')?.args).toContain('--maxWorkers=2');
  });

  it('selects mandatory Prisma, contract, worker, analyzer, and browser fallbacks', () => {
    const root = process.cwd();
    const output = path.join(os.tmpdir(), 'verify change reports');
    const planFor = (file: string) => createCommands(root, 'affected', classifyChanges([{ path: file, kind: 'modified', source: 'explicit' }]), [{ path: file, kind: 'modified', source: 'explicit' }], output).map((command) => command.id);
    expect(planFor('packages/contracts/src/analysis.contract.ts')).toEqual(expect.arrayContaining(['contract-backend-suite', 'contract-web-suite', 'contract-api-e2e']));
    expect(planFor('apps/api/prisma/schema.prisma')).toEqual(expect.arrayContaining(['prisma-validate', 'prisma-generate', 'migration-upgrade', 'prisma-api-e2e']));
    expect(planFor('apps/worker/src/queue/scan.processor.ts')).toContain('worker-recovery-e2e');
    expect(planFor('packages/analyzer/src/graph/test-trace.ts')).toContain('analyzer-suite');
    expect(planFor('apps/web/src/components/workspace/review-panel.tsx')).toContain('browser-journeys');
  });

  it('maps the code-evidence navigator to the comprehension browser journey', () => {
    const root = process.cwd();
    const changes = [{ path: 'apps/web/src/app/(app)/repositories/[repositoryId]/_components/code-evidence-navigator.tsx', kind: 'modified' as const, source: 'explicit' as const }];
    const commands = createCommands(root, 'affected', classifyChanges(changes), changes, path.join(os.tmpdir(), 'verify change reports'));
    const browser = commands.find((command) => command.id === 'browser-journeys');
    expect(browser?.args).toContain('e2e/code-comprehension-trace.pw.ts');
  });
});

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
