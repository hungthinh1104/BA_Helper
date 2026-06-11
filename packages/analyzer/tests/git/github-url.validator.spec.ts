import { GitHubUrlValidator } from '../../src/git/github-url.validator';

describe('GitHubUrlValidator', () => {
  it('accepts https://github.com/owner/repo', () => {
    const result = GitHubUrlValidator.validate('https://github.com/owner/repo');
    expect(result.isValid).toBe(true);
  });

  it('accepts https://github.com/owner/repo.git', () => {
    const result = GitHubUrlValidator.validate('https://github.com/owner/repo.git');
    expect(result.isValid).toBe(true);
  });

  it('rejects query and fragment on repository URLs', () => {
    const result = GitHubUrlValidator.validate('https://github.com/owner/repo?tab=readme#top');
    expect(result.isValid).toBe(false);
  });

  it('rejects non-canonical GitHub paths such as /tree/main', () => {
    const result = GitHubUrlValidator.validate('https://github.com/owner/repo/tree/main');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('only owner and repository');
  });

  it('rejects non-canonical GitHub paths such as /blob/main/file.ts', () => {
    const result = GitHubUrlValidator.validate('https://github.com/owner/repo/blob/main/src/main.ts');
    expect(result.isValid).toBe(false);
  });

  it('rejects repository issue and pull request URLs', () => {
    expect(GitHubUrlValidator.validate('https://github.com/owner/repo/issues/1').isValid).toBe(false);
    expect(GitHubUrlValidator.validate('https://github.com/owner/repo/pull/2').isValid).toBe(false);
  });

  it('rejects git@github.com:owner/repo.git', () => {
    const result = GitHubUrlValidator.validate('git@github.com:owner/repo.git');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('HTTPS');
  });

  it('rejects file:///tmp/repo', () => {
    const result = GitHubUrlValidator.validate('file:///tmp/repo');
    expect(result.isValid).toBe(false);
  });

  it('rejects https://github.com.evil.com/a/b', () => {
    const result = GitHubUrlValidator.validate('https://github.com.evil.com/a/b');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('host');
  });

  it('rejects https://127.0.0.1/a/b', () => {
    const result = GitHubUrlValidator.validate('https://127.0.0.1/a/b');
    expect(result.isValid).toBe(false);
  });

  it('rejects URL with credentials', () => {
    const result = GitHubUrlValidator.validate('https://user:pass@github.com/owner/repo');
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('credentials');
  });

  it('rejects local paths', () => {
    const result = GitHubUrlValidator.validate('/home/user/project');
    expect(result.isValid).toBe(false);
  });
});
