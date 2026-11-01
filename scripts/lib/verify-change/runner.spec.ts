import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareInventory, explicitJestFiles, parseNativeTestList, playwrightTestFileMatches, runCommands, type RunControl, type RunPrerequisites } from './runner';
import { resolveLeaseWrappedCommand } from './lease-command';
import type { CommandSpec } from './types';

describe('verification command runner', () => {
  const root = process.cwd();
  const prerequisites: RunPrerequisites = {
    testTargetsReady: true,
    migrationTargetReady: true,
    dockerReady: true,
    browserReady: true,
    pinnedCorpusReady: true,
    toolchainReady: true,
  };
  let reportDirectory: string;

  beforeEach(() => {
    reportDirectory = mkdtempSync(path.join(os.tmpdir(), 'verify change runner '));
  });

  it('distinguishes valid empty discovery from failed or malformed discovery output', () => {
    expect(parseNativeTestList('[]')).toEqual({ valid: true, tests: [] });
    expect(parseNativeTestList('{"not":"a test list"}')).toEqual({ valid: false, tests: [] });
    expect(parseNativeTestList('["a.spec.ts", null]')).toEqual({ valid: false, tests: [] });
  });

  it('matches Playwright paths reported relative to the configured e2e test directory', () => {
    expect(playwrightTestFileMatches(root, 'e2e/decision-to-report.pw.ts', 'decision-to-report.pw.ts')).toBe(true);
    expect(playwrightTestFileMatches(root, 'e2e/decision-to-report.pw.ts', path.join(root, 'e2e', 'decision-to-report.pw.ts'))).toBe(true);
    expect(playwrightTestFileMatches(root, 'e2e/decision-to-report.pw.ts', 'code-comprehension-trace.pw.ts')).toBe(false);
  });

  it('forwards filters after a lease-wrapped package script separator', () => {
    expect(resolveLeaseWrappedCommand(
      ['--run', 'test:pw:inner', '--', 'e2e/decision-to-report.pw.ts', '--project=desktop', '--grep=approved report'],
      root, 'node.exe', 'pnpm.cjs', 'C:/caller',
    )).toEqual({
      file: 'node.exe', args: [
        'pnpm.cjs', '--dir', root, 'run', 'test:pw:inner',
        'e2e/decision-to-report.pw.ts', '--project=desktop', '--grep=approved report',
      ], cwd: root,
    });
  });

  it('detects same-count test replacement, runner membership loss, and Playwright identity drift', () => {
    const baseline = path.join(reportDirectory, 'inventory-baseline.json');
    writeFileSync(baseline, JSON.stringify({
      schemaVersion: 1, baselineCommitSha: 'candidate',
      approval: { status: 'APPROVED', reviewer: 'reviewer', reviewedAt: '2026-11-01' },
      jestRunners: [
        { id: 'ci', tests: ['apps/api/a.spec.ts', 'apps/api/removed.spec.ts'] },
        { id: 'unit', tests: ['packages/unit.spec.ts'] },
      ],
      playwrightTests: [{ project: 'desktop', file: 'e2e/review.pw.ts', line: 5, column: 1, title: 'review report' }],
      approvedSkips: [],
    }));
    const comparison = compareInventory(root, baseline, [
      { id: 'ci', count: 2, durationMs: 1, status: 'PASS', tests: ['apps/api/a.spec.ts', 'apps/api/added.spec.ts'], evidence: '' },
    ], [{ project: 'desktop', file: 'e2e/review.pw.ts', line: 5, column: 1, title: 'changed title' }]);

    expect(comparison.approvalStatus).toBe('INVALID');
    expect(comparison.differences).toEqual(expect.arrayContaining([
      { runner: 'ci', added: ['apps/api/added.spec.ts'], removed: ['apps/api/removed.spec.ts'] },
      { runner: 'unit', added: [], removed: ['packages/unit.spec.ts'] },
    ]));
    expect(comparison.differences.find((difference) => difference.runner === 'playwright')?.added).toHaveLength(1);
    expect(comparison.differences.find((difference) => difference.runner === 'playwright')?.removed).toHaveLength(1);
  });

  afterEach(() => {
    rmSync(reportDirectory, { recursive: true, force: true });
  });

  it('preserves a failing child process exit code', async () => {
    const control = createControl();
    const command: CommandSpec = {
      id: 'intentional-failure-control', executable: 'node',
      args: ['-e', 'process.exit(23)'], reason: 'Verify child failure propagation.',
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(23);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', exitCode: 23 });
    expect(control.ownedChildren.size).toBe(0);
  });

  it('rejects an empty successful native Jest report and preserves the evidence', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'empty native report.json');
    const payload = JSON.stringify(jestReport([]));
    const command: CommandSpec = {
      id: 'empty-native-report', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'A zero exit is not sufficient without executed tests.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: ['scripts/lib/verify-change/runner.spec.ts'] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', details: expect.stringContaining('zero executed test cases') });
  });

  it('rejects malformed native report JSON after a zero child exit', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'malformed-report.json');
    const command: CommandSpec = {
      id: 'malformed-native-report', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, '{')`],
      reason: 'Malformed evidence cannot qualify a passing command.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: ['scripts/lib/verify-change/runner.spec.ts'] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', details: 'Native test report is malformed JSON or has an unsupported structure.' });
  });

  it('validates native test reports and redacts database credentials before retaining them', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'native report.json');
    const testFile = path.join(root, 'scripts/lib/verify-change/runner.spec.ts');
    const payload = JSON.stringify({
      ...jestReport([{ fullName: 'native case passes', status: 'passed' }]),
      databaseUrl: 'postgresql://report-user:report-secret@localhost:5432/ba_helper_test',
      testResults: [{ name: testFile, status: 'passed', assertionResults: [{ fullName: 'native case passes', status: 'passed' }] }],
    });
    const command: CommandSpec = {
      id: 'valid-native-report', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Native report shape, execution, and secret hygiene are required.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: [testFile] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(0);
    expect(control.checks[0]).toMatchObject({ status: 'PASS' });
    expect(readFileSync(report, 'utf8')).not.toContain('report-secret');
    expect(JSON.parse(readFileSync(report, 'utf8')).databaseUrl).toBe('[REDACTED]');
  });

  it('records the reviewed identity and reason for a known opt-in skip', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'api-e2e-report.json');
    const testFile = path.join(root, 'apps/api/test/e2e/edukids-pinned-pilot.e2e-spec.ts');
    const payload = JSON.stringify(jestReport([
      { fullName: 'a normal API test', status: 'passed' },
      { fullName: 'EduKids pinned real scan (E2E) acquires, scans, and persists only the pinned source commit through the worker path', status: 'pending' },
    ], testFile));
    const command: CommandSpec = {
      id: 'api-e2e', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Known opt-in skips are listed with their recorded reason.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: [testFile] },
      env: { EDUKIDS_PILOT_REAL_SCAN: 'false' },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(0);
    expect(control.checks[0]?.status).toBe('PASS');
    expect(control.checks[0]?.skips?.join(' ')).toContain('Opt-in real scan requires explicit pilot activation');
  });

  it('fails a successful command when its native report introduces an unapproved skip', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'unapproved-skip.json');
    const testFile = path.join(root, 'scripts/lib/verify-change/runner.spec.ts');
    const payload = JSON.stringify(jestReport([{ fullName: 'new unapproved skip', status: 'pending' }], testFile));
    const command: CommandSpec = {
      id: 'root-tests', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'New skips require an explicit inventory review.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: [testFile] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', details: expect.stringContaining('Unexpected skip') });
  });

  it('reconciles the approved desktop Playwright skip identity with the native report', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'browser-journeys.json');
    const pinnedFile = 'e2e/pinned-real-comprehension.pw.ts';
    const passingFile = 'e2e/decision-to-report.pw.ts';
    const payload = JSON.stringify({ suites: [{
      title: 'pinned-real-comprehension.pw.ts', file: 'pinned-real-comprehension.pw.ts',
      specs: [{ title: 'opens a persisted pinned-repository trace through the live API', file: 'pinned-real-comprehension.pw.ts', tests: [{
        projectName: 'desktop', expectedStatus: 'passed', status: 'skipped', results: [],
      }] }],
    }, {
      title: 'decision-to-report.pw.ts', file: 'decision-to-report.pw.ts',
      suites: [{ title: 'review report', specs: [{ title: 'another passing browser case', file: 'decision-to-report.pw.ts', tests: [{
        projectName: 'desktop', expectedStatus: 'passed', status: 'expected', results: [{ status: 'passed' }],
      }] }] }],
    }], stats: { expected: 1, skipped: 1, unexpected: 0, flaky: 0 } });
    const command: CommandSpec = {
      id: 'browser-journeys', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Expected opt-in Playwright skips remain explicit.', reportPath: report,
      nativeExpectation: { runner: 'playwright', files: [pinnedFile, passingFile], cases: [
        { project: 'desktop', file: pinnedFile, title: 'opens a persisted pinned-repository trace through the live API' },
        { project: 'desktop', file: passingFile, title: 'review report › another passing browser case' },
      ] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(0);
    expect(control.checks[0]?.skips?.join(' ')).toContain('Browser journey is skipped when the pinned proof is not prepared');
  });

  it('rejects unknown Jest assertion statuses and entirely skipped execution', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'unknown-status.json');
    const file = path.join(root, 'scripts/lib/verify-change/runner.spec.ts');
    const payload = JSON.stringify(jestReport([{ fullName: 'unknown status', status: 'not-a-status' }], file));
    const command: CommandSpec = {
      id: 'unknown-status', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Unknown status values cannot be qualified.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: [file] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]?.details).toContain('unknown status');
    expect(control.checks[0]?.nativeEvidence?.observedExecution.executedCases).toBe(0);
  });

  it('rejects a native report that omits a selected suite even when another suite passes', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'missing-selected-suite.json');
    const selectedFile = path.join(root, 'scripts/lib/verify-change/runner.spec.ts');
    const unrelatedFile = path.join(root, 'apps/api/test/e2e/helpers/test-target-safety.spec.ts');
    const payload = JSON.stringify(jestReport([{ fullName: 'unrelated case passes', status: 'passed' }], unrelatedFile));
    const command: CommandSpec = {
      id: 'missing-selected-suite', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Native execution must include every suite selected by discovery.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: [selectedFile] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]?.status).toBe('FAIL');
    expect(control.checks[0]?.details).toContain('Selected test suite(s) are absent');
    expect(control.checks[0]?.nativeEvidence).toMatchObject({
      expectedExecution: { files: ['scripts/lib/verify-change/runner.spec.ts'] },
      observedExecution: { files: ['apps/api/test/e2e/helpers/test-target-safety.spec.ts'], executedCases: 1 },
    });
  });

  it('requires an activated EduKids opt-in case to execute', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'activated-edukids.json');
    const testFile = path.join(root, 'apps/api/test/e2e/edukids-pinned-pilot.e2e-spec.ts');
    const title = 'EduKids pinned real scan (E2E) acquires, scans, and persists only the pinned source commit through the worker path';
    const payload = JSON.stringify(jestReport([{ fullName: title, status: 'passed' }], testFile));
    const command: CommandSpec = {
      id: 'api-e2e', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'An activated opt-in case must execute.', reportPath: report,
      nativeExpectation: { runner: 'jest', files: [testFile] },
      env: { EDUKIDS_PILOT_REAL_SCAN: 'true' },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(0);
    expect(control.checks[0]?.nativeEvidence?.skipExpectations).toContainEqual(expect.objectContaining({ state: 'EXECUTION_REQUIRED', observed: 'EXECUTED' }));
  });

  it('retains a failed Playwright retry even when the final attempt passes', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'flaky-retry.json');
    const testCase = { projectName: 'desktop', expectedStatus: 'passed', status: 'flaky', results: [{ status: 'failed' }, { status: 'passed' }] };
    const payload = JSON.stringify({ suites: [{ file: 'decision-to-report.pw.ts', specs: [{
      title: 'retry history is preserved', file: 'decision-to-report.pw.ts', tests: [testCase],
    }] }], stats: { expected: 0, skipped: 0, unexpected: 0, flaky: 1 } });
    const command: CommandSpec = {
      id: 'browser-retry', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'A recovered failure remains unqualified.', reportPath: report,
      nativeExpectation: { runner: 'playwright', files: ['e2e/decision-to-report.pw.ts'], cases: [
        { project: 'desktop', file: 'e2e/decision-to-report.pw.ts', title: 'retry history is preserved' },
      ] },
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]?.nativeEvidence?.retryFailures).toHaveLength(1);
    expect(control.checks[0]?.details).toContain('recovered by retry');
  });

  it('terminates and records an owned child after interruption', async () => {
    const abort = new AbortController();
    const control = createControl(abort);
    const command: CommandSpec = {
      id: 'interruption-control', executable: 'node',
      args: ['-e', 'setTimeout(() => {}, 60000)'], reason: 'Verify owned-child cleanup.',
    };
    const timer = setTimeout(() => abort.abort(), 250);

    try {
      const expectedExitCode = process.platform === 'win32' ? 130 : 143;
      await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(expectedExitCode);
      expect(control.checks[0]).toMatchObject({ status: 'INTERRUPTED', exitCode: expectedExitCode });
      expect(control.ownedChildren.size).toBe(0);
    } finally {
      clearTimeout(timer);
    }
  });

  it('stops an owned child when the candidate changes during a long command', async () => {
    const control = createControl();
    const abort = new AbortController();
    control.signal = abort.signal;
    let stable = true;
    control.isSourceStable = () => stable;
    control.invalidateSource = () => { stable = false; abort.abort(); };
    const command: CommandSpec = {
      id: 'source-change-control', executable: 'node',
      args: ['-e', 'setTimeout(() => {}, 60000)'], reason: 'Verify source drift cleanup.',
    };
    const invalidateLater = setTimeout(() => { stable = false; }, 100);

    try {
      await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(130);
      expect(control.checks[0]).toMatchObject({ status: 'INTERRUPTED', exitCode: 130 });
      expect(control.ownedChildren.size).toBe(0);
      expect(stable).toBe(false);
    } finally {
      clearTimeout(invalidateLater);
    }
  });

  it('keeps failed native discovery failed when a fallback suite is available', async () => {
    const { resolveRelatedCommands } = await import('./runner');
    const control = createControl();
    const selection: NonNullable<CommandSpec['selection']> = {
      id: 'related-backend',
      config: '__missing-verification-config__.cjs',
      sourceFiles: ['scripts/lib/verify-change/runner.ts'],
      fallbackConfig: 'jest.config.ts',
      fallbackFiles: ['scripts/lib/verify-change/runner.spec.ts'],
      reason: 'Native related-test discovery must succeed.',
    };
    const result = await resolveRelatedCommands([{
      id: selection.id, executable: 'node', args: [], reason: selection.reason, selection,
    }], root, control);

    expect(result.commands).toHaveLength(1);
    expect(result.commands[0]?.args).toContain('scripts/lib/verify-change/runner.spec.ts');
    expect(result.gaps).toEqual(expect.arrayContaining([expect.stringContaining('Jest discovery exited')]));
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', exitCode: expect.any(Number) });
    expect(control.checks[0]?.details).toContain('fallback selected');
  });

  it('fails mandatory mapped E2E selection when native Jest cannot discover the mapped suite', async () => {
    const { resolveRelatedCommands } = await import('./runner');
    const control = createControl();
    const command: CommandSpec = {
      id: 'critical-trust-e2e', executable: 'node',
      args: [path.join(root, 'node_modules/jest/bin/jest.js'), '--config', 'jest.e2e.config.ts', '--runTestsByPath', 'apps/api/test/e2e/does-not-exist.e2e-spec.ts'],
      reason: 'Missing mandatory trust suites must fail closed.', requires: ['test-targets'],
    };

    expect(explicitJestFiles(command.args)).toEqual(['apps/api/test/e2e/does-not-exist.e2e-spec.ts']);
    const result = await resolveRelatedCommands([command], root, control, true);
    expect(result.commands).toEqual([]);
    expect(result.gaps.join(' ')).toMatch(/missing from native discovery|exited/);
    expect(control.checks[0]?.status).toBe('FAIL');
  });

  function createControl(abort = new AbortController()): RunControl {
    return {
      signal: abort.signal,
      checks: [],
      reportPath: path.join(reportDirectory, 'verification.json'),
      onChange: async () => undefined,
      ownedChildren: new Set(),
    };
  }

  function jestReport(assertions: Array<{ fullName: string; status: string }>, file = path.join(root, 'scripts/lib/verify-change/runner.spec.ts')) {
    const counts = {
      passed: assertions.filter((item) => item.status === 'passed').length,
      failed: assertions.filter((item) => item.status === 'failed').length,
      pending: assertions.filter((item) => ['pending', 'disabled', 'skipped'].includes(item.status)).length,
      todo: assertions.filter((item) => item.status === 'todo').length,
    };
    return {
      success: counts.failed === 0,
      numTotalTests: assertions.length,
      numPassedTests: counts.passed,
      numFailedTests: counts.failed,
      numPendingTests: counts.pending,
      numTodoTests: counts.todo,
      numFailedTestSuites: 0,
      testResults: assertions.length ? [{ name: file, status: 'passed', assertionResults: assertions }] : [],
    };
  }
});
