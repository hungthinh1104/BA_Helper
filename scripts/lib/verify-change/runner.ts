import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CheckResult, CommandSpec, RelatedTestSelection } from './types';
import { chooseRelatedTestPaths } from './selection';
import { canonicalPlaywrightFile, validateNativeReport, type NativeReportExpectation } from './native-report';
import { redactNativeValue, redactText } from './safe-evidence';

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
  isSourceStable?: () => boolean;
  invalidateSource?: () => void;
}

export interface SelectionResolution {
  commands: CommandSpec[];
  gaps: string[];
}

export interface DiscoveryInventory {
  runners: Array<{ id: string; count: number; durationMs: number; status: 'PASS' | 'FAIL' | 'BLOCKED'; tests: string[]; evidence: string; details?: string }>;
  uniqueJestCount: number;
  playwrightCount: number | null;
  approvalStatus: 'APPROVED' | 'PENDING_REVIEW' | 'INVALID';
  differences: Array<{ runner: string; added: string[]; removed: string[] }>;
  parity: 'PASS' | 'FAIL' | 'BLOCKED';
}

export interface NativeEvidenceSummary {
  expectedExecution: { runner: 'jest' | 'playwright'; files: string[]; cases: number | null };
  observedExecution: { files: string[]; cases: number; executedCases: number; skippedCases: number };
  skipExpectations: Array<{ identity: string; state: 'SKIP_REQUIRED' | 'EXECUTION_REQUIRED'; observed: 'SKIPPED' | 'EXECUTED' | 'MISSING' }>;
  retryFailures: Array<{ identity: string; failedAttempts: number; finalStatus: string }>;
  qualificationReasons: string[];
}

interface TestInventoryBaseline {
  schemaVersion: number;
  baselineCommitSha: string;
  approval: { status: string; reviewer: string | null; reviewedAt: string | null };
  jestRunners: Array<{ id: string; tests: string[] }>;
  playwrightTests: Array<{ project: string; file: string; line: number; column: number; title: string }>;
  approvedSkips: Array<{ runner: string; project?: string; file: string; title: string; reason: string }>;
  approvedDifferences?: Array<{ runner: string; reviewedBy: string; reviewedAt: string; added: string[]; removed: string[] }>;
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
    const parsed = result.code === 0 ? parseNativeTestList(result.stdout) : { valid: false, tests: [] as string[] };
    const tests = parsed.valid ? parsed.tests : [];
    const evidence = path.join(path.dirname(control.reportPath), `discovery-${runner.id}.json`);
    await writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, tests, stderr: result.stderr }), null, 2)}\n`, 'utf8');
    const status = result.code === 0 && parsed.valid && tests.length > 0 ? 'PASS' : 'FAIL';
    const details = result.code !== 0 ? result.stderr.slice(0, 500) : !parsed.valid ? 'Jest discovery did not emit a JSON string array.' : tests.length === 0 ? 'Jest discovery returned no test files.' : undefined;
    runners.push({ id: runner.id, count: tests.length, durationMs: result.durationMs, status, tests, evidence, details });
    control.checks.push(check(`discovery-${runner.id}`, formatCommand(process.execPath, args), 'Native Jest test inventory.', status, result.startedAt, result.durationMs, status === 'PASS' ? result.code : result.code || 1, evidence, details));
    await control.onChange();
  }

  let playwrightCount: number | null = null;
  let playwrightTests: TestInventoryBaseline['playwrightTests'] = [];
  let playwrightStatus: DiscoveryInventory['parity'] = 'BLOCKED';
  if (testTargetsReady && !control.signal.aborted) {
    const args = [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', '--config=playwright.config.ts', '--list'];
    const result = await spawnOwned(process.execPath, args, root, process.env, control, true);
    playwrightTests = parsePlaywrightTestList(result.stdout);
    playwrightCount = playwrightTests.length;
    const evidence = path.join(path.dirname(control.reportPath), 'discovery-playwright.json');
    await writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, tests: playwrightTests, caseCount: playwrightCount, stdout: result.stdout, stderr: result.stderr }), null, 2)}\n`, 'utf8');
    playwrightStatus = result.code === 0 && playwrightCount > 0 ? 'PASS' : 'FAIL';
    control.checks.push(check('discovery-playwright', formatCommand(process.execPath, args), 'Native Playwright discovery.', playwrightStatus, result.startedAt, result.durationMs, playwrightStatus === 'PASS' ? result.code : result.code || 1, evidence, `Discovered ${playwrightCount} configured browser cases.`));
    await control.onChange();
  }
  const union = new Set(runners.flatMap((runner) => runner.tests.map((test) => canonicalTestPath(root, test))));
  const baselinePath = path.join(root, 'tests/evaluation/test-inventory/baseline.json');
  const comparison = compareInventory(root, baselinePath, runners, playwrightTests);
  const discoveryFailed = runners.some((runner) => runner.status === 'FAIL') || playwrightStatus === 'FAIL';
  const parity: DiscoveryInventory['parity'] = control.signal.aborted || comparison.approvalStatus !== 'APPROVED'
    ? 'BLOCKED'
    : discoveryFailed || comparison.differences.some((difference) => difference.added.length + difference.removed.length > 0)
      ? 'FAIL'
      : 'PASS';
  const inventory: DiscoveryInventory = { runners, uniqueJestCount: union.size, playwrightCount, approvalStatus: comparison.approvalStatus, differences: comparison.differences, parity };
  const evidence = path.join(path.dirname(control.reportPath), 'discovery-inventory.json');
  await writeFile(evidence, `${JSON.stringify({ ...inventory, baselinePath, baselineCommitSha: comparison.baselineCommitSha, uniqueJestPaths: [...union].sort() }, null, 2)}\n`, 'utf8');
  return inventory;
}

export function compareInventory(
  root: string,
  baselinePath: string,
  runners: DiscoveryInventory['runners'],
  playwrightTests: TestInventoryBaseline['playwrightTests'],
): { baselineCommitSha: string | null; approvalStatus: DiscoveryInventory['approvalStatus']; differences: DiscoveryInventory['differences'] } {
  let baseline: TestInventoryBaseline;
  try { baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as TestInventoryBaseline; }
  catch { return { baselineCommitSha: null, approvalStatus: 'INVALID', differences: [] }; }
  if (!isValidInventoryBaseline(baseline)) {
    return { baselineCommitSha: baseline.baselineCommitSha ?? null, approvalStatus: 'INVALID', differences: [] };
  }
  const differences: DiscoveryInventory['differences'] = [];
  const expectedRunners = new Map(baseline.jestRunners.map((runner) => [runner.id, runner.tests.map(normalizeInventoryPath).sort()]));
  for (const runner of runners) {
    const expected = new Set(expectedRunners.get(runner.id) ?? []);
    const current = new Set(runner.tests.map((file) => canonicalTestPath(root, file)));
    differences.push({ runner: runner.id, added: [...current].filter((file) => !expected.has(file)).sort(), removed: [...expected].filter((file) => !current.has(file)).sort() });
    expectedRunners.delete(runner.id);
  }
  for (const [runner, expected] of expectedRunners) differences.push({ runner, added: [], removed: expected });
  const expectedPlaywright = new Set(baseline.playwrightTests.map(playwrightInventoryIdentity));
  const currentPlaywright = new Set(playwrightTests.map(playwrightInventoryIdentity));
  differences.push({ runner: 'playwright', added: [...currentPlaywright].filter((test) => !expectedPlaywright.has(test)).sort(), removed: [...expectedPlaywright].filter((test) => !currentPlaywright.has(test)).sort() });
  const pending = baseline.approval.status !== 'APPROVED' || !baseline.approval.reviewer?.trim() || !baseline.approval.reviewedAt;
  const unexpected = differences.some((difference) => difference.added.length + difference.removed.length > 0 && !isApprovedDifference(baseline, difference));
  const approvalStatus = pending ? 'PENDING_REVIEW' : unexpected ? 'INVALID' : 'APPROVED';
  return { baselineCommitSha: baseline.baselineCommitSha, approvalStatus, differences };
}

function isValidInventoryBaseline(baseline: TestInventoryBaseline): boolean {
  if (baseline.schemaVersion !== 1 || typeof baseline.baselineCommitSha !== 'string' || !baseline.baselineCommitSha ||
      !baseline.approval || !['APPROVED', 'PENDING_REVIEW'].includes(baseline.approval.status) ||
      !Array.isArray(baseline.jestRunners) || !Array.isArray(baseline.playwrightTests) || !Array.isArray(baseline.approvedSkips)) return false;
  if (baseline.approval.reviewer !== null && typeof baseline.approval.reviewer !== 'string') return false;
  if (baseline.approval.reviewedAt !== null && typeof baseline.approval.reviewedAt !== 'string') return false;
  if (baseline.jestRunners.some((runner) => !runner || typeof runner.id !== 'string' || !runner.id || !Array.isArray(runner.tests) || runner.tests.some((test) => typeof test !== 'string'))) return false;
  if (new Set(baseline.jestRunners.map((runner) => runner.id)).size !== baseline.jestRunners.length) return false;
  if (baseline.playwrightTests.some((test) => !test || typeof test.project !== 'string' || typeof test.file !== 'string' || typeof test.title !== 'string' || typeof test.line !== 'number' || typeof test.column !== 'number')) return false;
  if (new Set(baseline.playwrightTests.map(playwrightInventoryIdentity)).size !== baseline.playwrightTests.length) return false;
  if (baseline.approvedSkips.some((skip) => !skip || typeof skip.runner !== 'string' || typeof skip.file !== 'string' || typeof skip.title !== 'string' || typeof skip.reason !== 'string' || (skip.project !== undefined && typeof skip.project !== 'string'))) return false;
  if (baseline.approvedDifferences && (!Array.isArray(baseline.approvedDifferences) || baseline.approvedDifferences.some((change) => !change || typeof change.runner !== 'string' || typeof change.reviewedBy !== 'string' || typeof change.reviewedAt !== 'string' || !Array.isArray(change.added) || change.added.some((item) => typeof item !== 'string') || !Array.isArray(change.removed) || change.removed.some((item) => typeof item !== 'string')))) return false;
  return true;
}

function isApprovedDifference(baseline: TestInventoryBaseline, difference: DiscoveryInventory['differences'][number]): boolean {
  const change = baseline.approvedDifferences?.find((entry) => entry && typeof entry.runner === 'string' && entry.runner === difference.runner && typeof entry.reviewedBy === 'string' && entry.reviewedBy.trim() && entry.reviewedAt &&
    equalStringSets(entry.added, difference.added) && equalStringSets(entry.removed, difference.removed));
  return Boolean(change);
}

function equalStringSets(left: string[], right: string[]): boolean {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return leftSorted.length === rightSorted.length && leftSorted.every((item, index) => item === rightSorted[index]);
}

function normalizeInventoryPath(file: string): string { return file.replace(/\\/g, '/'); }

function playwrightInventoryIdentity(test: TestInventoryBaseline['playwrightTests'][number]): string {
  return `${test.project}:${normalizeInventoryPath(test.file)}:${test.line}:${test.column}:${test.title}`;
}

export async function resolveRelatedCommands(commands: CommandSpec[], root: string, control: RunControl, testTargetsReady = true): Promise<SelectionResolution> {
  const resolved: CommandSpec[] = [];
  const gaps: string[] = [];
  for (const command of commands) {
    if (!command.selection) {
      const mapped = await validateExplicitMappedSuites(command, root, control, testTargetsReady);
      if (mapped) {
        if (!mapped.valid) gaps.push(`${command.id}: ${mapped.details}`);
        if (mapped.check) { control.checks.push(mapped.check); await control.onChange(); }
        if (mapped.valid) resolved.push(command);
      } else resolved.push(command);
      continue;
    }
    const result = command.selection.sourceFiles.length > 0
      ? await discoverRelated(command.selection, root, control)
      : { files: [], exitCode: 0, valid: true, startedAt: new Date().toISOString(), durationMs: 0 };
    if (control.signal.aborted) { gaps.push(`${command.id}: interrupted during discovery`); continue; }
    const selected = chooseRelatedTestPaths(result.files, existingFallback(command.selection, root));
    const nativeDiscoveryFailed = result.exitCode !== 0 || !result.valid;
    const discoveryFailure = result.exitCode !== 0
      ? `Jest discovery exited ${result.exitCode}`
      : !result.valid ? 'Jest discovery output was not valid JSON test-file data' : undefined;
    if (nativeDiscoveryFailed) gaps.push(`${command.id}: ${discoveryFailure}; result remains failed even if a mapped fallback runs.`);
    if (selected.length === 0) {
      const details = discoveryFailure ?? (result.files.length === 0 ? 'Jest returned an empty related-test set and no mapped fallback exists' : 'No selected related-test file exists.');
      gaps.push(`${command.id}: ${details}`);
      control.checks.push(check(command.id, commandDescription(command), command.reason, 'FAIL', result.startedAt, result.durationMs, result.exitCode || 1, result.evidence, details));
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
    const discoveryCheck = check(
      `${command.id}:discovery`, commandDescription(command), command.reason,
      nativeDiscoveryFailed ? 'FAIL' : 'PASS', result.startedAt, result.durationMs, nativeDiscoveryFailed ? result.exitCode || 1 : result.exitCode, result.evidence,
      usedFallback ? `${nativeDiscoveryFailed ? `${discoveryFailure}; ` : 'Native discovery returned an empty set; '}mapped fallback selected ${selected.length} suite(s).` : `Selected ${selected.length} native related suite(s).`,
    );
    discoveryCheck.fallbackUsed = usedFallback;
    control.checks.push(discoveryCheck);
    await control.onChange();
  }
  return { commands: resolved, gaps };
}

async function validateExplicitMappedSuites(command: CommandSpec, root: string, control: RunControl, testTargetsReady: boolean): Promise<{ valid: boolean; details: string; check?: CheckResult } | undefined> {
  if (command.executable === 'playwright') {
    const files = command.args.filter((arg) => arg.replace(/\\/g, '/').startsWith('e2e/') && arg.endsWith('.pw.ts'));
    if (files.length === 0 && !command.args.some((arg) => arg.endsWith('.pw.ts'))) return undefined;
    if (command.requires?.includes('test-targets') && !testTargetsReady) {
      return selectionCheck(command, 'BLOCKED', 'Explicit browser mappings require validated local test targets before native discovery.');
    }
    const args = [path.join(root, 'node_modules/@playwright/test/cli.js'), ...command.args, '--list'];
    const result = await spawnOwned(process.execPath, args, root, process.env, control, true);
    const tests = parsePlaywrightTestList(result.stdout);
    const selected = new Set(tests.map((test) => test.file.replace(/\\/g, '/')));
    const missing = files.filter((file) => !existsSync(path.resolve(root, file)) || ![...selected].some((candidate) => playwrightTestFileMatches(root, file, candidate)));
    const valid = result.code === 0 && tests.length > 0 && missing.length === 0;
    const details = valid ? `Native Playwright discovery found ${tests.length} mapped case(s).`
      : result.code !== 0 ? `Playwright discovery exited ${result.code}: ${redactText(result.stderr).slice(0, 300)}`
        : tests.length === 0 ? 'Playwright discovery returned no mapped test cases.' : `Mapped browser files are missing from native discovery: ${missing.join(', ')}.`;
    const evidence = path.join(path.dirname(control.reportPath), `selection-${command.id}.json`);
    await writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, tests, missing, stdout: result.stdout, stderr: result.stderr }), null, 2)}\n`, 'utf8');
    return selectionCheck(command, valid ? 'PASS' : 'FAIL', details, result.startedAt, result.durationMs, valid ? result.code : result.code || 1, evidence);
  }
  const files = explicitJestFiles(command.args);
  if (files.length === 0) return undefined;
  if (command.requires?.includes('test-targets') && !testTargetsReady) {
    return selectionCheck(command, 'BLOCKED', 'Explicit integration mappings require validated local test targets before native discovery.');
  }
  const rawConfigIndex = command.args.indexOf('--config');
  const config = rawConfigIndex >= 0 ? command.args[rawConfigIndex + 1] : command.id.toLowerCase().includes('e2e') ? 'jest.e2e.config.ts' : 'jest.config.ts';
  const args = [path.join(root, 'node_modules/jest/bin/jest.js'), '--config', config!, '--runTestsByPath', ...files, '--listTests', '--json', '--runInBand'];
  const result = await spawnOwned(process.execPath, args, command.cwd ?? root, process.env, control, true);
  const parsed = result.code === 0 ? parseNativeTestList(result.stdout) : { valid: false, tests: [] as string[] };
  const expected = new Set(files.map((file) => canonicalTestPath(root, file)));
  const discovered = new Set(parsed.tests.map((file) => canonicalTestPath(root, file)));
  const missing = [...expected].filter((file) => !existsSync(path.resolve(root, file)) || !discovered.has(file));
  const valid = result.code === 0 && parsed.valid && parsed.tests.length > 0 && missing.length === 0;
  const details = valid ? `Native Jest discovery found all ${files.length} mapped suite(s).`
    : result.code !== 0 ? `Jest discovery exited ${result.code}: ${redactText(result.stderr).slice(0, 300)}`
      : !parsed.valid ? 'Jest discovery returned malformed JSON test-file data.'
        : parsed.tests.length === 0 ? 'Jest discovery returned no mapped test files.' : `Mapped Jest suites are missing from native discovery: ${missing.join(', ')}.`;
  const evidence = path.join(path.dirname(control.reportPath), `selection-${command.id}.json`);
  await writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, tests: parsed.tests, missing, stderr: result.stderr }), null, 2)}\n`, 'utf8');
  return selectionCheck(command, valid ? 'PASS' : 'FAIL', details, result.startedAt, result.durationMs, valid ? result.code : result.code || 1, evidence);
}

export function playwrightTestFileMatches(root: string, expectedFile: string, discoveredFile: string): boolean {
  const identities = (file: string): Set<string> => {
    const absolute = path.isAbsolute(file) ? path.resolve(file) : path.resolve(root, file);
    const paths = [absolute];
    if (!path.isAbsolute(file)) paths.push(path.resolve(root, 'e2e', file));
    const keys = new Set<string>();
    for (const candidate of paths) {
      const relative = path.relative(root, candidate);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) continue;
      const normalized = relative.split(path.sep).join('/');
      keys.add(process.platform === 'win32' ? normalized.toLowerCase() : normalized);
    }
    return keys;
  };
  const discovered = identities(discoveredFile);
  return [...identities(expectedFile)].some((identity) => discovered.has(identity));
}

export function explicitJestFiles(args: string[]): string[] {
  const index = args.indexOf('--runTestsByPath');
  if (index < 0) return [];
  const files: string[] = [];
  for (const arg of args.slice(index + 1)) {
    if (arg === '--') break;
    if (arg.startsWith('--')) break;
    files.push(arg);
  }
  return files;
}

function selectionCheck(command: CommandSpec, status: CheckResult['status'], details: string, startedAt = new Date().toISOString(), durationMs = 0, exitCode: number | null = null, evidence?: string): { valid: boolean; details: string; check: CheckResult } {
  return { valid: status === 'PASS', details, check: check(`${command.id}:selection`, commandDescription(command), 'Every mapped suite must exist in native runner discovery.', status, startedAt, durationMs, exitCode, evidence, details) };
}

export async function runCommands(commands: CommandSpec[], root: string, prerequisites: RunPrerequisites, control: RunControl): Promise<number> {
  const statuses = new Map<string, CheckResult['status']>();
  let firstFailure = 0;
  for (const command of commands) {
    if (control.isSourceStable && !control.isSourceStable()) control.invalidateSource?.();
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
    if (command.reportPath && !command.nativeExpectation) {
      command.nativeExpectation = await discoverNativeExpectation(command, root, environment, control);
    }
    process.stdout.write(`\n[verify-change] ${command.id}: ${formatCommand(execution.file, execution.args)}\n`);
    const startedAt = new Date().toISOString();
    const start = Date.now();
    const result = await spawnOwned(execution.file, execution.args, command.cwd ?? root, environment, control, Boolean(command.logPath), Boolean(command.logPath));
    const durationMs = Date.now() - start;
    if (command.logPath) {
      await writeFile(command.logPath, `${redactText(result.stdout)}\n--- stderr ---\n${redactText(result.stderr)}`, 'utf8');
    }
    const status = result.code === 0 ? 'PASS' : result.interrupted ? 'INTERRUPTED' : 'FAIL';
    const reportMissing = Boolean(command.reportPath && !existsSync(command.reportPath));
    const reportValidation = command.reportPath && existsSync(command.reportPath) && command.nativeExpectation
      ? await validateNativeReport(command.reportPath, command.id, root, command.nativeExpectation, environment)
      : undefined;
    const reportInvalid = Boolean(reportValidation && !reportValidation.valid);
    const finalStatus = status === 'PASS' && (reportMissing || reportInvalid) ? 'FAIL' : status;
    const details = [result.error, reportMissing ? 'Native report was not written.' : undefined, reportValidation?.details]
      .filter((item): item is string => Boolean(item)).join('; ') || undefined;
    const row = check(command.id, formatCommand(execution.file, execution.args), command.reason, finalStatus, startedAt, durationMs,
      reportMissing || reportInvalid ? 1 : result.code, command.reportPath, details);
    if (reportValidation) {
      row.skips = reportValidation.skips;
      row.fallbackUsed = command.reason.includes('mapped fallback:');
      row.nativeEvidence = {
        expectedExecution: reportValidation.expectedExecution,
        observedExecution: reportValidation.observedExecution,
        skipExpectations: reportValidation.skipExpectations,
        retryFailures: reportValidation.retryFailures,
        qualificationReasons: reportValidation.qualificationReasons,
      };
    }
    control.checks.push(row); statuses.set(command.id, finalStatus); await control.onChange();
    if (finalStatus !== 'PASS' && !firstFailure) firstFailure = result.code && result.code > 0 ? result.code : finalStatus === 'INTERRUPTED' ? 130 : 1;
  }
  return firstFailure;
}

async function discoverNativeExpectation(command: CommandSpec, root: string, env: NodeJS.ProcessEnv, control: RunControl): Promise<NativeReportExpectation> {
  const isPlaywright = command.executable === 'playwright' || command.id.toLowerCase().includes('browser');
  const reportDirectory = path.dirname(control.reportPath);
  if (isPlaywright) {
    const args = [path.join(root, 'node_modules/@playwright/test/cli.js'), ...command.args, '--list'];
    const result = await spawnOwned(process.execPath, args, command.cwd ?? root, env, control, true);
    const cases = result.code === 0 ? parsePlaywrightTestList(result.stdout) : [];
    const error = result.code !== 0
      ? `Playwright native discovery failed with exit ${result.code}.`
      : cases.length === 0 ? 'Playwright native discovery returned no selected cases.' : undefined;
    const evidence = path.join(reportDirectory, `native-discovery-${command.id}.json`);
    await writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, cases, stderr: result.stderr }), null, 2)}\n`, 'utf8');
    return { runner: 'playwright', files: unique(cases.map((item) => canonicalPlaywrightFile(root, item.file))), cases, discoveryError: error };
  }

  const jestCli = path.join(root, 'node_modules/jest/bin/jest.js');
  const configIndex = command.args.indexOf('--config');
  const config = configIndex >= 0 ? command.args[configIndex + 1] : command.id.toLowerCase().includes('e2e') ? 'jest.e2e.config.ts' : 'jest.config.ts';
  const files = explicitJestFiles(command.args);
  const args = [jestCli, '--config', config ?? 'jest.config.ts', ...(files.length ? ['--runTestsByPath', ...files] : []), '--listTests', '--json', '--runInBand'];
  const cwd = command.cwd ?? root;
  const result = await spawnOwned(process.execPath, args, cwd, env, control, true);
  const parsed = result.code === 0 ? parseNativeTestList(result.stdout) : { valid: false, tests: [] as string[] };
  const error = result.code !== 0
    ? `Jest native discovery failed with exit ${result.code}.`
    : !parsed.valid ? 'Jest native discovery returned malformed output.'
      : parsed.tests.length === 0 ? 'Jest native discovery returned no selected suites.' : undefined;
  const evidence = path.join(reportDirectory, `native-discovery-${command.id}.json`);
  await writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, files: parsed.tests, stderr: result.stderr }), null, 2)}\n`, 'utf8');
  return { runner: 'jest', files: parsed.tests.map((item) => canonicalTestPath(root, item)), discoveryError: error };
}

function unique(items: string[]): string[] { return [...new Set(items)]; }

export function discoverRelated(selection: RelatedTestSelection, root: string, control: RunControl): Promise<{ files: string[]; exitCode: number | null; valid: boolean; startedAt: string; durationMs: number; evidence?: string }> {
  const cwd = selection.cwd ?? root;
  const jestCli = path.join(root, 'node_modules/jest/bin/jest.js');
  const args = [jestCli, '--config', selection.config, '--findRelatedTests', ...selection.sourceFiles, '--listTests', '--json'];
  return spawnOwned(process.execPath, args, cwd, process.env, control, true).then((result) => {
    const parsed = result.code === 0 ? parseNativeTestList(result.stdout) : { valid: false, tests: [] as string[] };
    const files = parsed.valid ? parsed.tests : [];
    const evidence = path.join(path.dirname(control.reportPath), `discovery-${selection.id}.json`);
    return import('node:fs/promises').then(({ writeFile }) => writeFile(evidence, `${JSON.stringify(redactNativeValue({ command: formatCommand(process.execPath, args), exitCode: result.code, selectedTests: files, stdout: result.stdout, stderr: result.stderr }), null, 2)}\n`, 'utf8'))
      .then(() => ({ files, exitCode: result.code === 0 && !parsed.valid ? 1 : result.code, valid: parsed.valid, startedAt: result.startedAt, durationMs: result.durationMs, evidence }));
  });
}

function existingFallback(selection: RelatedTestSelection, root: string): string[] {
  return selection.fallbackFiles.filter((file) => existsSync(path.resolve(selection.cwd ?? root, file)));
}

export function parseNativeTestList(stdout: string): { valid: boolean; tests: string[] } {
  try {
    const parsed: unknown = JSON.parse(stdout.trim());
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) return { valid: false, tests: [] };
    return { valid: true, tests: parsed };
  } catch { return { valid: false, tests: [] }; }
}

function parsePlaywrightTestList(stdout: string): Array<{ project: string; file: string; line: number; column: number; title: string }> {
  const tests: Array<{ project: string; file: string; line: number; column: number; title: string }> = [];
  const pattern = new RegExp('^\\s*\\[(desktop|mobile)\\]\\s+\\u203a\\s+(.+?):(\\d+):(\\d+)\\s+\\u203a\\s+(.+)$');
  for (const line of stdout.split(/\r?\n/)) {
    const match = pattern.exec(line);
    if (!match) continue;
    tests.push({ project: match[1]!, file: match[2]!.replace(/\\/g, '/'), line: Number(match[3]), column: Number(match[4]), title: match[5]! });
  }
  return tests;
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

function spawnOwned(file: string, args: string[], cwd: string, env: NodeJS.ProcessEnv, control: RunControl, capture: boolean, streamOutput = false): Promise<{ code: number | null; stdout: string; stderr: string; interrupted: boolean; error?: string; startedAt: string; durationMs: number }> {
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
      child.stdout?.on('data', (chunk: Buffer) => { const text = chunk.toString('utf8'); stdout += text; if (streamOutput) process.stdout.write(text); });
      child.stderr?.on('data', (chunk: Buffer) => { const text = chunk.toString('utf8'); stderr += text; if (streamOutput) process.stderr.write(text); });
    }
    let termination: Promise<void> | undefined;
    const onAbort = () => { termination ??= terminateOwned(child); };
    const sourceMonitor = control.isSourceStable
      ? setInterval(() => {
        if (!control.isSourceStable?.()) control.invalidateSource?.();
      }, 1000)
      : undefined;
    sourceMonitor?.unref();
    control.signal.addEventListener('abort', onAbort, { once: true });
    child.once('error', (error) => { spawnError = redactText(error.message); });
    child.once('close', (code, signal) => {
      control.signal.removeEventListener('abort', onAbort);
      if (sourceMonitor) clearInterval(sourceMonitor);
      void Promise.resolve(termination).then(() => {
        if (child.pid) control.ownedChildren.delete(child.pid);
        const interrupted = control.signal.aborted;
        const exitCode = interrupted ? (process.platform !== 'win32' && signal === 'SIGTERM' ? 143 : 130) : code ?? 127;
        void control.onChange().catch(() => undefined);
        resolve({ code: exitCode, stdout, stderr, interrupted, error: spawnError, startedAt, durationMs: Date.now() - started });
      });
    });
  });
}

function terminateOwned(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (process.platform === 'win32') {
    const taskkill = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      taskkill.once('error', finish);
      taskkill.once('close', finish);
      child.kill();
    });
  }
  const closed = new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve();
    child.once('close', () => resolve());
  });
  try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  return Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 3000))])
    .then(async () => {
      if (child.exitCode === null && child.signalCode === null) {
        try { process.kill(-child.pid!, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
        await closed;
      }
    });
}

function check(id: string, command: string, reason: string, status: CheckResult['status'], startedAt: string, durationMs: number, exitCode: number | null, evidence?: string, details?: string): CheckResult {
  return { id, command, reason, status, startedAt, durationMs, exitCode, evidence, details };
}

function commandDescription(command: CommandSpec): string { return `${command.executable} ${command.args.map((item) => JSON.stringify(item)).join(' ')}`.trim(); }
function formatCommand(file: string, args: string[]): string { return [file, ...args].map((item) => JSON.stringify(item)).join(' '); }

function canonicalTestPath(root: string, file: string): string {
  const absolute = path.isAbsolute(file) ? file : path.resolve(root, file);
  return path.relative(root, absolute).replace(/\\/g, '/');
}
