import { randomUUID } from 'node:crypto';

export function configureIsolatedE2EEnvironment(env: NodeJS.ProcessEnv): void {
  env.NODE_ENV = 'test';
  env.AI_PROVIDER = 'fake';
  env.EMBEDDING_PROVIDER = 'fake';
  env.BA_HELPER_DEVELOPMENT_REDIS_URL ??= env.REDIS_URL || 'redis://localhost:6379';
  if (env.DATABASE_URL_TEST) env.DATABASE_URL = env.DATABASE_URL_TEST;
  if (env.REDIS_URL_TEST) env.REDIS_URL = env.REDIS_URL_TEST;
  env.BULLMQ_PREFIX = `ba-helper-e2e-${randomUUID()}`;
}
