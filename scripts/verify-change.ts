import * as dotenv from 'dotenv';
import { spawnSync } from 'node:child_process';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseVerifyArguments } from './lib/verify-change/arguments';
import { classifyChanges } from './lib/verify-change/classification';
import { collectChangedPaths, diffFingerprint, execGit } from './lib/verify-change/git-changes';
import { createCommands } from './lib/verify-change/plan';
import { collectNativeDiscoveryInventory, resolveRelatedCommands, runCommands, type DiscoveryInventory, type RunControl, type RunPrerequisites } from './lib/verify-change/runner';
import type { CheckResult, CommandSpec, VerifyArguments } from './lib/verify-change/types';
import { validateTestTargets } from '../apps/api/test/e2e/helpers/test-target-safety';
import { chromium } from '@playwright/test';

const EXPECTED_NODE = 'v22.23.3';
const EXPECTED_PNPM = '11.28.6';

interface VerificationReport {
  schemaVersion: 1;
  status: 'PLANNED' | 'RUNNING' | 'READY' | 'PARTIAL' | 'BLOCKED';
  phase: 'preflight' | 'discovery' | 'selection' | 'execution' | 'finished';
  pendingCommands: string[];
  startedAt: string;
  finishedAt?: string;
  source: { head: string; branch: string; diffFingerprint: string; baseline?: string };
  toolchain: { node: string; pnpm: string | null; expectedNode: string; expectedPnpm: string; ready: boolean };
  level: string;
  explicitScope: boolean;
  selectedFiles: Array<{ path: string; kind: string; source: string }>;
  outsideScope: string[];
  areas: string[];
  fullReasons: string[];
  prerequisites: Record<string, unknown>;
  discovery?: DiscoveryInventory;
  plannedCommands: Array<{ id: string; command: string; reason: string; prerequisites?: string[] }>;
  checks: CheckResult[];
  interrupted: boolean;
  ownedChildren: number[];
  sourceChangedDuringRun?: boolean;
  gaps: string[];
}

async function main(): Promise<number> {
  const args = parseVerifyArguments(process.argv.slice(2));
  dotenv.config({ path: path.resolve('.env.test'), quiet: true });
  const root = execGit(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  const allChanges = collectChangedPaths(root, undefined, args.base);
  const changes = collectChangedPaths(root, args.files, args.base);
  if (changes.length === 0 && args.level !== 'full') throw new Error('No changed files were selected. Pass --files, --base, or make a worktree change.');
  const outsideScope = args.files ? allChanges.filter((change) => !new Set(changes.map((item) => item.path)).has(change.path)).map((change) => change.path) : [];
  const classification = classifyChanges(changes);
  const effectiveLevel = args.level === 'affected' && classification.areas.has('full') ? 'full' : args.level;
  const evidenceDirectory = await createEvidenceDirectory(root, args.outputDirectory);
  const reportPath = path.join(evidenceDirectory, 'verification.json');
  const checks: CheckResult[] = [];
  const abortController = new AbortController();
  const ownedChildren = new Set<number>();
  let reportWriteQueue = Promise.resolve();
  let interrupted = false;
  const onSigint = () => { interrupted = true; abortController.abort(); };
  const onSigterm = () => { interrupted = true; abortController.abort(); };
  process.once('SIGINT', onSigint);
  process.once('SIGTERM', onSigterm);
  let discovery: DiscoveryInventory | undefined;
  const gaps: string[] = [];
  let report!: VerificationReport;
  const persistReport = async (): Promise<void> => {
    if (!report) return;
    report.ownedChildren = [...ownedChildren];
    const snapshot = `${JSON.stringify(report, null, 2)}\n`;
    reportWriteQueue = reportWriteQueue.catch(() => undefined).then(() => writeReport(reportPath, snapshot));
    await reportWriteQueue;
  };
  const control: RunControl = {
    signal: abortController.signal, checks, reportPath,
    ownedChildren,
    onChange: async () => {
      const interruptedCheck = checks.some((item) => item.status === 'INTERRUPTED' || item.exitCode === 130 || item.exitCode === 143);
      if (interruptedCheck) {
        report.interrupted = true;
        if (report.phase !== 'finished') report.status = 'BLOCKED';
      }
      if (report?.phase === 'execution') {
        const completed = new Set(checks.map((item) => item.id));
        report.pendingCommands = report.plannedCommands.map((item) => item.id).filter((id) => !completed.has(id));
      }
      await persistReport();
    },
  };
  try {
    const head = execGit(root, ['rev-parse', 'HEAD']).trim();
    const branch = execGit(root, ['branch', '--show-current']).trim();
    const fingerprint = diffFingerprint(root, allChanges);
    const pnpmCli = process.env.npm_execpath;
    const pnpmVersion = pnpmCli && existsSync(pnpmCli) ? runVersion(process.execPath, [pnpmCli, '--version']) : null;
    const toolchainReady = process.version === EXPECTED_NODE && pnpmVersion === EXPECTED_PNPM;
    let testTargets: ReturnType<typeof validateTestTargets> | undefined;
    let testTargetError: string | undefined;
    try { testTargets = validateTestTargets(process.env); } catch (error) { testTargetError = safeError(error); }
    const corpusPath = path.resolve(root, process.env.PINNED_CORPUS_PATH || 'tmp/corpora/nest-api-example');
    const dockerReady = canReachDocker();
    const browserExecutable = chromium.executablePath();
    const browserReady = existsSync(browserExecutable);
    const testEnvironment = testTargets ? {
      DATABASE_URL: process.env.DATABASE_URL_TEST!,
      DATABASE_URL_TEST: process.env.DATABASE_URL_TEST!,
      REDIS_URL: process.env.REDIS_URL_TEST!,
      REDIS_URL_TEST: process.env.REDIS_URL_TEST!,
      BA_HELPER_DEVELOPMENT_REDIS_URL: process.env.BA_HELPER_DEVELOPMENT_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379/0',
      NODE_ENV: 'test', AI_PROVIDER: 'fake', EMBEDDING_PROVIDER: 'fake',
    } : undefined;
    const prerequisites: RunPrerequisites = {
      testTargetsReady: Boolean(testTargets),
      migrationTargetReady: Boolean(testTargets && ['localhost', '127.0.0.1', '::1'].includes(testTargets.database.host) && testTargets.database.name === 'ba_helper_test'),
      dockerReady, browserReady, pinnedCorpusReady: existsSync(corpusPath),
      toolchainReady, testEnvironment, pnpmCli,
    };
    report = {
      schemaVersion: 1, status: args.plan ? 'PLANNED' : 'RUNNING', phase: 'preflight', pendingCommands: [], startedAt: new Date().toISOString(),
      source: { head, branch, diffFingerprint: fingerprint, baseline: args.base },
      toolchain: { node: process.version, pnpm: pnpmVersion, expectedNode: EXPECTED_NODE, expectedPnpm: EXPECTED_PNPM, ready: toolchainReady },
      level: effectiveLevel, explicitScope: Boolean(args.files),
      selectedFiles: changes.map(({ path: file, kind, source }) => ({ path: file, kind, source })),
      outsideScope, areas: [...classification.areas].sort(), fullReasons: classification.fullReasons,
      prerequisites: {
        testTargets: testTargets ? { status: 'READY', database: testTargets.database, redis: testTargets.redis } : { status: 'BLOCKED', detail: testTargetError },
        docker: dockerReady ? 'READY' : 'BLOCKED', pinnedCorpus: { path: corpusPath, status: existsSync(corpusPath) ? 'READY' : 'BLOCKED' },
        migrationTarget: testTargets && ['localhost', '127.0.0.1', '::1'].includes(testTargets.database.host) && testTargets.database.name === 'ba_helper_test' ? 'READY' : 'BLOCKED',
        browser: { status: browserReady ? 'READY' : 'BLOCKED', executable: browserExecutable },
        toolchain: toolchainReady ? 'READY' : 'BLOCKED',
      },
      plannedCommands: [], checks, interrupted: false, ownedChildren: [], gaps,
    };
    await persistReport();

    let commands = createCommands(root, effectiveLevel, classification, changes, evidenceDirectory);
    report.phase = 'discovery';
    report.pendingCommands = ['native discovery'];
    report.plannedCommands = commands.map((command) => ({
      id: command.id,
      command: describeCommand(command, pnpmCli),
      reason: command.reason,
      prerequisites: command.requires,
    }));
    await persistReport();
    if (args.plan || effectiveLevel === 'full') {
      discovery = await collectNativeDiscoveryInventory(root, control, prerequisites.testTargetsReady);
      report.discovery = discovery;
      if (discovery.parity !== 'PASS') gaps.push(`Native test discovery parity: ${discovery.parity}.`);
    }
    report.phase = 'selection';
    report.pendingCommands = ['related-test selection'];
    await persistReport();
    const selection = await resolveRelatedCommands(commands, root, control);
    commands = selection.commands;
    gaps.push(...selection.gaps);
    if (gaps.length > 0) {
      checks.push({ id: 'selector-validation', command: 'native discovery + declarative fallbacks', reason: 'Selector gaps must not be reported as a passing test run.', status: 'FAIL', startedAt: new Date().toISOString(), durationMs: 0, exitCode: 1, details: gaps.join('; ') });
    }
    report.plannedCommands = commands.map((command) => ({
      id: command.id,
      command: describeCommand(command, pnpmCli),
      reason: command.reason,
      prerequisites: command.requires,
    }));
    report.phase = args.plan ? 'finished' : 'execution';
    report.pendingCommands = args.plan ? [] : commands.map((command) => command.id);
    await persistReport();
    printPlan(report, evidenceDirectory, args.plan);

    let exitCode = 0;
    if (!args.plan) {
      exitCode = await runCommands(commands, root, prerequisites, control);
      if (gaps.length > 0 && exitCode === 0) exitCode = 1;
    }
    const latestChanges = collectChangedPaths(root, undefined, args.base);
    report.sourceChangedDuringRun = diffFingerprint(root, latestChanges) !== fingerprint;
    if (report.sourceChangedDuringRun) {
      gaps.push('Candidate diff changed while checks were running; affected results are not current.');
      if (exitCode === 0) exitCode = 2;
    }
    report.finishedAt = new Date().toISOString();
    report.interrupted ||= interrupted;
    report.phase = 'finished';
    report.pendingCommands = [];
    if (args.plan) report.status = 'PLANNED';
    else if (report.interrupted || report.sourceChangedDuringRun || checks.some((item) => item.status === 'BLOCKED')) report.status = 'BLOCKED';
    else if (checks.some((item) => item.status === 'FAIL' || item.status === 'INTERRUPTED')) report.status = 'PARTIAL';
    else report.status = 'READY';
    await persistReport();
    process.stdout.write(`\n[verify-change] ${report.status}; evidence: ${reportPath}\n`);
    return exitCode;
  } finally {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
    if (report) {
      report.interrupted ||= interrupted;
      if (report.interrupted) report.status = 'BLOCKED';
      if (!interrupted && report.phase !== 'finished') report.status = 'RUNNING';
      await persistReport();
    }
  }
}

async function createEvidenceDirectory(root: string, requested?: string): Promise<string> {
  const base = path.resolve(root, requested || 'artifacts/evaluation/verify-change');
  const relative = path.relative(root, base);
  if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
    const ignored = spawnSync('git', ['check-ignore', '--no-index', '--', relative], { cwd: root, stdio: 'ignore', shell: false }).status === 0;
    if (!ignored) throw new Error('--output inside the repository must resolve to a Git-ignored directory.');
  }
  const runId = `${new Date().toISOString().replace(/[:.]/g, '')}-${process.pid}-${randomUUID().slice(0, 8)}`;
  const destination = path.join(base, `run-${runId}`);
  await mkdir(destination, { recursive: true });
  return destination;
}

function runVersion(executable: string, args: string[]): string | null {
  const result = spawnSync(executable, args, { encoding: 'utf8', timeout: 5000, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
  return result.status === 0 ? result.stdout.trim().replace(/^pnpm\s+/, '') : null;
}

function canReachDocker(): boolean {
  const result = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', timeout: 5000, shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
  return result.status === 0 && result.stdout.trim().length > 0;
}

function describeCommand(command: CommandSpec, pnpmCli?: string): string {
  if (command.selection) return `Jest --config ${command.selection.config} --findRelatedTests ${command.selection.sourceFiles.map((file) => JSON.stringify(file)).join(' ')}`;
  const prefix = command.executable === 'node' ? [process.execPath]
    : command.executable === 'pnpm' ? [process.execPath, pnpmCli ?? '<pnpm CLI unavailable>']
      : command.executable === 'playwright' ? [process.execPath, path.join(process.cwd(), 'node_modules/@playwright/test/cli.js')]
        : ['git'];
  return [...prefix, ...command.args].map((item) => JSON.stringify(item)).join(' ');
}

function printPlan(report: VerificationReport, evidenceDirectory: string, planOnly: boolean): void {
  process.stdout.write(`Verification level: ${report.level}${planOnly ? ' (plan only)' : ''}\n`);
  process.stdout.write(`Source: ${report.source.head}; changed paths: ${report.selectedFiles.length}; scope areas: ${report.areas.join(', ') || 'none'}\n`);
  process.stdout.write(`Toolchain: Node ${report.toolchain.node}, pnpm ${report.toolchain.pnpm ?? 'unavailable'} (${report.toolchain.ready ? 'ready' : 'blocked'})\n`);
  process.stdout.write(`Test targets: ${JSON.stringify(report.prerequisites.testTargets)}\n`);
  if (report.outsideScope.length) process.stdout.write(`Outside explicit scope: ${report.outsideScope.join(', ')}\n`);
  if (report.fullReasons.length) process.stdout.write(`FULL reasons: ${report.fullReasons.join('; ')}\n`);
  if (report.discovery) process.stdout.write(`Discovery parity: ${report.discovery.parity}; unique Jest ${report.discovery.uniqueJestCount}; Playwright ${report.discovery.playwrightCount ?? 'blocked'}\n`);
  for (const command of report.plannedCommands) process.stdout.write(`- ${command.id}: ${command.command} — ${command.reason}\n`);
  process.stdout.write(`Evidence directory: ${evidenceDirectory}\n`);
}

function safeError(error: unknown): string { return error instanceof Error ? error.message : 'test-target validation failed'; }

async function writeReport(file: string, snapshot: string): Promise<void> {
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, snapshot, 'utf8');
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await rename(temporary, file);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(code ?? '') || attempt === 3) break;
      await new Promise((resolve) => setTimeout(resolve, 40 * 2 ** attempt));
    }
  }
  await writeFile(file, snapshot, 'utf8');
  await unlink(temporary).catch(() => undefined);
}

main().then((code) => { process.exitCode = code; }).catch((error: unknown) => {
  process.stderr.write(`[verify-change] ${safeError(error)}\n`);
  process.exitCode = 1;
});
