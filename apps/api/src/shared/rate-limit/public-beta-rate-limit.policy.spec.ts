import { PublicBetaRateLimitPolicy } from './public-beta-rate-limit.policy';

describe('PublicBetaRateLimitPolicy', () => {
  const policy = new PublicBetaRateLimitPolicy();

  it('flags configured public-beta mutation routes for limiting', () => {
    expect(policy.shouldLimit('POST', '/api/v1/impact-analyses/a1/finalize')).toBe(true);
    expect(policy.shouldLimit('POST', '/api/v1/projects/p1/requirements')).toBe(true);
    expect(policy.shouldLimit('POST', '/api/v1/repositories/r1/scan-jobs')).toBe(true);
    expect(policy.shouldLimit('GET', '/api/v1/impact-analyses/a1/approved-report/export.md')).toBe(true);
    expect(policy.shouldLimit('POST', '/api/v1/auth/login')).toBe(true);
    expect(policy.shouldLimit('POST', '/api/v1/auth/dev-login')).toBe(true);
  });

  it('does not limit read-model GETs or public health endpoints', () => {
    expect(policy.shouldLimit('GET', '/api/v1/impact-analyses/a1')).toBe(false);
    expect(policy.shouldLimit('GET', '/api/v1/system/live')).toBe(false);
    expect(policy.shouldLimit('GET', '/api/v1/system/ready')).toBe(false);
  });

  it('ignores query strings when matching', () => {
    expect(policy.shouldLimit('POST', '/api/v1/auth/login?next=/')).toBe(true);
  });

  it('classifies only login routes as login routes', () => {
    expect(policy.isLoginRoute('POST', '/api/v1/auth/login')).toBe(true);
    expect(policy.isLoginRoute('POST', '/api/v1/auth/dev-login')).toBe(true);
    expect(policy.isLoginRoute('POST', '/api/v1/impact-analyses/a1/finalize')).toBe(false);
    expect(policy.isLoginRoute('POST', '/api/v1/projects/p1/requirements')).toBe(false);
  });
});
