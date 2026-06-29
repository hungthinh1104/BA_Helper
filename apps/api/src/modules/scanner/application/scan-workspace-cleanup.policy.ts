import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';

export type ScanWorkspaceCleanupOutcome = {
  attempted: boolean;
  preserved: boolean;
  succeeded: boolean | null;
  workspaceId?: string;
  reason: 'NO_WORKSPACE' | 'DEBUG_PRESERVE' | 'CLEANED' | 'CLEANUP_FAILED';
  errorMessage?: string;
};

const PRESERVE_SCAN_WORKSPACE_ENV = 'BA_HELPER_PRESERVE_SCAN_WORKSPACE';

const isEnabled = (value: string | undefined): boolean =>
  value === '1' || value?.toLowerCase() === 'true';

export class ScanWorkspaceCleanupPolicy {
  async cleanup(workspacePath?: string): Promise<ScanWorkspaceCleanupOutcome> {
    if (!workspacePath) {
      return {
        attempted: false,
        preserved: false,
        succeeded: null,
        reason: 'NO_WORKSPACE',
      };
    }

    const workspaceId = this.hashWorkspacePath(workspacePath);
    if (isEnabled(process.env[PRESERVE_SCAN_WORKSPACE_ENV])) {
      return {
        attempted: false,
        preserved: true,
        succeeded: null,
        workspaceId,
        reason: 'DEBUG_PRESERVE',
      };
    }

    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
      return {
        attempted: true,
        preserved: false,
        succeeded: true,
        workspaceId,
        reason: 'CLEANED',
      };
    } catch (error) {
      return {
        attempted: true,
        preserved: false,
        succeeded: false,
        workspaceId,
        reason: 'CLEANUP_FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown cleanup error',
      };
    }
  }

  private hashWorkspacePath(workspacePath: string): string {
    return `sha256:${createHash('sha256').update(workspacePath).digest('hex').slice(0, 16)}`;
  }
}
