export type PublicBetaRateLimitConfig = {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
};

export function getPublicBetaRateLimitConfig(
  env: NodeJS.ProcessEnv = process.env,
): PublicBetaRateLimitConfig {
  return {
    enabled: env.PUBLIC_BETA_RATE_LIMIT_ENABLED !== 'false',
    maxRequests: readPositiveInt(env.PUBLIC_BETA_RATE_LIMIT_MAX, 60),
    windowMs: readPositiveInt(env.PUBLIC_BETA_RATE_LIMIT_WINDOW_MS, 60_000),
  };
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
