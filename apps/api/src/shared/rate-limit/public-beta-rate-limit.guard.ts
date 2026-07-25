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
    const decision = await this.queueService.consumeRateLimit({
      key: buildRateLimitKey(request, path),
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
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

function buildRateLimitKey(
  request: RateLimitedRequest,
  path: string,
): string {
  const user = request.user?.id ?? request.user?.email ?? request.ip ?? 'anonymous';
  const project = request.params?.projectId ?? 'global';
  const rawScope = `${user}:${project}:${request.method.toUpperCase()}:${path.split('?')[0]}`;
  return createHash('sha256').update(rawScope).digest('hex');
}
