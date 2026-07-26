const DEFAULT_WORKSPACE_MODE = 'dev-single-user' as const;
const DEFAULT_API_VERSION = process.env.APP_VERSION ?? '0.1.0';

export type AuthMode = 'dev-login' | 'unsupported';

export function resolveAuthMode(env: NodeJS.ProcessEnv = process.env): AuthMode {
  const nodeEnv = env.NODE_ENV;
  const isLocalDev = nodeEnv === 'development' || nodeEnv === 'test';
  const previewEnabled = env.PREVIEW_AUTH_ENABLED === 'true' || env.PUBLIC_PREVIEW_MODE === 'true';
  const explicitEnable = env.ENABLE_DEV_LOGIN === 'true';
  const explicitDisable = env.ENABLE_DEV_LOGIN === 'false';

  if (previewEnabled) return 'unsupported';
  if (!isLocalDev) return 'unsupported';
  if (explicitDisable) return 'unsupported';
  if (explicitEnable || isLocalDev) return 'dev-login';

  return 'unsupported';
}

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
  publicPreviewMode: boolean;
  aiProvider: string;
  enableDevLogin: boolean;
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
    'dev-only-local-nextauth-secret',
    'change-me',
    'replace-with-a-long-random-secret',
    'postgresql://localhost/ba_helper',
    'postgresql://ba_helper:ba_helper@localhost/ba_helper',
    'redis://localhost:6379',
    'redis://redis:6379',
    'dev-secret',
    'secret',
  ]);

  if (weakSecrets.has(normalized)) return true;

  // Reject the `.env.production.example` placeholders so a copy-paste-without-edit
  // deploy fails fast (covers values like `replace-with-db-password`, embedded
  // `...:replace-with-db-password@...`, and `replace-me`). No real secret contains
  // these tokens.
  return /replace[-_ ]?(with|me)\b/i.test(normalized);
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
    publicPreviewMode: env.PUBLIC_PREVIEW_MODE === 'true',
    aiProvider: env.AI_PROVIDER || 'fake',
    enableDevLogin: resolveAuthMode(env) === 'dev-login',
  };
}

export function validateRuntimeConfig(config: RuntimeConfig, env: NodeJS.ProcessEnv = process.env): void {
  if (Number.isNaN(config.port) || config.port <= 0) {
    throw new Error(`Invalid PORT: ${config.port}`);
  }

  if (config.isProductionLike && config.corsAllowedOrigins.length === 0) {
    throw new Error(
      'CORS_ALLOWED_ORIGINS must be configured for production-like deploys.',
    );
  }

  if (config.publicPreviewMode) {
    if (config.aiProvider !== 'fake') {
      throw new Error(`BOOT GUARD: PUBLIC_PREVIEW_MODE is active, but AI_PROVIDER is '${config.aiProvider}'. It must be 'fake'.`);
    }
    if (env.OPENAI_API_KEY) throw new Error('BOOT GUARD: OPENAI_API_KEY is forbidden in PUBLIC_PREVIEW_MODE.');
    if (env.GEMINI_API_KEY || env.GOOGLE_API_KEY) throw new Error('BOOT GUARD: GEMINI/GOOGLE API keys are forbidden in PUBLIC_PREVIEW_MODE.');
    if (env.ANTHROPIC_API_KEY) throw new Error('BOOT GUARD: ANTHROPIC_API_KEY is forbidden in PUBLIC_PREVIEW_MODE.');
    if (env.DEEPSEEK_API_KEY) throw new Error('BOOT GUARD: DEEPSEEK_API_KEY is forbidden in PUBLIC_PREVIEW_MODE.');
  }

  const isExplicitlyEnabled = env.ENABLE_DEV_LOGIN === 'true';

  if (isExplicitlyEnabled || config.enableDevLogin) {
    if (config.isProductionLike) {
      throw new Error('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in production/staging environments.');
    }
    if (config.publicPreviewMode) {
      throw new Error('BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden in PUBLIC_PREVIEW_MODE.');
    }
  }

  if (config.enableDevLogin) {
    if (config.workspaceMode !== DEFAULT_WORKSPACE_MODE) {
      throw new Error(`BOOT GUARD: ENABLE_DEV_LOGIN=true is forbidden when workspace mode is '${config.workspaceMode}'.`);
    }
  }
}

