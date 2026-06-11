export function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  if (process.env.NODE_ENV === 'production' && isWeakJwtSecret(secret)) {
    throw new Error('JWT_SECRET must not use a default or weak example value in production');
  }

  return secret ?? 'dev-only-local-jwt-secret';
}

function isWeakJwtSecret(secret?: string): boolean {
  if (!secret) {
    return false;
  }

  const normalized = secret.trim();
  if (!normalized) {
    return true;
  }

  const weakSecrets = new Set([
    'dev-secret-change-me',
    'dev-super-secret-key',
    'dev-only-local-jwt-secret',
    'change-me',
    'replace-with-a-long-random-secret',
  ]);

  return weakSecrets.has(normalized) || normalized.length < 32;
}
