import { spawn } from 'node:child_process';
export interface GitFetchOptions {
  url: string;
  targetDir: string;
  ref?: string; // branch, tag, or commit hash
  timeoutMs?: number;
}

export interface GitFetchResult {
  commitSha: string;
}

export class GitRepositoryFetcher {
  /**
   * Securely fetches a repository into a target directory.
   * Uses spawn with argument arrays, avoids shell execution.
   */
  static async fetch(options: GitFetchOptions): Promise<GitFetchResult> {
    const timeout = options.timeoutMs || 60000;

    // 1. Clone the repository
    const cloneArgs = ['clone', '--no-local', '--depth', '1'];
    
    // For MVP, we assume `ref` is a branch or tag if provided.
    // If it's an arbitrary commit hash, this shallow clone might fail if the server
    // doesn't support fetching specific commits by hash, but it's acceptable for Phase 4 MVP.
    if (options.ref) {
      cloneArgs.push('--branch', options.ref, '--single-branch');
    }
    
    cloneArgs.push(options.url, options.targetDir);

    await this.spawnGit(cloneArgs, timeout, undefined);

    // 2. Resolve the commit SHA
    const sha = await this.resolveCommitSha(options.targetDir, timeout);

    return { commitSha: sha };
  }

  private static async resolveCommitSha(targetDir: string, timeoutMs: number): Promise<string> {
    const output = await this.spawnGit(['rev-parse', 'HEAD'], timeoutMs, targetDir);
    const sha = output.trim();
    if (!/^[0-9a-f]{40}$/i.test(sha)) {
      throw new Error(`Failed to resolve valid commit SHA. Got: ${sha}`);
    }
    return sha;
  }

  private static spawnGit(args: string[], timeoutMs: number, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Security invariant: shell: false, controlled env
      const child = spawn('git', args, {
        shell: false,
        timeout: timeoutMs,
        cwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Prevent prompt for credentials
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Git command failed to start: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git command failed with code ${code}. Error: ${stderr}`));
        }
      });
    });
  }
}
