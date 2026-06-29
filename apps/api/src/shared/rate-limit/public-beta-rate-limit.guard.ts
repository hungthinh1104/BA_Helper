import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '@ba-helper/shared';
import { IS_PUBLIC_KEY } from '../../modules/auth/application/jwt-auth.guard';
import { getPublicBetaRateLimitConfig } from './public-beta-rate-limit.config';
import { PublicBetaRateLimitPolicy } from './public-beta-rate-limit.policy';

type RateLimitedRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  params?: Record<string, string>;
  ip?: string;
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
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RateLimitedRequest>();
    const path = request.originalUrl ?? request.url ?? '';
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic && !this.policy.shouldLimit(request.method, path)) {
      return true;
    }

    const decision = this.policy.consume({
      config: getPublicBetaRateLimitConfig(),
      method: request.method,
      path,
      scopeKey: buildScopeKey(request),
    });

    if (decision.allowed) return true;

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

function buildScopeKey(request: RateLimitedRequest): string {
  const user = request.user?.id ?? request.user?.email ?? request.ip ?? 'anonymous';
  const project = request.params?.projectId ?? 'global';
  return `${user}:${project}`;
}
