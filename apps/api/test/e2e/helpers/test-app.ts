import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { configureApp } from '../../../src/bootstrap/configure-app';
import { getRuntimeConfig } from '../../../src/bootstrap/runtime-config';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { prepareIsolatedTestEnv } from './prepare-test-env';

const E2E_QUEUE_NAMES = ['impact-analysis', 'embedding', 'scan-job', 'document-job'] as const;

export async function createTestApp(beforeInitialize?: (moduleFixture: TestingModule) => void): Promise<INestApplication> {
  await prepareIsolatedTestEnv();
  process.env.BULLMQ_PREFIX = `ba-helper-e2e-${randomUUID()}`;
  const { AppModule } = await import('../../../src/app.module');
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  beforeInitialize?.(moduleFixture);

  const app = moduleFixture.createNestApplication();
  const logServerErrors = process.env.E2E_LOG_SERVER_ERRORS === 'true';
  app.useLogger(logServerErrors ? ['error'] : false);
  if (logServerErrors) {
    app.use((request: { method: string; originalUrl?: string; url: string }, response: {
      statusCode: number;
      once(event: 'finish', listener: () => void): void;
    }, next: () => void) => {
      response.once('finish', () => {
        if (response.statusCode >= 500) {
          process.stderr.write(`[E2E_HTTP_5XX] ${request.method} ${request.originalUrl ?? request.url} ${response.statusCode}\n`);
        }
      });
      next();
    });
  }
  configureApp(app, getRuntimeConfig());
  await app.init();
  const testRedisUrl = process.env.REDIS_URL_TEST;
  const testPrefix = process.env.BULLMQ_PREFIX;
  if (!testRedisUrl || !testPrefix) {
    await app.close();
    throw new Error('E2E API requires an isolated Redis URL and BullMQ prefix.');
  }
  installQueueCleanupOnClose(app, testPrefix, testRedisUrl);
  await assertApiQueueUsesTestRedis(app);
  return app;
}

function installQueueCleanupOnClose(
  app: INestApplication,
  prefix: string,
  redisUrl: string,
): void {
  const closeApp = app.close.bind(app);
  let closing: Promise<void> | undefined;
  app.close = () => {
    closing ??= (async () => {
      try {
        await closeApp();
      } finally {
        await removeTestQueuePrefix(prefix, redisUrl);
      }
    })();
    return closing;
  };
}

async function removeTestQueuePrefix(prefix: string, redisUrl: string): Promise<void> {
  await Promise.all(E2E_QUEUE_NAMES.map(async (name) => {
    const queue = new Queue(name, { connection: { url: redisUrl }, prefix });
    try {
      await queue.obliterate({ force: true });
    } finally {
      await queue.close();
    }
  }));
}

async function assertApiQueueUsesTestRedis(app: INestApplication): Promise<void> {
  const testRedisUrl = process.env.REDIS_URL_TEST;
  const expectedPrefix = process.env.BULLMQ_PREFIX;
  if (!testRedisUrl || !expectedPrefix) {
    throw new Error('E2E API requires an isolated Redis URL and BullMQ prefix.');
  }

  const expected = new URL(testRedisUrl);
  const expectedDbText = expected.pathname.replace(/^\//, '');
  const expectedDb = expectedDbText === '' ? 0 : Number(expectedDbText);
  const queue = app.get<Queue>('BullQueue_document-job');
  const redisClient = await queue.client as unknown as {
    options: { host: string; port: number; db: number };
  };
  const actual = redisClient.options;
  const expectedPort = Number(expected.port || (expected.protocol === 'rediss:' ? 6380 : 6379));
  const mismatches: string[] = [];
  if (queue.opts.prefix !== expectedPrefix) mismatches.push('prefix');
  if (
    actual.host.toLowerCase() !== expected.hostname.toLowerCase() ||
    actual.port !== expectedPort
  ) mismatches.push('endpoint');
  if (actual.db !== expectedDb) mismatches.push('database');

  if (
    mismatches.length > 0
  ) {
    await app.close();
    throw new Error(
      `E2E API queue did not connect to REDIS_URL_TEST with its isolated prefix (mismatch: ${mismatches.join(', ')}).`,
    );
  }
}
