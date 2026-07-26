import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { PublicBetaRateLimitGuard } from './public-beta-rate-limit.guard';
import { PublicBetaRateLimitPolicy } from './public-beta-rate-limit.policy';
import type { QueueService } from '@ba-helper/backend-runtime/queue';

describe('PublicBetaRateLimitGuard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PUBLIC_BETA_RATE_LIMIT_MAX: '1',
      PUBLIC_BETA_RATE_LIMIT_WINDOW_MS: '60000',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const makeGuard = (
    queueService: Pick<QueueService, 'consumeRateLimit'>,
    isPublic = false,
  ) => new PublicBetaRateLimitGuard(reflector(isPublic), new PublicBetaRateLimitPolicy(), queueService);

  it('blocks repeated scoped mutation requests with safe RATE_LIMITED details', async () => {
    const queueService = keyedLimiter();
    const guard = makeGuard(queueService);
    const context = () =>
      httpContext({
        method: 'POST',
        originalUrl: '/api/v1/projects/project-1/requirements',
        params: { projectId: 'project-1' },
        user: { id: 'user-1', email: 'user@example.com' },
        body: { rawText: 'secret-token-should-not-appear' },
      });

    await expect(guard.canActivate(context())).resolves.toBe(true);
    await expect(guard.canActivate(context())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: { limit: 1, windowMs: 60_000 },
    });
    // Request payloads must never be baked into a limiter key.
    expect(JSON.stringify(queueService.consumeRateLimit.mock.calls)).not.toContain('secret-token');
  });

  it('does not block read model GET requests', async () => {
    const queueService = keyedLimiter();
    const guard = makeGuard(queueService);
    const context = httpContext({
      method: 'GET',
      originalUrl: '/api/v1/impact-analyses/analysis-1',
      user: { id: 'user-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(queueService.consumeRateLimit).not.toHaveBeenCalled();
  });

  it('exempts public endpoints such as health/bootstrap routes', async () => {
    const queueService = keyedLimiter();
    const guard = makeGuard(queueService, true);
    const context = httpContext({
      method: 'GET',
      originalUrl: '/api/v1/system/live',
      user: undefined,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(queueService.consumeRateLimit).not.toHaveBeenCalled();
  });

  it('consumes independent per-IP and per-email buckets on login and never keys on the raw email', async () => {
    const queueService = keyedLimiter();
    const guard = makeGuard(queueService, true);

    await expect(
      guard.canActivate(loginContext('203.0.113.10', 'admin@example.com')),
    ).resolves.toBe(true);
    expect(queueService.consumeRateLimit).toHaveBeenCalledTimes(2); // ip + email
    expect(JSON.stringify(queueService.consumeRateLimit.mock.calls)).not.toContain('admin@example.com');
  });

  it('blocks a targeted account even when the attacker rotates IPs (per-email bucket)', async () => {
    const guard = makeGuard(keyedLimiter(), true);

    await expect(
      guard.canActivate(loginContext('203.0.113.10', 'victim@example.com')),
    ).resolves.toBe(true);
    // Different IP, same account -> the shared per-email bucket rejects it.
    await expect(
      guard.canActivate(loginContext('198.51.100.7', 'victim@example.com')),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('blocks credential-stuffing across accounts from one IP (per-IP bucket)', async () => {
    const guard = makeGuard(keyedLimiter(), true);

    await expect(
      guard.canActivate(loginContext('203.0.113.10', 'a@example.com')),
    ).resolves.toBe(true);
    // Same IP, different account -> the shared per-IP bucket rejects it.
    await expect(
      guard.canActivate(loginContext('203.0.113.10', 'b@example.com')),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('normalizes the email dimension so casing cannot dodge the per-email bucket', async () => {
    const guard = makeGuard(keyedLimiter(), true);

    await expect(
      guard.canActivate(loginContext('203.0.113.10', 'Victim@Example.com')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(loginContext('198.51.100.7', 'victim@example.COM')),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('fails CLOSED with a typed 503 code when the Redis limiter is unavailable', async () => {
    const queueService = {
      consumeRateLimit: jest.fn().mockRejectedValue(new Error('redis down')),
    } as unknown as Pick<QueueService, 'consumeRateLimit'>;
    const guard = makeGuard(queueService, true);

    await expect(
      guard.canActivate(loginContext('203.0.113.10', 'admin@example.com')),
    ).rejects.toMatchObject({ code: 'RATE_LIMITER_UNAVAILABLE' });
  });
});

function keyedLimiter(): jest.Mocked<Pick<QueueService, 'consumeRateLimit'>> {
  const counts = new Map<string, number>();
  return {
    consumeRateLimit: jest.fn(async ({ key, maxRequests, windowMs }) => {
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return {
        allowed: n <= maxRequests,
        retryAfterMs: windowMs,
        limit: maxRequests,
        windowMs,
      };
    }),
  };
}

function reflector(isPublic: boolean): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

function loginContext(ip: string, email: string): ExecutionContext {
  return httpContext({
    method: 'POST',
    originalUrl: '/api/v1/auth/login',
    ip,
    body: { email },
  });
}

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
