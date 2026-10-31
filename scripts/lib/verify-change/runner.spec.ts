import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runCommands, type RunControl, type RunPrerequisites } from './runner';
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
