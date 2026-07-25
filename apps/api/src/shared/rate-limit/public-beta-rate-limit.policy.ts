import type { PublicBetaRateLimitConfig } from './public-beta-rate-limit.config';

export type RateLimitDecision =
  | { allowed: true }
  | {
      allowed: false;
      retryAfterMs: number;
      limit: number;
      windowMs: number;
    };

type Bucket = {
  count: number;
  resetAt: number;
};

const LIMITED_ROUTES = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/dev-login$/ },
  { method: 'POST', pattern: /^\/api\/v1\/repositories\/[^/]+\/scan-jobs$/ },
  { method: 'POST', pattern: /^\/api\/v1\/projects\/[^/]+\/requirements$/ },
  { method: 'POST', pattern: /^\/api\/v1\/requirements\/[^/]+\/revisions$/ },
  { method: 'POST', pattern: /^\/api\/v1\/requirement-revisions\/[^/]+\/impact-analyses$/ },
  { method: 'POST', pattern: /^\/api\/v1\/impact-analyses\/[^/]+\/finalize$/ },
  { method: 'GET', pattern: /^\/api\/v1\/impact-analyses\/[^/]+\/approved-report\/export\.(md|pdf)$/ },
  { method: 'POST', pattern: /^\/api\/v1\/projects\/[^/]+\/multi-repo-analyses$/ },
  { method: 'POST', pattern: /^\/api\/v1\/multi-repo-runs\/[^/]+\/merged-report\/finalize$/ },
  { method: 'GET', pattern: /^\/api\/v1\/multi-repo-runs\/[^/]+\/merged-report\/export\.(md|pdf)$/ },
];

export class PublicBetaRateLimitPolicy {
  private readonly buckets = new Map<string, Bucket>();

  shouldLimit(method: string, path: string): boolean {
    const normalizedPath = path.split('?')[0] ?? path;
    return LIMITED_ROUTES.some((route) => (
      route.method === method.toUpperCase() &&
      route.pattern.test(normalizedPath)
    ));
  }

  consume(params: {
    config: PublicBetaRateLimitConfig;
    method: string;
    path: string;
    scopeKey: string;
    now?: number;
  }): RateLimitDecision {
    if (!params.config.enabled || !this.shouldLimit(params.method, params.path)) {
      return { allowed: true };
    }

    const now = params.now ?? Date.now();
    const key = `${params.scopeKey}:${params.method.toUpperCase()}:${params.path.split('?')[0]}`;
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + params.config.windowMs }
      : existing;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    if (bucket.count <= params.config.maxRequests) {
      return { allowed: true };
    }

    return {
      allowed: false,
      retryAfterMs: Math.max(0, bucket.resetAt - now),
      limit: params.config.maxRequests,
      windowMs: params.config.windowMs,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}
