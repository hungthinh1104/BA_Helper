import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compareInventory, explicitJestFiles, parseNativeTestList, runCommands, type RunControl, type RunPrerequisites } from './runner';
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
    const payload = JSON.stringify({ numFailedTests: 0, testResults: [] });
    const command: CommandSpec = {
      id: 'empty-native-report', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'A zero exit is not sufficient without executed tests.', reportPath: report,
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', details: 'Native test report contains zero executed or skipped test cases.' });
  });

  it('rejects malformed native report JSON after a zero child exit', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'malformed-report.json');
    const command: CommandSpec = {
      id: 'malformed-native-report', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, '{')`],
      reason: 'Malformed evidence cannot qualify a passing command.', reportPath: report,
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', details: 'Native test report is malformed JSON or has an unsupported structure.' });
  });

  it('validates native test reports and redacts database credentials before retaining them', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'native report.json');
    const payload = JSON.stringify({
      numFailedTests: 0,
      databaseUrl: 'postgresql://report-user:report-secret@localhost:5432/ba_helper_test',
      testResults: [{ name: path.join(root, 'scripts/lib/verify-change/runner.spec.ts'), assertionResults: [{ fullName: 'native case passes', status: 'passed' }] }],
    });
    const command: CommandSpec = {
      id: 'valid-native-report', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Native report shape, execution, and secret hygiene are required.', reportPath: report,
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
    const payload = JSON.stringify({ numFailedTests: 0, testResults: [{ name: testFile, assertionResults: [{
      fullName: 'EduKids pinned real scan (E2E) acquires, scans, and persists only the pinned source commit through the worker path', status: 'pending',
    }] }] });
    const command: CommandSpec = {
      id: 'api-e2e', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Known opt-in skips are listed with their recorded reason.', reportPath: report,
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(0);
    expect(control.checks[0]?.status).toBe('PASS');
    expect(control.checks[0]?.skips?.join(' ')).toContain('Opt-in real scan requires explicit pilot activation');
  });

  it('fails a successful command when its native report introduces an unapproved skip', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'unapproved-skip.json');
    const payload = JSON.stringify({ numFailedTests: 0, testResults: [{
      name: path.join(root, 'scripts/lib/verify-change/runner.spec.ts'),
      assertionResults: [{ fullName: 'new unapproved skip', status: 'pending' }],
    }] });
    const command: CommandSpec = {
      id: 'root-tests', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'New skips require an explicit inventory review.', reportPath: report,
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(1);
    expect(control.checks[0]).toMatchObject({ status: 'FAIL', details: expect.stringContaining('Unexpected skip') });
  });

  it('reconciles the approved desktop Playwright skip identity with the native report', async () => {
    const control = createControl();
    const report = path.join(reportDirectory, 'browser-journeys.json');
    const payload = JSON.stringify({ suites: [{
      title: 'pinned real comprehension', file: 'e2e/pinned-real-comprehension.pw.ts', projectName: 'desktop',
      tests: [{ title: 'opens a persisted pinned-repository trace through the live API', results: [{ status: 'skipped' }] }],
    }], stats: { unexpected: 0 } });
    const command: CommandSpec = {
      id: 'browser-journeys', executable: 'node',
      args: ['-e', `require('node:fs').writeFileSync(${JSON.stringify(report)}, ${JSON.stringify(payload)})`],
      reason: 'Expected opt-in Playwright skips remain explicit.', reportPath: report,
    };

    await expect(runCommands([command], root, prerequisites, control)).resolves.toBe(0);
    expect(control.checks[0]?.skips?.join(' ')).toContain('Browser journey is skipped when the pinned proof is not prepared');
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
});
