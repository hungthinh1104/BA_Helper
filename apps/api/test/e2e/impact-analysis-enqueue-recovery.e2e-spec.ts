import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import {
  impactAnalysisResponseSchema,
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  requirementCreateResponseSchema,
  requirementRevisionCreateResponseSchema,
} from '@ba-helper/contracts';
import { PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { seedScanJobCompletion } from './helpers/seed-fixture';
import { StaleJobRecoveryService } from '../../../worker/src/shared/stale-job-recovery.service';

interface ImpactQueueJob {
  data: unknown;
  remove(): Promise<void>;
}

interface ImpactAnalysisQueue {
  getJob(jobId: string): Promise<ImpactQueueJob | undefined>;
}

describe('Impact analysis enqueue recovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queueService: QueueService;
  let impactQueue: ImpactAnalysisQueue;
  let adminToken: string;
  let queuedAnalysisId: string | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    queueService = app.get(QueueService);
    impactQueue = app.get<ImpactAnalysisQueue>('BullQueue_impact-analysis');
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
    jest.restoreAllMocks();
    if (queuedAnalysisId) {
      const queuedJob = await impactQueue.getJob(`impact-${queuedAnalysisId}`);
      if (queuedJob) await queuedJob.remove();
      queuedAnalysisId = undefined;
    }
  });

  it('replays event and queue delivery for a queued analysis after an event-log failure', async () => {
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

    const requestKey = crypto.randomUUID();
    const payload = {
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
      allowPartialSnapshot: false,
      requestKey,
      domainPackId: 'booking',
    };
    const persistEvent = jest
      .spyOn(prisma.domainEvent, 'createMany')
      .mockRejectedValueOnce(new Error('injected transient event-log persistence failure'));

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revision.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);

    const persistedAnalysis = await prisma.impactAnalysis.findFirst({
      where: { requestKey },
    });
    expect(persistedAnalysis).toMatchObject({ status: 'QUEUED' });
    expect(persistedAnalysis).not.toBeNull();
    queuedAnalysisId = persistedAnalysis!.id;
    expect(await impactQueue.getJob(`impact-${queuedAnalysisId}`)).toBeUndefined();

    await new StaleJobRecoveryService(prisma, queueService).onApplicationBootstrap();
    expect(await impactQueue.getJob(`impact-${queuedAnalysisId}`)).toBeDefined();

    const retryResponse = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revision.revisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    const retryAnalysis = impactAnalysisResponseSchema.parse(retryResponse.body);
    expect(retryAnalysis.id).toBe(queuedAnalysisId);
    const bullJob = await impactQueue.getJob(`impact-${queuedAnalysisId}`);
    expect(bullJob).toBeDefined();
    expect(bullJob?.data).toEqual({ analysisId: queuedAnalysisId });
    expect(persistEvent).toHaveBeenCalledTimes(2);
    expect(await prisma.impactAnalysis.count({ where: { requestKey } })).toBe(1);
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `impact:${queuedAnalysisId}:queued` },
    })).toBe(1);
  });
});
