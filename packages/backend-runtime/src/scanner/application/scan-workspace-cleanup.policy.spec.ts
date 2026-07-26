import * as fs from 'node:fs/promises';
import { ScanWorkspaceCleanupPolicy } from './scan-workspace-cleanup.policy';

jest.mock('node:fs/promises', () => ({
  rm: jest.fn(),
}));

describe('ScanWorkspaceCleanupPolicy', () => {
  const originalEnv = process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE;

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE;
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE;
    } else {
      process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE = originalEnv;
    }
  });

  it('removes a scan workspace and returns a safe workspace id', async () => {
    (fs.rm as jest.Mock).mockResolvedValue(undefined);

    const result = await new ScanWorkspaceCleanupPolicy().cleanup('/tmp/private/repo-checkout');

    expect(fs.rm).toHaveBeenCalledWith('/tmp/private/repo-checkout', {
      recursive: true,
      force: true,
    });
    expect(result).toMatchObject({
      attempted: true,
      preserved: false,
      succeeded: true,
      reason: 'CLEANED',
    });
    expect(result.workspaceId).toMatch(/^sha256:[a-f0-9]{16}$/);
    expect(JSON.stringify(result)).not.toContain('/tmp/private/repo-checkout');
  });

  it('preserves the workspace when debug preserve mode is enabled', async () => {
    process.env.BA_HELPER_PRESERVE_SCAN_WORKSPACE = 'true';

    const result = await new ScanWorkspaceCleanupPolicy().cleanup('/tmp/private/repo-checkout');

    expect(fs.rm).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      attempted: false,
      preserved: true,
      succeeded: null,
      reason: 'DEBUG_PRESERVE',
    });
    expect(JSON.stringify(result)).not.toContain('/tmp/private/repo-checkout');
  });

  it('reports cleanup failure without exposing the raw workspace path', async () => {
    (fs.rm as jest.Mock).mockRejectedValue(new Error('permission denied'));

    const result = await new ScanWorkspaceCleanupPolicy().cleanup('/tmp/private/repo-checkout');

    expect(result).toMatchObject({
      attempted: true,
      preserved: false,
      succeeded: false,
      reason: 'CLEANUP_FAILED',
      errorMessage: 'permission denied',
    });
    expect(JSON.stringify(result)).not.toContain('/tmp/private/repo-checkout');
  });

  it('does not attempt cleanup when no workspace was created', async () => {
    const result = await new ScanWorkspaceCleanupPolicy().cleanup(undefined);

    expect(fs.rm).not.toHaveBeenCalled();
    expect(result).toEqual({
      attempted: false,
      preserved: false,
      succeeded: null,
      reason: 'NO_WORKSPACE',
    });
  });
});
