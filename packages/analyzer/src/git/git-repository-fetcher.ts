import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
export interface GitFetchOptions {
  url: string;
  targetDir: string;
  ref?: string; // branch, tag, or commit hash
  timeoutMs?: number;
}

export interface GitFetchResult {
  commitSha: string;
}

function isFullCommitSha(ref: string | undefined): ref is string {
  return ref !== undefined && /^[0-9a-f]{40}$/i.test(ref);
}

export class GitRepositoryFetcher {
  /**
   * Securely fetches a repository into a target directory.
   * Uses spawn with argument arrays, avoids shell execution.
   */
  static async fetch(options: GitFetchOptions): Promise<GitFetchResult> {
    const timeout = options.timeoutMs || 60000;

    // In test environments, if it's a local absolute path, just copy it
    if (process.env.NODE_ENV === 'test' && (isAbsolute(options.url) || options.url.startsWith('file://'))) {
      const source = options.url.startsWith('file://') ? fileURLToPath(options.url) : options.url;
      const { cp } = await import('node:fs/promises');
      await cp(source, options.targetDir, { recursive: true });
      // Fake a commit sha for local fixture copying
      return { commitSha: 'mock-commit-sha' };
    }

    const pinnedCommit = isFullCommitSha(options.ref) ? options.ref : undefined;
    if (pinnedCommit) {
      await this.spawnGit(['init', options.targetDir], timeout);
      await this.spawnGit(['remote', 'add', 'origin', options.url], timeout, options.targetDir);
      await this.spawnGit(
        ['fetch', '--no-tags', '--depth', '1', 'origin', pinnedCommit],
        timeout,
        options.targetDir,
      );
      await this.spawnGit(['checkout', '--detach', 'FETCH_HEAD'], timeout, options.targetDir);
    } else {
      const cloneArgs = ['clone', '--no-local', '--depth', '1'];
      if (options.ref) cloneArgs.push('--branch', options.ref, '--single-branch');
      cloneArgs.push(options.url, options.targetDir);
      await this.spawnGit(cloneArgs, timeout, undefined);
    }

    // 2. Resolve the commit SHA
    const sha = await this.resolveCommitSha(options.targetDir, timeout);
    if (pinnedCommit && sha.toLowerCase() !== pinnedCommit.toLowerCase()) {
      throw new Error('Pinned repository ref did not match resolved commit SHA.');
    }

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
