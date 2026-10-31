import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CheckResult, CommandSpec, RelatedTestSelection } from './types';
import { chooseRelatedTestPaths } from './selection';

export interface RunPrerequisites {
  testTargetsReady: boolean;
  migrationTargetReady: boolean;
  dockerReady: boolean;
  browserReady: boolean;
  pinnedCorpusReady: boolean;
  toolchainReady: boolean;
  testEnvironment?: NodeJS.ProcessEnv;
  pnpmCli?: string;
}

export interface RunControl {
  signal: AbortSignal;
  checks: CheckResult[];
  reportPath: string;
  onChange: () => Promise<void>;
  ownedChildren: Set<number>;
}

export interface SelectionResolution {
  commands: CommandSpec[];
  gaps: string[];
}

export interface DiscoveryInventory {
  runners: Array<{ id: string; count: number; durationMs: number; status: 'PASS' | 'FAIL' | 'BLOCKED'; tests: string[]; evidence: string }>;
  uniqueJestCount: number;
  playwrightCount: number | null;
  parity: 'PASS' | 'FAIL' | 'BLOCKED';
}

export async function collectNativeDiscoveryInventory(root: string, control: RunControl, testTargetsReady: boolean): Promise<DiscoveryInventory> {
  const jestRunners = [
    { id: 'root', cwd: root, cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.config.ts' },
    { id: 'ci', cwd: root, cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.ci.config.ts' },
    { id: 'unit', cwd: root, cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.unit.config.ts' },
    { id: 'integration', cwd: root, cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.integration.config.ts' },
    { id: 'analyzer', cwd: root, cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.analyzer.config.ts' },
    { id: 'api-e2e', cwd: root, cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.e2e.config.ts' },
    { id: 'web', cwd: path.join(root, 'apps/web'), cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.config.ts' },
    { id: 'api-legacy', cwd: path.join(root, 'apps/api'), cli: path.join(root, 'node_modules/jest/bin/jest.js'), config: 'jest.config.js' },
  ];
  const runners: DiscoveryInventory['runners'] = [];
  for (const runner of jestRunners) {
    if (control.signal.aborted) break;
    if (runner.id === 'api-e2e' && !testTargetsReady) {
      runners.push({ id: runner.id, count: 0, durationMs: 0, status: 'BLOCKED', tests: [], evidence: '' });
      continue;
    }
    const args = [runner.cli, '--config', runner.config, '--listTests', '--json', '--runInBand'];
    const result = await spawnOwned(process.execPath, args, runner.cwd, process.env, control, true);
    const tests = result.code === 0 ? parseTestList(result.stdout) : [];
    const evidence = path.join(path.dirname(control.reportPath), `discovery-${runner.id}.json`);
    await writeFile(evidence, `${JSON.stringify({ command: formatCommand(process.execPath, args), exitCode: result.code, tests, stderr: result.stderr }, null, 2)}\n`, 'utf8');
    const status = result.code === 0 && tests.length > 0 ? 'PASS' : 'FAIL';
    runners.push({ id: runner.id, count: tests.length, durationMs: result.durationMs, status, tests, evidence });
    control.checks.push(check(`discovery-${runner.id}`, formatCommand(process.execPath, args), 'Native Jest test inventory.', status, result.startedAt, result.durationMs, result.code, evidence, result.code === 0 ? undefined : result.stderr.slice(0, 500)));
    await control.onChange();
  }

  let playwrightCount: number | null = null;
  let playwrightStatus: DiscoveryInventory['parity'] = 'BLOCKED';
  if (testTargetsReady && !control.signal.aborted) {
    const args = [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config=playwright.config.ts', '--list'];
    const result = await spawnOwned(process.execPath, args, root, process.env, control, true);
    playwrightCount = result.stdout.split(/\r?\n/).filter((line) => /^\s*\[(?:desktop|mobile)\]\s+/.test(line)).length;
    const evidence = path.join(path.dirname(control.reportPath), 'discovery-playwright.json');
    await writeFile(evidence, `${JSON.stringify({ command: formatCommand(process.execPath, args), exitCode: result.code, caseCount: playwrightCount, stdout: result.stdout, stderr: result.stderr }, null, 2)}\n`, 'utf8');
    playwrightStatus = result.code === 0 && playwrightCount >= 16 ? 'PASS' : 'FAIL';
    control.checks.push(check('discovery-playwright', formatCommand(process.execPath, args), 'Native Playwright discovery.', playwrightStatus, result.startedAt, result.durationMs, result.code, evidence, `Discovered ${playwrightCount} configured browser cases.`));
    await control.onChange();
  }
  const union = new Set(runners.filter((runner) => ['root', 'analyzer', 'api-e2e', 'web'].includes(runner.id)).flatMap((runner) => runner.tests.map((test) => canonicalTestPath(root, test))));
  const core = runners.filter((runner) => ['root', 'ci', 'unit', 'integration', 'analyzer', 'web', 'api-legacy'].includes(runner.id));
  const minimums: Record<string, number> = { root: 259, ci: 253, unit: 253, integration: 1, analyzer: 46, web: 48, 'api-legacy': 87 };
  const minimumsPass = core.every((runner) => runner.status === 'PASS' && runner.count >= minimums[runner.id]);
  const parity: DiscoveryInventory['parity'] = control.signal.aborted ? 'BLOCKED' : minimumsPass && playwrightStatus === 'PASS' && union.size >= 357 ? 'PASS' : core.some((runner) => runner.status === 'FAIL') || playwrightStatus === 'FAIL' ? 'FAIL' : 'BLOCKED';
  const inventory: DiscoveryInventory = { runners, uniqueJestCount: union.size, playwrightCount, parity };
  const evidence = path.join(path.dirname(control.reportPath), 'discovery-inventory.json');
  await writeFile(evidence, `${JSON.stringify({ ...inventory, minimumBaseline: minimums, uniqueJestPaths: [...union].sort() }, null, 2)}\n`, 'utf8');
  return inventory;
}

export async function resolveRelatedCommands(commands: CommandSpec[], root: string, control: RunControl): Promise<SelectionResolution> {
  const resolved: CommandSpec[] = [];
  const gaps: string[] = [];
  for (const command of commands) {
    if (!command.selection) { resolved.push(command); continue; }
    const result = command.selection.sourceFiles.length > 0
      ? await discoverRelated(command.selection, root, control)
      : { files: [], exitCode: 0, startedAt: new Date().toISOString(), durationMs: 0 };
    if (control.signal.aborted) { gaps.push(`${command.id}: interrupted during discovery`); continue; }
    const selected = chooseRelatedTestPaths(result.files, existingFallback(command.selection, root));
    if (selected.length === 0) {
      const details = result.exitCode !== 0 ? `Jest discovery exited ${result.exitCode}` : 'Jest returned an empty related-test set and no mapped fallback exists';
      gaps.push(`${command.id}: ${details}`);
      control.checks.push(check(command.id, commandDescription(command), command.reason, 'FAIL', result.startedAt, result.durationMs, result.exitCode, undefined, details));
      await control.onChange();
      continue;
    }
    const usedFallback = result.files.length === 0;
    const config = usedFallback ? command.selection.fallbackConfig ?? command.selection.config : command.selection.config;
    const report = path.join(path.dirname(control.reportPath), `jest-${command.id}.json`);
    const cli = path.join(root, 'node_modules/jest/bin/jest.js');
    const args = [cli, '--config', config, '--runInBand', '--runTestsByPath', ...selected, '--json', '--outputFile', report];
    resolved.push({
      ...command,
      args,
      requires: usedFallback ? command.selection.fallbackRequires : undefined,
      reportPath: report,
      reason: usedFallback ? `${command.reason} Native discovery was empty; selected mapped fallback: ${selected.join(', ')}.` : command.reason,
      selection: undefined,
    });
    control.checks.push(check(
      `${command.id}:discovery`, commandDescription(command), command.reason,
      'PASS', result.startedAt, result.durationMs, result.exitCode, result.evidence,
      usedFallback ? `Native discovery ${result.exitCode === 0 ? 'returned an empty set' : `failed with exit ${result.exitCode}`}; mapped fallback selected ${selected.length} suite(s).` : `Selected ${selected.length} native related suite(s).`,
    ));
    await control.onChange();
  }
  return { commands: resolved, gaps };
}

export async function runCommands(commands: CommandSpec[], root: string, prerequisites: RunPrerequisites, control: RunControl): Promise<number> {
  const statuses = new Map<string, CheckResult['status']>();
  let firstFailure = 0;
  for (const command of commands) {
    if (control.signal.aborted) {
      control.checks.push(check(command.id, commandDescription(command), command.reason, 'INTERRUPTED', new Date().toISOString(), 0, null, undefined, 'Not started after interruption.'));
      await control.onChange();
      continue;
    }
    const blocker = prerequisiteBlocker(command, prerequisites, statuses);
    if (blocker) {
      const result = check(command.id, commandDescription(command), command.reason, 'BLOCKED', new Date().toISOString(), 0, null, undefined, blocker);
      control.checks.push(result); statuses.set(command.id, result.status); await control.onChange();
      if (!firstFailure) firstFailure = 2;
      continue;
    }
    const environment = commandEnv(command, prerequisites);
    const execution = resolveExecutable(command, root, prerequisites.pnpmCli);
    process.stdout.write(`\n[verify-change] ${command.id}: ${formatCommand(execution.file, execution.args)}\n`);
    const startedAt = new Date().toISOString();
    const start = Date.now();
    const result = await spawnOwned(execution.file, execution.args, command.cwd ?? root, environment, control, false);
    const durationMs = Date.now() - start;
    const status = result.code === 0 ? 'PASS' : result.interrupted ? 'INTERRUPTED' : 'FAIL';
    const reportMissing = result.code === 0 && command.reportPath && !existsSync(command.reportPath);
    const finalStatus = reportMissing ? 'FAIL' : status;
    const row = check(command.id, formatCommand(execution.file, execution.args), command.reason, finalStatus, startedAt, durationMs, reportMissing ? 1 : result.code, command.reportPath, reportMissing ? 'Native report was not written.' : result.error);
    control.checks.push(row); statuses.set(command.id, finalStatus); await control.onChange();
    if (finalStatus !== 'PASS' && !firstFailure) firstFailure = result.code && result.code > 0 ? result.code : finalStatus === 'INTERRUPTED' ? 130 : 1;
  }
  return firstFailure;
}

export function discoverRelated(selection: RelatedTestSelection, root: string, control: RunControl): Promise<{ files: string[]; exitCode: number | null; startedAt: string; durationMs: number; evidence?: string }> {
  const cwd = selection.cwd ?? root;
  const jestCli = path.join(root, 'node_modules/jest/bin/jest.js');
  const args = [jestCli, '--config', selection.config, '--findRelatedTests', ...selection.sourceFiles, '--listTests', '--json'];
  return spawnOwned(process.execPath, args, cwd, process.env, control, true).then((result) => {
    const files = result.code === 0 ? parseTestList(result.stdout) : [];
    const evidence = path.join(path.dirname(control.reportPath), `discovery-${selection.id}.json`);
    return import('node:fs/promises').then(({ writeFile }) => writeFile(evidence, `${JSON.stringify({ command: formatCommand(process.execPath, args), exitCode: result.code, selectedTests: files, stdout: result.stdout, stderr: result.stderr }, null, 2)}\n`, 'utf8'))
      .then(() => ({ files, exitCode: result.code, startedAt: result.startedAt, durationMs: result.durationMs, evidence }));
  });
}

function existingFallback(selection: RelatedTestSelection, root: string): string[] {
  return selection.fallbackFiles.filter((file) => existsSync(path.resolve(selection.cwd ?? root, file)));
}

function parseTestList(stdout: string): string[] {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch { return []; }
}

function prerequisiteBlocker(command: CommandSpec, prerequisites: RunPrerequisites, statuses: Map<string, CheckResult['status']>): string | undefined {
  if (!prerequisites.toolchainReady) return 'Required Node/pnpm toolchain did not match the pinned versions.';
  if (command.requires?.includes('test-targets') && !prerequisites.testTargetsReady) return 'Explicit isolated DATABASE_URL_TEST/REDIS_URL_TEST preflight failed; no database/browser command was started.';
  if (command.requires?.includes('migration-target') && !prerequisites.migrationTargetReady) return 'Migration-upgrade drill requires the local disposable ba_helper_test database.';
  if (command.requires?.includes('docker') && !prerequisites.dockerReady) return 'Docker engine is unavailable; isolated release drill was not started.';
  if (command.requires?.includes('browser') && !prerequisites.browserReady) return 'Playwright Chromium is not installed; browser servers were not started.';
  if (command.requires?.includes('pinned-corpus') && !prerequisites.pinnedCorpusReady) return 'Pinned repository corpus is missing or its path is invalid.';
  for (const dependency of command.dependsOn ?? []) {
    if (statuses.get(dependency) !== 'PASS') return `Required prior check ${dependency} did not pass.`;
  }
  return undefined;
}

function commandEnv(command: CommandSpec, prerequisites: RunPrerequisites): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, ...command.env };
  if (command.requires?.includes('test-targets') && prerequisites.testEnvironment) {
    Object.assign(env, prerequisites.testEnvironment);
  }
  return env;
}

function resolveExecutable(command: CommandSpec, root: string, pnpmCli?: string): { file: string; args: string[] } {
  if (command.executable === 'node') return { file: process.execPath, args: command.args };
  if (command.executable === 'pnpm') {
    if (!pnpmCli) throw new Error('Run verify:change through pnpm so its current CLI can be invoked portably.');
    return { file: process.execPath, args: [pnpmCli, ...command.args] };
  }
  if (command.executable === 'playwright') return { file: process.execPath, args: [path.join(root, 'node_modules/@playwright/test/cli.js'), ...command.args] };
  return { file: command.executable, args: command.args };
}

function spawnOwned(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, control: RunControl, capture: boolean): Promise<{ code: number | null; stdout: string; stderr: string; interrupted: boolean; error?: string; startedAt: string; durationMs: number }> {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  if (control.signal.aborted) return Promise.resolve({ code: 130, stdout: '', stderr: '', interrupted: true, startedAt, durationMs: 0 });
  return new Promise((resolve) => {
    const child = spawn(file, args, {
      cwd, env, shell: false, windowsHide: true,
      detached: process.platform !== 'win32',
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    if (child.pid) {
      control.ownedChildren.add(child.pid);
      void control.onChange().catch(() => undefined);
    }
    let stdout = '';
    let stderr = '';
    let spawnError: string | undefined;
    if (capture) {
      child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
      child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });
    }
    const onAbort = () => terminateOwned(child);
    control.signal.addEventListener('abort', onAbort, { once: true });
    child.once('error', (error) => { spawnError = error.message; });
    child.once('close', (code, signal) => {
      control.signal.removeEventListener('abort', onAbort);
      if (child.pid) control.ownedChildren.delete(child.pid);
      const interrupted = control.signal.aborted;
      const exitCode = interrupted ? (signal === 'SIGTERM' ? 143 : 130) : code ?? 127;
      void control.onChange().catch(() => undefined);
      resolve({ code: exitCode, stdout, stderr, interrupted, error: spawnError, startedAt, durationMs: Date.now() - started });
    });
  });
}

function terminateOwned(child: ChildProcess): void {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
    taskkill.unref();
    return;
  }
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  const timeout = setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* process already exited */ } }, 3000);
  timeout.unref();
}

function check(id: string, command: string, reason: string, status: CheckResult['status'], startedAt: string, durationMs: number, exitCode: number | null, evidence?: string, details?: string): CheckResult {
  return { id, command, reason, status, startedAt, durationMs, exitCode, evidence, details };
}

function commandDescription(command: CommandSpec): string { return `${command.executable} ${command.args.map((item) => JSON.stringify(item)).join(' ')}`.trim(); }
function formatCommand(file: string, args: string[]): string { return [file, ...args].map((item) => JSON.stringify(item)).join(' '); }

function canonicalTestPath(root: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(root, file);
  return path.relative(root, absolute).replace(/\\/g, '/').toLowerCase();
}
