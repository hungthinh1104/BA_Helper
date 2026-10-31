import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Worker } from 'bullmq';
import type { Queue } from 'bullmq';
import * as crypto from 'node:crypto';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import request from 'supertest';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';
import type { PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { resetDatabase } from './helpers/reset-db';
import { IsolatedRedisContainer } from './helpers/isolated-redis-container';
import { RedisTcpProxy } from './helpers/redis-tcp-proxy';
import type { StaleJobRecoveryService } from '../../../worker/src/shared/stale-job-recovery.service';

describe('Redis transport outage recovery (E2E)', () => {
  let app: INestApplication | undefined;
  let prisma: PrismaService | undefined;
  let jwtService: JwtService;
  let queueService: QueueService;
  let scanQueue: Queue;
  let redisProxy: RedisTcpProxy | undefined;
  let redisContainer: IsolatedRedisContainer | undefined;
  let recovery: StaleJobRecoveryService | undefined;
  let worker: Worker<{ jobId: string }, string, string> | undefined;
  let adminToken: string;
  let scanJobId: string | undefined;
  let previousRedisUrl: string | undefined;
  let previousRedisTestUrl: string | undefined;
  let previousRecoveryInterval: string | undefined;

  beforeAll(async () => {
    previousRedisUrl = process.env.REDIS_URL;
    previousRedisTestUrl = process.env.REDIS_URL_TEST;
    dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });
    redisContainer = await IsolatedRedisContainer.start();
    redisProxy = await RedisTcpProxy.start(redisContainer.url(0));
    const developmentRedisUrl = new URL(redisProxy.url);
    const testRedisUrl = new URL(redisProxy.url);
    testRedisUrl.pathname = '/1';
    process.env.REDIS_URL = developmentRedisUrl.toString();
    process.env.REDIS_URL_TEST = testRedisUrl.toString();

    const { createTestApp } = await import('./helpers/test-app');
    app = await createTestApp();
    const runtime = await import('@ba-helper/backend-runtime');
    prisma = app.get(runtime.PrismaService);
    jwtService = app.get(JwtService);
    queueService = app.get(runtime.QueueService);
    scanQueue = app.get<Queue>('BullQueue_scan-job');
  }, 60_000);

  afterEach(async () => {
    if (redisContainer && !redisContainer.isRunning()) {
      await redisContainer.restart();
      redisProxy?.setTarget(redisContainer.url(0));
    }
    await recovery?.onApplicationShutdown();
    recovery = undefined;
    await worker?.close();
    worker = undefined;
    if (scanJobId && scanQueue) {
      const job = await scanQueue.getJob(`scan-${scanJobId}`);
      if (job) await job.remove();
      scanJobId = undefined;
    }
    restoreRecoveryInterval();
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
    await redisProxy?.close();
    redisContainer?.remove();
    restoreEnvironmentValue('REDIS_URL', previousRedisUrl);
    restoreEnvironmentValue('REDIS_URL_TEST', previousRedisTestUrl);
  });

  it('recovers a queued scan after isolated Redis stops and restarts while the worker remains online', async () => {
    if (!app || !prisma || !redisProxy || !redisContainer) {
      throw new Error('E2E application setup did not complete.');
    }
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'redis-outage@ba-helper.local',
        name: 'Redis Outage Admin',
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });

    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Redis Outage Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);
    const repositoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/redis-outage' })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);

    previousRecoveryInterval = process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = '1000';
    const { StaleJobRecoveryService: RecoveryService } = await import(
      '../../../worker/src/shared/stale-job-recovery.service'
    );
    const runtime = await import('@ba-helper/backend-runtime');
    recovery = new RecoveryService(prisma, queueService, app.get(runtime.EventLogService));
    await recovery.onApplicationBootstrap();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(201);
    const scanJob = scanJobResponseSchema.parse(response.body);
    scanJobId = scanJob.id;
    const initialJob = await scanQueue.getJob(`scan-${scanJob.id}`);
    expect(initialJob).toBeDefined();
    await initialJob!.remove();

    let processedJobId: string | undefined;
    const workerErrors: string[] = [];
    let resolveProcessed!: (jobId: string) => void;
    const processed = new Promise<string>((resolve) => { resolveProcessed = resolve; });
    worker = new Worker<{ jobId: string }, string, string>(
      'scan-job',
      async (job) => {
        processedJobId = job.data.jobId;
        resolveProcessed(job.data.jobId);
        return `processed:${job.data.jobId}`;
      },
      { connection: scanQueue.opts.connection, prefix: scanQueue.opts.prefix, concurrency: 1 },
    );
    worker.on('error', (error) => workerErrors.push(`${error.name}: ${error.message}`));
    await worker.waitUntilReady();

    expect(redisProxy.acceptedConnectionCount).toBeGreaterThan(0);
    expect(redisProxy.activeConnectionCount).toBeGreaterThan(0);
    const redisClient = await scanQueue.client;
    const redisClientEvents: string[] = [];
    redisClient.on('ready', () => redisClientEvents.push('ready'));
    redisClient.on('reconnecting', () => redisClientEvents.push('reconnecting'));
    redisClient.on('error', (error) => redisClientEvents.push(`error:${error.name}: ${error.message}`));
    const runIdBeforeOutage = redisContainer.runId();
    const acceptedConnectionsBeforeOutage = redisProxy.acceptedConnectionCount;
    redisContainer.stop();
    expect(redisContainer.isRunning()).toBe(false);
    await waitForProxyConnectionCount(redisProxy, acceptedConnectionsBeforeOutage + 1, 8_000);
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    expect(redisProxy.upstreamConnectionErrorCount).toBeGreaterThan(0);
    expect(worker.isRunning()).toBe(true);
    expect(processedJobId).toBeUndefined();
    await expect(prisma.scanJob.findUnique({
      where: { id: scanJob.id },
      select: { status: true },
    })).resolves.toMatchObject({ status: 'QUEUED' });
    const acceptedConnectionsDuringOutage = redisProxy.acceptedConnectionCount;

    await redisContainer.restart();
    redisProxy.setTarget(redisContainer.url(0));
    expect(redisContainer.runId()).not.toBe(runIdBeforeOutage);
    try {
      await expectWithin(processed, 15_000);
    } catch {
      const observedJob = await expectWithin(scanQueue.getJob(`scan-${scanJob.id}`), 3_000)
        .catch(() => undefined);
      const observedState = observedJob
        ? await expectWithin(observedJob.getState(), 3_000).catch(() => 'state-unavailable')
        : 'missing-or-unavailable';
      const recoveryPending = Boolean(
        (recovery as unknown as { queuedJobRecoveryTask?: Promise<void> } | undefined)?.queuedJobRecoveryTask,
      );
      throw new Error(
        `Redis restarted but scan was not processed (queue=${observedState}, ` +
        `client=${redisClient.status}, recoveryPending=${recoveryPending}, ` +
        `upstreamErrors=${redisProxy.upstreamConnectionErrorCount}, ` +
        `redisEvents=${redisClientEvents.slice(-12).join('|') || 'none'}, ` +
        `workerErrors=${workerErrors.slice(-8).join('|') || 'none'}).`,
      );
    }
    expect(processedJobId).toBe(scanJob.id);
    expect(worker.isRunning()).toBe(true);
    expect(redisProxy.acceptedConnectionCount).toBeGreaterThan(acceptedConnectionsDuringOutage);

    await waitForQueueJobState(scanQueue, `scan-${scanJob.id}`, 'completed', 5_000);
    const recoveredJob = await scanQueue.getJob(`scan-${scanJob.id}`);
    expect(recoveredJob?.data).toEqual({ jobId: scanJob.id });
    await expect(recoveredJob?.getState()).resolves.toBe('completed');
    expect(await prisma.scanJob.count({ where: { id: scanJob.id } })).toBe(1);
  }, 45_000);

  function restoreRecoveryInterval(): void {
    if (previousRecoveryInterval === undefined) {
      delete process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    } else {
      process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = previousRecoveryInterval;
    }
    previousRecoveryInterval = undefined;
  }

  function restoreEnvironmentValue(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function waitForProxyConnectionCount(
  proxy: RedisTcpProxy,
  expectedCount: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proxy.acceptedConnectionCount >= expectedCount) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`BullMQ clients did not reconnect ${expectedCount} times while Redis was stopped.`);
}

async function waitForQueueJobState(
  queue: Queue,
  jobId: string,
  expectedState: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await queue.getJob(jobId);
    if (job && await job.getState() === expectedState) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`BullMQ job ${jobId} did not reach ${expectedState} before the deadline.`);
}

async function expectWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Worker did not resume after Redis transport recovery.')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
