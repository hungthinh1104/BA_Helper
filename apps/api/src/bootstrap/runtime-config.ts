const DEFAULT_WORKSPACE_MODE = 'dev-single-user' as const;
const DEFAULT_API_VERSION = process.env.APP_VERSION ?? '0.1.0';
const DEFAULT_DEV_CORS_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

export type WorkspaceMode = typeof DEFAULT_WORKSPACE_MODE;

export interface RuntimeConfig {
  apiVersion: string;
  corsAllowedOrigins: string[];
  isProductionLike: boolean;
  nodeEnv: string;
  port: number;
  workspaceMode: string;
}

export function isProductionLikeEnv(nodeEnv?: string): boolean {
  return nodeEnv === 'production' || nodeEnv === 'staging';
}

export function isWeakSecret(secret?: string): boolean {
  if (!secret) return true;
  const normalized = secret.trim();
  if (!normalized) return true;

  const weakSecrets = new Set([
    'dev-secret-change-me',
    'dev-super-secret-key',
    'dev-only-local-jwt-secret',
    'change-me',
    'replace-with-a-long-random-secret',
    'postgresql://localhost/ba_helper',
    'postgresql://ba_helper:ba_helper@localhost/ba_helper',
    'redis://localhost:6379',
    'dev-secret',
    'secret',
  ]);

  return weakSecrets.has(normalized);
}

export function requireEnv(key: string, devFallback?: string, nodeEnv?: string): string {
  const env = nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const isProd = isProductionLikeEnv(env);
  const value = process.env[key];

  if (isProd) {
    if (!value) {
      throw new Error(`Environment variable ${key} is required in production.`);
    }
    if (isWeakSecret(value)) {
      throw new Error(`Environment variable ${key} must not use a weak or default value in production.`);
    }
  }

  return value || devFallback || '';
}

export function normalizeOrigin(origin: string): string {
  const value = origin.trim();

  if (!value) {
    throw new Error('CORS origin entries must not be empty.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid CORS origin: ${origin}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported CORS origin protocol: ${origin}`);
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`CORS origins must not include path, query, or hash: ${origin}`);
  }

  return parsed.origin;
}

export function parseCorsAllowedOrigins(raw?: string): string[] {
  if (!raw || !raw.trim()) {
    return [];
  }

  const normalized = raw
    .split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter((entry, index, list) => list.indexOf(entry) === index);

  return normalized;
}

export function getRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProductionLike = isProductionLikeEnv(nodeEnv);
  const configuredOrigins = parseCorsAllowedOrigins(env.CORS_ALLOWED_ORIGINS);

  return {
    apiVersion: env.APP_VERSION ?? DEFAULT_API_VERSION,
    corsAllowedOrigins:
      configuredOrigins.length > 0
        ? configuredOrigins
        : isProductionLike
          ? []
          : DEFAULT_DEV_CORS_ALLOWED_ORIGINS,
    isProductionLike,
    nodeEnv,
    port: Number(env.PORT ?? '3001'),
    workspaceMode: env.WORKSPACE_MODE ?? DEFAULT_WORKSPACE_MODE,
  };
}

export function validateRuntimeConfig(config: RuntimeConfig): void {
  if (Number.isNaN(config.port) || config.port <= 0) {
    throw new Error(`Invalid PORT: ${config.port}`);
  }

  if (config.isProductionLike && config.corsAllowedOrigins.length === 0) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must be configured for production-like deploys.',
    );
  }
}

