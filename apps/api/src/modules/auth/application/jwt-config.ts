import { requireEnv } from '../../../bootstrap/runtime-config';

export function resolveJwtSecret(): string {
  return requireEnv('JWT_SECRET', 'dev-only-local-jwt-secret');
}
