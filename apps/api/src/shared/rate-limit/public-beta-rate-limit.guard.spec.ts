import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AppError } from '@ba-helper/shared';
import { PublicBetaRateLimitGuard } from './public-beta-rate-limit.guard';
import { PublicBetaRateLimitPolicy } from './public-beta-rate-limit.policy';

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

  it('blocks repeated scoped mutation requests with safe RATE_LIMITED details', () => {
    const guard = new PublicBetaRateLimitGuard(reflector(false), new PublicBetaRateLimitPolicy());
    const context = httpContext({
      method: 'POST',
      originalUrl: '/api/v1/projects/project-1/requirements',
      params: { projectId: 'project-1' },
      user: { id: 'user-1', email: 'user@example.com' },
      body: { rawText: 'secret-token-should-not-appear' },
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(AppError);

    try {
      guard.canActivate(context);
    } catch (error) {
      expect(error).toMatchObject({
        code: 'RATE_LIMITED',
        details: {
          limit: 1,
          windowMs: 60_000,
        },
      });
      expect(JSON.stringify((error as AppError).details)).not.toContain('secret-token');
    }
  });

  it('does not block read model GET requests', () => {
    const guard = new PublicBetaRateLimitGuard(reflector(false), new PublicBetaRateLimitPolicy());
    const context = httpContext({
      method: 'GET',
      originalUrl: '/api/v1/impact-analyses/analysis-1',
      user: { id: 'user-1' },
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('exempts public endpoints such as health/bootstrap routes', () => {
    const guard = new PublicBetaRateLimitGuard(reflector(true), new PublicBetaRateLimitPolicy());
    const context = httpContext({
      method: 'GET',
      originalUrl: '/api/v1/system/health',
      user: undefined,
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
  });
});

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
