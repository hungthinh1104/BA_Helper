import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';
import { PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { StaleJobRecoveryService } from '../../../worker/src/shared/stale-job-recovery.service';

interface ScanQueueJob {
  data: unknown;
  remove(): Promise<void>;
}

interface ScanJobQueue {
  getJob(jobId: string): Promise<ScanQueueJob | undefined>;
}

type ScanCreateInput = {
  requestKey: string;
  ref?: string;
  requestedRef?: string;
};

describe('Scan job enqueue recovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queueService: QueueService;
  let scanQueue: ScanJobQueue;
  let adminToken: string;
  let queuedScanJobId: string | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    queueService = app.get(QueueService);
    scanQueue = app.get<ScanJobQueue>('BullQueue_scan-job');
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
        email: 'scan-recovery@ba-helper.local',
        name: 'Scan Recovery Admin',
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (queuedScanJobId) {
      const queuedJob = await scanQueue.getJob(`scan-${queuedScanJobId}`);
      if (queuedJob) await queuedJob.remove();
      queuedScanJobId = undefined;
    }
  });

  async function createRepository() {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Scan Recovery Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);

    const repositoryResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/scan-recovery' })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    return repository.repositoryId;
  }

  function submitScan(repositoryId: string, payload: ScanCreateInput) {
    return request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
  }

  it('rejects an unsupported branch field instead of queueing a default-ref scan', async () => {
    const repositoryId = await createRepository();
    const requestKey = crypto.randomUUID();

    const response = await submitScan(repositoryId, {
      requestKey,
      requestedRef: 'release/candidate',
    });
    const persistedJob = await prisma.scanJob.findUnique({
      where: { repositoryId_requestKey: { repositoryId, requestKey } },
    });
    if (persistedJob) queuedScanJobId = persistedJob.id;

    expect(response.status).toBe(400);
    expect(persistedJob).toBeNull();
    expect(await prisma.scanJob.count({ where: { repositoryId, requestKey } })).toBe(0);
  });

  it('re-enqueues the same persisted scan when the client retries the same key after Redis failure', async () => {
    const repositoryId = await createRepository();

    const requestKey = crypto.randomUUID();
    const payload = { requestKey, ref: 'main' };
    const enqueue = jest
      .spyOn(queueService, 'enqueueScanJob')
      .mockRejectedValueOnce(new Error('injected transient Redis failure'));

    await submitScan(repositoryId, payload).expect(500);

    const persistedJob = await prisma.scanJob.findUnique({
      where: {
        repositoryId_requestKey: {
          repositoryId,
          requestKey,
        },
      },
    });
    expect(persistedJob).not.toBeNull();
    expect(persistedJob).toMatchObject({
      status: 'QUEUED',
      stage: 'WAITING',
      requestedRef: 'main',
    });
    queuedScanJobId = persistedJob!.id;
    expect(await scanQueue.getJob(`scan-${persistedJob!.id}`)).toBeUndefined();

    const retryResponse = await submitScan(repositoryId, payload).expect(201);

    const retryJob = scanJobResponseSchema.parse(retryResponse.body);
    expect(retryJob.id).toBe(persistedJob!.id);
    const bullJob = await scanQueue.getJob(`scan-${persistedJob!.id}`);
    expect(bullJob).toBeDefined();
    expect(bullJob?.data).toEqual({ jobId: persistedJob!.id });
    expect(enqueue).toHaveBeenCalledTimes(2);
    expect(await prisma.scanJob.count({
      where: { repositoryId, requestKey },
    })).toBe(1);
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `scan:${persistedJob!.id}:queued` },
    })).toBe(1);
  });

  it('re-enqueues a persisted scan on worker startup when the original Redis enqueue failed', async () => {
    const repositoryId = await createRepository();
    const requestKey = crypto.randomUUID();
    const payload = { requestKey, ref: 'main' };
    jest.spyOn(queueService, 'enqueueScanJob')
      .mockRejectedValueOnce(new Error('injected transient Redis failure'));

    await submitScan(repositoryId, payload).expect(500);
    const persistedJob = await prisma.scanJob.findUnique({
      where: { repositoryId_requestKey: { repositoryId, requestKey } },
    });
    expect(persistedJob).not.toBeNull();
    expect(persistedJob).toMatchObject({ status: 'QUEUED', stage: 'WAITING' });
    queuedScanJobId = persistedJob!.id;
    expect(await scanQueue.getJob(`scan-${persistedJob!.id}`)).toBeUndefined();

    await new StaleJobRecoveryService(prisma, queueService).onApplicationBootstrap();

    const bullJob = await scanQueue.getJob(`scan-${persistedJob!.id}`);
    expect(bullJob).toBeDefined();
    expect(bullJob?.data).toEqual({ jobId: persistedJob!.id });
    expect(await prisma.scanJob.count({ where: { repositoryId, requestKey } })).toBe(1);
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `scan:${persistedJob!.id}:queued` },
    })).toBe(1);
  });
});
