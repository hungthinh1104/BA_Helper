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

  it('re-enqueues the same persisted scan after a transient Redis enqueue failure', async () => {
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

    const requestKey = crypto.randomUUID();
    const payload = { requestKey, requestedRef: 'main' };
    const enqueue = jest
      .spyOn(queueService, 'enqueueScanJob')
      .mockRejectedValueOnce(new Error('injected transient Redis failure'));

    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);

    const persistedJob = await prisma.scanJob.findUnique({
      where: {
        repositoryId_requestKey: {
          repositoryId: repository.repositoryId,
          requestKey,
        },
      },
    });
    expect(persistedJob).toMatchObject({ status: 'QUEUED', stage: 'WAITING' });
    expect(persistedJob).not.toBeNull();
    queuedScanJobId = persistedJob!.id;

    await new StaleJobRecoveryService(prisma, queueService).onApplicationBootstrap();
    expect(await scanQueue.getJob(`scan-${queuedScanJobId}`)).toBeDefined();

    const retryResponse = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    const retryJob = scanJobResponseSchema.parse(retryResponse.body);
    expect(retryJob.id).toBe(persistedJob!.id);
    const bullJob = await scanQueue.getJob(`scan-${persistedJob!.id}`);
    expect(bullJob).toBeDefined();
    expect(bullJob?.data).toEqual({ jobId: persistedJob!.id });
    expect(enqueue).toHaveBeenCalledTimes(3);
    expect(await prisma.scanJob.count({
      where: { repositoryId: repository.repositoryId, requestKey },
    })).toBe(1);
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `scan:${persistedJob!.id}:queued` },
    })).toBe(1);
  });
});
