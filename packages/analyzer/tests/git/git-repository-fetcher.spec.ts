import {
  GitFetchError,
  GitRepositoryFetcher,
  resolveGitRefKind,
} from '../../src/git/git-repository-fetcher';
import * as child_process from 'node:child_process';
import { EventEmitter } from 'node:events';

jest.mock('node:child_process');

describe('GitRepositoryFetcher', () => {
  let mockSpawn: jest.Mock;

  beforeEach(() => {
    mockSpawn = child_process.spawn as jest.Mock;
    mockSpawn.mockClear();
  });

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

  it('detects full 40-char SHA refs as commit refs', () => {
    expect(resolveGitRefKind('33ca78792610f1b0ece552767ef370bcb1978205')).toBe('COMMIT_SHA');
  });

  it('detects normal branches and tags as branch-or-tag refs', () => {
    expect(resolveGitRefKind('main')).toBe('BRANCH_OR_TAG');
    expect(resolveGitRefKind('v1.2.3')).toBe('BRANCH_OR_TAG');
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

  it('does not treat exact commit SHA as clone --branch input', async () => {
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        if (args[0] === 'rev-parse') {
          child.stdout.emit('data', Buffer.from('33ca78792610f1b0ece552767ef370bcb1978205'));
        }
        child.emit('close', 0);
      }, 5);

      return child;
    });

    const result = await GitRepositoryFetcher.fetch({
      url: 'https://github.com/owner/repo',
      targetDir: '/tmp/repo',
      ref: '33ca78792610f1b0ece552767ef370bcb1978205',
    });

    expect(result.commitSha).toBe('33ca78792610f1b0ece552767ef370bcb1978205');
    const [cloneCommand, cloneArgs] = mockSpawn.mock.calls[0];
    expect(cloneCommand).toBe('git');
    expect(cloneArgs).toEqual([
      'clone',
      '--no-local',
      '--depth',
      '1',
      '--no-checkout',
      'https://github.com/owner/repo',
      '/tmp/repo',
    ]);
    expect(cloneArgs).not.toContain('--branch');
    expect(mockSpawn.mock.calls[1][1]).toEqual([
      'checkout',
      '--detach',
      '33ca78792610f1b0ece552767ef370bcb1978205',
    ]);
  });

  it('fails with COMMIT_NOT_FETCHABLE when exact SHA remains unreachable after fetch', async () => {
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        if (args[0] === 'clone') {
          child.emit('close', 0);
          return;
        }
        if (args[0] === 'checkout') {
          child.stderr.emit('data', Buffer.from('fatal: reference is not a tree'));
          child.emit('close', 128);
          return;
        }
        if (args[0] === 'fetch') {
          child.emit('close', 0);
          return;
        }
        child.emit('close', 0);
      }, 5);

      return child;
    });

    await expect(
      GitRepositoryFetcher.fetch({
        url: 'https://github.com/owner/repo',
        targetDir: '/tmp/repo',
        ref: '33ca78792610f1b0ece552767ef370bcb1978205',
      }),
    ).rejects.toMatchObject({
      code: 'COMMIT_NOT_FETCHABLE',
    } satisfies Partial<GitFetchError>);

    expect(mockSpawn.mock.calls[2][1]).toEqual([
      'fetch',
      '--tags',
      '--prune',
      '--unshallow',
      'origin',
    ]);
  });

  it('fails when detached checkout resolves to a different HEAD SHA', async () => {
    mockSpawn.mockImplementation((command, args) => {
      const child: any = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();

      setTimeout(() => {
        if (args[0] === 'rev-parse') {
          child.stdout.emit('data', Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'));
        }
        child.emit('close', 0);
      }, 5);

      return child;
    });

    await expect(
      GitRepositoryFetcher.fetch({
        url: 'https://github.com/owner/repo',
        targetDir: '/tmp/repo',
        ref: '33ca78792610f1b0ece552767ef370bcb1978205',
      }),
    ).rejects.toMatchObject({
      code: 'COMMIT_NOT_FETCHABLE',
    } satisfies Partial<GitFetchError>);
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
