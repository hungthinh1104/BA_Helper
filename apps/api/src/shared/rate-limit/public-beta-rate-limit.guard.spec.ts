import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AppError } from '@ba-helper/shared';
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

  it('blocks repeated scoped mutation requests with safe RATE_LIMITED details', async () => {
    const queueService = distributedLimiter();
    const guard = new PublicBetaRateLimitGuard(reflector(false), new PublicBetaRateLimitPolicy(), queueService);
    const context = httpContext({
      method: 'POST',
      originalUrl: '/api/v1/projects/project-1/requirements',
      params: { projectId: 'project-1' },
      user: { id: 'user-1', email: 'user@example.com' },
      body: { rawText: 'secret-token-should-not-appear' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      details: {
        limit: 1,
        windowMs: 60_000,
      },
    });
    expect(JSON.stringify(queueService.consumeRateLimit.mock.calls)).not.toContain('secret-token');
  });

  it('does not block read model GET requests', async () => {
    const queueService = distributedLimiter();
    const guard = new PublicBetaRateLimitGuard(reflector(false), new PublicBetaRateLimitPolicy(), queueService);
    const context = httpContext({
      method: 'GET',
      originalUrl: '/api/v1/impact-analyses/analysis-1',
      user: { id: 'user-1' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(queueService.consumeRateLimit).not.toHaveBeenCalled();
  });

  it('exempts public endpoints such as health/bootstrap routes', async () => {
    const queueService = distributedLimiter();
    const guard = new PublicBetaRateLimitGuard(reflector(true), new PublicBetaRateLimitPolicy(), queueService);
    const context = httpContext({
      method: 'GET',
      originalUrl: '/api/v1/system/health',
      user: undefined,
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it.each(['/api/v1/auth/login', '/api/v1/auth/dev-login'])(
    'rate-limits public login route %s by anonymous network scope',
    async (route) => {
    const queueService = distributedLimiter();
    const guard = new PublicBetaRateLimitGuard(reflector(true), new PublicBetaRateLimitPolicy(), queueService);
    const context = httpContext({
      method: 'POST',
      originalUrl: route,
      ip: '203.0.113.10',
      body: { email: 'admin@example.com' },
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(AppError);
    expect(JSON.stringify(queueService.consumeRateLimit.mock.calls)).not.toContain('admin@example.com');
  });
});

function distributedLimiter(): jest.Mocked<Pick<QueueService, 'consumeRateLimit'>> {
  let count = 0;
  return {
    consumeRateLimit: jest.fn(async ({ maxRequests, windowMs }) => {
      count += 1;
      return {
        allowed: count <= maxRequests,
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

function httpContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}
