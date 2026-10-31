import { GitRepositoryFetcher } from '../../src/git/git-repository-fetcher';
import * as child_process from 'node:child_process';
import { EventEmitter } from 'node:events';

jest.mock('node:child_process');

describe('GitRepositoryFetcher', () => {
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    mockSpawn = child_process.spawn as jest.Mock;
    mockSpawn.mockClear();
  });

  function setupMockSpawn(stdoutStr: string, exitCode: number) {
    mockSpawn.mockImplementation(() => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        child.stdout.emit('data', Buffer.from(stdoutStr));
        child.emit('close', exitCode);
      }, 10);

      return child;
    });
  }

  it('uses argument-array spawn, not shell string', async () => {
    // We expect two calls: clone, then rev-parse
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        if (args.includes('rev-parse')) {
          child.stdout.emit('data', Buffer.from('0123456789abcdef0123456789abcdef01234567'));
        }
        child.emit('close', 0);
      }, 10);

      return child;
    });

    const result = await GitRepositoryFetcher.fetch({
      url: 'https://github.com/owner/repo',
      targetDir: '/tmp/repo'
    });

    expect(result.commitSha).toBe('0123456789abcdef0123456789abcdef01234567');
    expect(mockSpawn).toHaveBeenCalledTimes(2);

    const [cloneCommand, cloneArgs, cloneOpts] = mockSpawn.mock.calls[0];
    expect(cloneCommand).toBe('git');
    expect(Array.isArray(cloneArgs)).toBe(true);
    expect(cloneArgs).toEqual(['clone', '--no-local', '--depth', '1', 'https://github.com/owner/repo', '/tmp/repo']);
    expect(cloneOpts.shell).toBe(false);
  });

  it('enforces timeout and does not recurse submodules', async () => {
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        if (args.includes('rev-parse')) {
          child.stdout.emit('data', Buffer.from('fedcba9876543210fedcba9876543210fedcba98'));
        }
        child.emit('close', 0);
      }, 5);

      return child;
    });

    await GitRepositoryFetcher.fetch({
      url: 'https://github.com/owner/repo',
      targetDir: '/tmp/repo',
      timeoutMs: 5000,
      ref: 'main'
    });

    const [cloneCommand, cloneArgs, cloneOpts] = mockSpawn.mock.calls[0];
    expect(cloneOpts.timeout).toBe(5000);
    expect(cloneArgs).not.toContain('--recurse-submodules');
    expect(cloneArgs).toContain('--branch');
    expect(cloneArgs).toContain('main');
    
    expect(cloneOpts.env).toBeDefined();
    expect(cloneOpts.env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(cloneOpts.env.PATH).toBe(process.env.PATH);
  });

  it('fetches a full commit SHA without treating it as a branch name', async () => {
    const pinnedSha = '78547792178275bb76ba1550c41265f55f79350a';
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      setTimeout(() => {
        if (args.includes('rev-parse')) child.stdout.emit('data', Buffer.from(pinnedSha));
        child.emit('close', 0);
      }, 5);
      return child;
    });

    const result = await GitRepositoryFetcher.fetch({
      url: 'https://github.com/owner/repo',
      targetDir: '/tmp/repo',
      ref: pinnedSha,
    });

    expect(result.commitSha).toBe(pinnedSha);
    expect(mockSpawn.mock.calls.map(([, args]) => args)).toEqual([
      ['init', '/tmp/repo'],
      ['remote', 'add', 'origin', 'https://github.com/owner/repo'],
      ['fetch', '--no-tags', '--depth', '1', 'origin', pinnedSha],
      ['checkout', '--detach', 'FETCH_HEAD'],
      ['rev-parse', 'HEAD'],
    ]);
    expect(mockSpawn.mock.calls.every(([, , options]) => options.shell === false)).toBe(true);
  });

  it('fails closed if a pinned commit fetch resolves a different SHA', async () => {
    const requestedSha = '78547792178275bb76ba1550c41265f55f79350a';
    const resolvedSha = '6ec605c254a427ca4d67a95db200655e66ab7bbf';
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      setTimeout(() => {
        if (args.includes('rev-parse')) child.stdout.emit('data', Buffer.from(resolvedSha));
        child.emit('close', 0);
      }, 5);
      return child;
    });

    await expect(GitRepositoryFetcher.fetch({
      url: 'https://github.com/owner/repo',
      targetDir: '/tmp/repo',
      ref: requestedSha,
    })).rejects.toThrow(/pinned repository ref did not match resolved commit sha/i);
  });

  it('rejects non-hex 40-character revision strings', async () => {
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        if (args.includes('rev-parse')) {
          child.stdout.emit('data', Buffer.from('zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz'));
        }
        child.emit('close', 0);
      }, 5);

      return child;
    });

    await expect(
      GitRepositoryFetcher.fetch({
        url: 'https://github.com/owner/repo',
        targetDir: '/tmp/repo',
      }),
    ).rejects.toThrow('Failed to resolve valid commit SHA');
  });
});
