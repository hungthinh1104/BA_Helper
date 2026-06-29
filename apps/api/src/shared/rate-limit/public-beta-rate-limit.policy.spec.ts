import { PublicBetaRateLimitPolicy } from './public-beta-rate-limit.policy';

describe('PublicBetaRateLimitPolicy', () => {
  it('rate-limits configured public beta mutation routes after threshold', () => {
    const policy = new PublicBetaRateLimitPolicy();
    const config = { enabled: true, maxRequests: 2, windowMs: 60_000 };

    expect(policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/impact-analyses/analysis-1/finalize',
      scopeKey: 'user-1:project-1',
      now: 1000,
    }).allowed).toBe(true);
    expect(policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/impact-analyses/analysis-1/finalize',
      scopeKey: 'user-1:project-1',
      now: 1001,
    }).allowed).toBe(true);

    const decision = policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/impact-analyses/analysis-1/finalize',
      scopeKey: 'user-1:project-1',
      now: 1002,
    });

    expect(decision).toEqual({
      allowed: false,
      retryAfterMs: 59_998,
      limit: 2,
      windowMs: 60_000,
    });
  });

  it('does not limit read-model GET endpoints', () => {
    const policy = new PublicBetaRateLimitPolicy();
    const config = { enabled: true, maxRequests: 0, windowMs: 60_000 };

    expect(policy.consume({
      config,
      method: 'GET',
      path: '/api/v1/impact-analyses/analysis-1',
      scopeKey: 'user-1:global',
    }).allowed).toBe(true);
  });

  it('rate-limits dev-login even though the route is public', () => {
    const policy = new PublicBetaRateLimitPolicy();
    const config = { enabled: true, maxRequests: 1, windowMs: 60_000 };

    expect(policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/auth/dev-login',
      scopeKey: '127.0.0.1:global',
      now: 1000,
    }).allowed).toBe(true);
    expect(policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/auth/dev-login',
      scopeKey: '127.0.0.1:global',
      now: 1001,
    }).allowed).toBe(false);
  });

  it('does not limit public health endpoints', () => {
    const policy = new PublicBetaRateLimitPolicy();
    const config = { enabled: true, maxRequests: 0, windowMs: 60_000 };

    expect(policy.consume({
      config,
      method: 'GET',
      path: '/api/v1/system/health',
      scopeKey: 'anonymous:global',
    }).allowed).toBe(true);
  });

  it('resets the bucket after the configured window', () => {
    const policy = new PublicBetaRateLimitPolicy();
    const config = { enabled: true, maxRequests: 1, windowMs: 100 };

    expect(policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/projects/project-1/requirements',
      scopeKey: 'user-1:project-1',
      now: 1000,
    }).allowed).toBe(true);
    expect(policy.consume({
      config,
      method: 'POST',
      path: '/api/v1/projects/project-1/requirements',
      scopeKey: 'user-1:project-1',
      now: 1101,
    }).allowed).toBe(true);
  });
});
