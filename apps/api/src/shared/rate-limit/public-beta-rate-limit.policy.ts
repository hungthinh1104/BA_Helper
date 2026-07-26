const LOGIN_ROUTES = [
  { method: 'POST', pattern: /^\/api\/v1\/auth\/login$/ },
  { method: 'POST', pattern: /^\/api\/v1\/auth\/dev-login$/ },
];

const LIMITED_ROUTES = [
  ...LOGIN_ROUTES,
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

/**
 * Route classification for the distributed (Redis-backed) rate limiter. This
 * policy is pure route matching only — the atomic counting lives in
 * `QueueService.consumeRateLimit`; no in-memory bucket state is kept here.
 */
export class PublicBetaRateLimitPolicy {
  shouldLimit(method: string, path: string): boolean {
    const normalizedPath = path.split('?')[0] ?? path;
    return LIMITED_ROUTES.some((route) => (
      route.method === method.toUpperCase() &&
      route.pattern.test(normalizedPath)
    ));
  }

  /** Login routes get an extra per-normalized-email throttle dimension. */
  isLoginRoute(method: string, path: string): boolean {
    const normalizedPath = path.split('?')[0] ?? path;
    return LOGIN_ROUTES.some((route) => (
      route.method === method.toUpperCase() &&
      route.pattern.test(normalizedPath)
    ));
  }
}
