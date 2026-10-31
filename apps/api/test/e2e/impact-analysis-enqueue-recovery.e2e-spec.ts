import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import { UnrecoverableError, Worker } from 'bullmq';
import type { Queue } from 'bullmq';
import {
  impactAnalysisResponseSchema,
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  requirementCreateResponseSchema,
  requirementRevisionCreateResponseSchema,
} from '@ba-helper/contracts';
import { EventLogService, PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { seedScanJobCompletion } from './helpers/seed-fixture';
import { StaleJobRecoveryService } from '../../../worker/src/shared/stale-job-recovery.service';

describe('Impact analysis enqueue recovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queueService: QueueService;
  let impactQueue: Queue;
  let adminToken: string;
  let queuedAnalysisId: string | undefined;
  let startupRecovery: StaleJobRecoveryService | undefined;
  let failureWorker: Worker<{ analysisId: string }, void, string> | undefined;
  let previousRecoveryInterval: string | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    queueService = app.get(QueueService);
    impactQueue = app.get<Queue>('BullQueue_impact-analysis');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'analysis-recovery@ba-helper.local',
        name: 'Analysis Recovery Admin',
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  afterEach(async () => {
    await failureWorker?.close();
    failureWorker = undefined;
    await startupRecovery?.onApplicationShutdown();
    startupRecovery = undefined;
    jest.restoreAllMocks();
    if (previousRecoveryInterval === undefined) {
      delete process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    } else {
      process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = previousRecoveryInterval;
    }
    previousRecoveryInterval = undefined;
    if (queuedAnalysisId) {
      const queuedJob = await impactQueue.getJob(`impact-${queuedAnalysisId}`);
      if (queuedJob) await queuedJob.remove();
      queuedAnalysisId = undefined;
    }
  });

  async function createAnalysisRequest() {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Analysis Recovery Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);

    const repositoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/analysis-recovery' })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);

    const scanJob = await prisma.scanJob.create({
      data: {
        repositoryId: repository.repositoryId,
        requestKey: crypto.randomUUID(),
        requestedRef: 'main',
        status: 'QUEUED',
        stage: 'WAITING',
      },
    });
    const { snapshot, target } = await seedScanJobCompletion(prisma, scanJob.id);

    const requirementResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/requirements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: crypto.randomUUID(),
        title: 'Refund paid booking',
        rawText: 'Allow users to cancel a paid booking and receive a refund.',
      })
      .expect(201);
    const requirement = requirementCreateResponseSchema.parse(requirementResponse.body);

    const revisionResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirements/${requirement.requirementId}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Refund paid booking',
        rawText: 'Allow users to cancel a paid booking and receive a refund.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      })
      .expect(201);
    const revision = requirementRevisionCreateResponseSchema.parse(revisionResponse.body);

    const payload = {
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
      allowPartialSnapshot: false,
      requestKey: crypto.randomUUID(),
      domainPackId: 'booking',
    };
    return { revisionId: revision.revisionId, payload };
  }

  async function waitForImpactQueueState(jobId: string, state: string) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const job = await impactQueue.getJob(jobId);
      if (job && await job.getState() === state) return job;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const lastJob = await impactQueue.getJob(jobId);
    const lastState = lastJob ? await lastJob.getState() : 'missing';
    throw new Error(
      `BullMQ job ${jobId} did not reach ${state} before the deadline; ` +
      `state=${lastState}, attemptsMade=${lastJob?.attemptsMade ?? 'n/a'}, ` +
      `failedReason=${lastJob?.failedReason ?? 'n/a'}.`,
    );
  }

  it('replays event and queue delivery for a queued analysis after an event-log failure', async () => {
    const { revisionId, payload } = await createAnalysisRequest();
    const persistEvent = jest
      .spyOn(prisma.domainEvent, 'createMany')
      .mockRejectedValueOnce(new Error('injected transient event-log persistence failure'));

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);

    const persistedAnalysis = await prisma.impactAnalysis.findFirst({
      where: { requestKey: payload.requestKey },
    });
    expect(persistedAnalysis).toMatchObject({ status: 'QUEUED' });
    expect(persistedAnalysis).not.toBeNull();
    queuedAnalysisId = persistedAnalysis!.id;
    expect(await impactQueue.getJob(`impact-${queuedAnalysisId}`)).toBeUndefined();

    startupRecovery = new StaleJobRecoveryService(prisma, queueService, app.get(EventLogService));
    await startupRecovery.onApplicationBootstrap();
    expect(await impactQueue.getJob(`impact-${queuedAnalysisId}`)).toBeDefined();

    const retryResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    const retryAnalysis = impactAnalysisResponseSchema.parse(retryResponse.body);
    expect(retryAnalysis.id).toBe(queuedAnalysisId);
    const bullJob = await impactQueue.getJob(`impact-${queuedAnalysisId}`);
    expect(bullJob).toBeDefined();
    expect(bullJob?.data).toEqual({ analysisId: queuedAnalysisId });
    expect(persistEvent).toHaveBeenCalledTimes(2);
    expect(await prisma.impactAnalysis.count({ where: { requestKey: payload.requestKey } })).toBe(1);
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `impact:${queuedAnalysisId}:queued` },
    })).toBe(1);
  });

  it('periodically re-delivers a queued analysis after a transient Redis failure while recovery stays online', async () => {
    const { revisionId, payload } = await createAnalysisRequest();
    jest.spyOn(prisma.domainEvent, 'createMany')
      .mockRejectedValueOnce(new Error('Injected event-log failure before enqueue.'));
    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);

    const persisted = await prisma.impactAnalysis.findFirst({
      where: { requestKey: payload.requestKey },
    });
    expect(persisted).toMatchObject({ status: 'QUEUED' });
    if (!persisted) throw new Error('Expected the queued analysis to persist.');
    queuedAnalysisId = persisted.id;
    expect(await impactQueue.getJob(`impact-${persisted.id}`)).toBeUndefined();

    previousRecoveryInterval = process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = '1000';
    jest.spyOn(impactQueue, 'add').mockImplementationOnce(async () => {
      throw new Error('Injected transient Redis delivery failure.');
    });

    startupRecovery = new StaleJobRecoveryService(prisma, queueService, app.get(EventLogService));
    await startupRecovery.onApplicationBootstrap();

    const recoveredJob = await waitForImpactQueueState(`impact-${persisted.id}`, 'waiting');
    expect(recoveredJob.data).toEqual({ analysisId: persisted.id });
    expect(await prisma.impactAnalysis.findUnique({
      where: { id: persisted.id },
      select: { status: true },
    })).toEqual({ status: 'QUEUED' });

    const retryResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    expect(impactAnalysisResponseSchema.parse(retryResponse.body).id).toBe(persisted.id);
    expect((await impactQueue.getJob(`impact-${persisted.id}`))?.data).toEqual({
      analysisId: persisted.id,
    });
  }, 15_000);

  it('re-delivers a queued analysis after its Redis connection is killed while recovery stays online', async () => {
    const { revisionId, payload } = await createAnalysisRequest();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    const analysis = impactAnalysisResponseSchema.parse(response.body);
    queuedAnalysisId = analysis.id;

    const initialJob = await impactQueue.getJob(`impact-${analysis.id}`);
    expect(initialJob).toBeDefined();
    await initialJob!.remove();

    previousRecoveryInterval = process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = '1000';
    startupRecovery = new StaleJobRecoveryService(prisma, queueService, app.get(EventLogService));
    await startupRecovery.onApplicationBootstrap();

    const startupJob = await impactQueue.getJob(`impact-${analysis.id}`);
    expect(startupJob).toBeDefined();
    await startupJob!.remove();

    const impactRedis = await impactQueue.client as unknown as {
      call: (...args: string[]) => Promise<unknown>;
    };
    const scanQueue = app.get<Queue>('BullQueue_scan-job');
    const adminRedis = await scanQueue.client as unknown as {
      call: (...args: string[]) => Promise<unknown>;
    };
    const redisClientId = await impactRedis.call('CLIENT', 'ID');
    const disconnectedClients = await adminRedis.call(
      'CLIENT',
      'KILL',
      'ID',
      String(redisClientId),
    );
    expect(Number(disconnectedClients)).toBe(1);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysis.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const deadline = Date.now() + 10_000;
    let recoveredJob;
    while (Date.now() < deadline) {
      try {
        const candidate = await impactQueue.getJob(`impact-${analysis.id}`);
        if (candidate && await candidate.getState() === 'waiting') {
          recoveredJob = candidate;
          break;
        }
      } catch {
        // Redis may still be reconnecting after the targeted CLIENT KILL.
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(recoveredJob).toBeDefined();
    expect(recoveredJob?.data).toEqual({ analysisId: analysis.id });
    await expect(prisma.impactAnalysis.findUnique({
      where: { id: analysis.id },
      select: { status: true },
    })).resolves.toEqual({ status: 'QUEUED' });

    const retryResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    expect(impactAnalysisResponseSchema.parse(retryResponse.body).id).toBe(analysis.id);
    expect(await prisma.impactAnalysis.count({ where: { requestKey: payload.requestKey } })).toBe(1);
  }, 15_000);

  it('keeps a queued analysis successful when Redis stores the job but its add acknowledgement is lost', async () => {
    const { revisionId, payload } = await createAnalysisRequest();
    const realAdd = impactQueue.add.bind(impactQueue);
    jest.spyOn(impactQueue, 'add').mockImplementationOnce(async (...args) => {
      await realAdd(...args);
      throw new Error('Injected lost Redis enqueue acknowledgement.');
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);

    const persisted = await prisma.impactAnalysis.findFirst({
      where: { requestKey: payload.requestKey },
    });
    queuedAnalysisId = persisted?.id;
    expect(persisted).not.toBeNull();
    expect(await prisma.impactAnalysis.count({ where: { requestKey: payload.requestKey } })).toBe(1);

    const acceptedJob = await impactQueue.getJob(`impact-${persisted!.id}`);
    expect(acceptedJob?.data).toEqual({ analysisId: persisted!.id });
    await expect(acceptedJob?.getState()).resolves.toBe('waiting');
    expect(persisted).toMatchObject({ status: 'QUEUED' });
    expect(response.status).toBe(201);

    const analysis = impactAnalysisResponseSchema.parse(response.body);
    expect(persisted).toMatchObject({ id: analysis.id, status: 'QUEUED' });

    const retryResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    expect(impactAnalysisResponseSchema.parse(retryResponse.body).id).toBe(analysis.id);
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `impact:${analysis.id}:queued` },
    })).toBe(1);
    expect((await impactQueue.getJob(`impact-${analysis.id}`))?.data).toEqual({
      analysisId: analysis.id,
    });
  });

  it.each([
    {
      description: 'a different job name',
      name: 'unexpected-job-name',
      dataFor: (analysisId: string) => ({ analysisId }),
    },
    {
      description: 'a different payload',
      name: 'run',
      dataFor: () => ({ analysisId: 'different-analysis-id' }),
    },
  ])('rejects a retained deterministic job ID with $description', async ({ name, dataFor }) => {
    const { revisionId, payload } = await createAnalysisRequest();
    const initialResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    const analysis = impactAnalysisResponseSchema.parse(initialResponse.body);
    queuedAnalysisId = analysis.id;

    const initialJob = await impactQueue.getJob(`impact-${analysis.id}`);
    expect(initialJob).toBeDefined();
    await initialJob!.remove();
    await impactQueue.add(name, dataFor(analysis.id), { jobId: `impact-${analysis.id}` });

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);

    await expect(prisma.impactAnalysis.findUnique({
      where: { id: analysis.id },
      select: { status: true, error: true },
    })).resolves.toMatchObject({
      status: 'FAILED',
      error: { code: 'QUEUE_ENQUEUE_FAILED' },
    });
    expect(await prisma.impactAnalysis.count({ where: { requestKey: payload.requestKey } })).toBe(1);
    const retainedConflict = await impactQueue.getJob(`impact-${analysis.id}`);
    expect(retainedConflict).toMatchObject({ name, data: dataFor(analysis.id) });
  });

  it('recovers a QUEUED analysis whose deterministic BullMQ job is retained as failed', async () => {
    const { revisionId, payload } = await createAnalysisRequest();
    const response = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);
    const analysis = impactAnalysisResponseSchema.parse(response.body);
    queuedAnalysisId = analysis.id;

    const worker = new Worker<{ analysisId: string }, void, string>(
      'impact-analysis',
      async () => {
        throw new UnrecoverableError('Injected failure before product-state persistence.');
      },
      {
        connection: impactQueue.opts.connection,
        prefix: impactQueue.opts.prefix,
      },
    );
    failureWorker = worker;
    await worker.waitUntilReady();
    let failedBullJob;
    try {
      failedBullJob = await waitForImpactQueueState(`impact-${analysis.id}`, 'failed');
    } catch (error) {
      const isPaused = await impactQueue.isPaused();
      const counts = await impactQueue.getJobCounts('active', 'waiting', 'failed', 'delayed');
      throw new Error(
        `${error instanceof Error ? error.message : 'Queue failure wait failed'}; ` +
        `isPaused=${isPaused}, workerRunning=${worker.isRunning()}, ` +
        `counts=${JSON.stringify(counts)}`,
      );
    }
    expect(failedBullJob.data).toEqual({ analysisId: analysis.id });
    await worker.close();
    failureWorker = undefined;

    await expect(prisma.impactAnalysis.findUnique({
      where: { id: analysis.id },
      select: { status: true },
    })).resolves.toEqual({ status: 'QUEUED' });

    startupRecovery = new StaleJobRecoveryService(prisma, queueService, app.get(EventLogService));
    await startupRecovery.onApplicationBootstrap();

    const recoveredBullJob = await impactQueue.getJob(`impact-${analysis.id}`);
    expect(recoveredBullJob).toBeDefined();
    await expect(recoveredBullJob!.getState()).resolves.toBe('waiting');
    await expect(prisma.impactAnalysis.findUnique({
      where: { id: analysis.id },
      select: { status: true },
    })).resolves.toEqual({ status: 'QUEUED' });
  }, 15_000);
});
