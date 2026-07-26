import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@ba-helper/shared';
import { IS_PUBLIC_KEY } from '../../modules/auth/application/jwt-auth.guard';
import { getPublicBetaRateLimitConfig } from './public-beta-rate-limit.config';
import { PublicBetaRateLimitPolicy } from './public-beta-rate-limit.policy';
import { createHash } from 'node:crypto';
import { QueueService } from '@ba-helper/backend-runtime/queue';

type RateLimitedRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  params?: Record<string, string>;
  ip?: string;
  body?: { email?: unknown };
  user?: {
    id?: string;
    email?: string;
  };
};

@Injectable()
export class PublicBetaRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly policy: PublicBetaRateLimitPolicy,
    @Inject(QueueService)
    private readonly queueService: Pick<QueueService, 'consumeRateLimit'>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const path = request.originalUrl ?? request.url ?? '';
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic && !this.policy.shouldLimit(request.method, path)) {
      return true;
    }

    const config = getPublicBetaRateLimitConfig();
    if (!config.enabled || !this.policy.shouldLimit(request.method, path)) {
      return true;
    }

    // Login routes are throttled on TWO independent dimensions so neither a single
    // hostile IP nor a targeted account can be brute-forced: rotating IPs are
    // bounded by the per-email bucket, and a shared NAT IP cannot lock out a whole
    // office because each victim account has its own budget.
    const scopeKeys = this.buildScopeKeys(request, path);

    for (const scopeKey of scopeKeys) {
      let decision;
      try {
        decision = await this.queueService.consumeRateLimit({
          key: scopeKey,
          maxRequests: config.maxRequests,
          windowMs: config.windowMs,
        });
      } catch {
        // Redis is the source of truth for the limiter. If it is unavailable we
        // fail CLOSED — refusing with a clear, typed 503 rather than silently
        // allowing unlimited attempts.
        throw new AppError(
          'RATE_LIMITER_UNAVAILABLE',
          'Rate limiting is temporarily unavailable. Please retry shortly.',
          { reason: 'RATE_LIMITER_BACKEND_UNAVAILABLE' },
        );
      }

      if (!decision.allowed) {
        throw new AppError(
          'RATE_LIMITED',
          'Too many public beta requests. Please retry after the rate limit window resets.',
          {
            retryAfterMs: decision.retryAfterMs,
            limit: decision.limit,
            windowMs: decision.windowMs,
          },
        );
      }
    }

    return true;
  }

  private buildScopeKeys(request: RateLimitedRequest, path: string): string[] {
    const normalizedPath = path.split('?')[0];
    const method = request.method.toUpperCase();
    const suffix = `${method}:${normalizedPath}`;

    if (this.policy.isLoginRoute(method, normalizedPath)) {
      const ip = request.ip ?? 'anonymous';
      const email = normalizeEmail(request.body?.email);
      return [
        hashScope(`ip:${ip}:${suffix}`),
        hashScope(`email:${email}:${suffix}`),
      ];
    }

    const principal =
      request.user?.id ?? request.user?.email ?? request.ip ?? 'anonymous';
    const project = request.params?.projectId ?? 'global';
    return [hashScope(`${principal}:${project}:${suffix}`)];
  }
}

function normalizeEmail(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : 'anonymous';
}

function hashScope(rawScope: string): string {
  return createHash('sha256').update(rawScope).digest('hex');
}
