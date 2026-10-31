import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Worker, type Queue } from 'bullmq';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import { documentJobSchema } from '@ba-helper/contracts';
import { EventLogService, PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { StaleJobRecoveryService } from '../../../worker/src/shared/stale-job-recovery.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { seedCompletedAnalysis } from './helpers/document-job-fixture';

describe('Document job startup recovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queueService: QueueService;
  let documentQueue: Queue;
  let adminUserId: string;
  let adminToken: string;
  let queuedDocumentJobId: string | undefined;
  const additionalQueuedDocumentJobIds: string[] = [];
  let stopLiveRecovery: (() => Promise<void>) | undefined;
  let previousRecoveryInterval: string | undefined;
  let recoveryIntervalWasOverridden = false;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    queueService = app.get(QueueService);
    documentQueue = app.get<Queue>('BullQueue_document-job');
  });

  afterAll(async () => {
    try {
      if (prisma) await resetDatabase(prisma);
    } finally {
      if (prisma) await prisma.$disconnect();
      await app?.close();
    }
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const admin = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'document-recovery@ba-helper.local',
        name: 'Document Recovery Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterEach(async () => {
    await stopLiveRecovery?.();
    stopLiveRecovery = undefined;
    if (recoveryIntervalWasOverridden) {
      if (previousRecoveryInterval === undefined) {
        delete process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
      } else {
        process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = previousRecoveryInterval;
      }
    }
    previousRecoveryInterval = undefined;
    recoveryIntervalWasOverridden = false;
    jest.restoreAllMocks();
    for (const documentJobId of [queuedDocumentJobId, ...additionalQueuedDocumentJobIds].filter(
      (jobId): jobId is string => Boolean(jobId),
    )) {
      const job = await documentQueue.getJob(`doc-${documentJobId}`);
      if (job) await job.remove();
    }
    queuedDocumentJobId = undefined;
    additionalQueuedDocumentJobIds.length = 0;
  });

  it('recovers a committed report job at worker startup before a client retries', async () => {
    const { analysisId, reviewedSnapshotId } = await seedCompletedAnalysis(prisma, adminUserId);
    const requestKey = crypto.randomUUID();
    const enqueue = jest
      .spyOn(queueService, 'enqueueDocumentJob')
      .mockRejectedValueOnce(new Error('injected transient Redis failure'));
    const send = () => request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestKey });

    await send().expect(500);
    const persisted = await prisma.documentJob.findUnique({
      where: {
        snapshotId_documentType: {
          snapshotId: reviewedSnapshotId,
          documentType: 'IMPACT_REPORT',
        },
      },
    });
    expect(persisted).toMatchObject({ analysisId, status: 'QUEUED', attemptCount: 1 });
    expect(persisted).not.toBeNull();
    queuedDocumentJobId = persisted!.id;
    expect(await documentQueue.getJob(`doc-${queuedDocumentJobId}`)).toBeUndefined();

    await startLiveRecovery();
    const recovered = await documentQueue.getJob(`doc-${queuedDocumentJobId}`);
    expect(recovered?.data).toEqual({ documentJobId: queuedDocumentJobId });

    const retryResponse = await send().expect(201);
    expect(documentJobSchema.parse(retryResponse.body)).toMatchObject({
      id: queuedDocumentJobId,
      analysisId,
      snapshotId: reviewedSnapshotId,
      requestKey,
      status: 'QUEUED',
      attemptCount: 1,
    });
    expect(await prisma.documentJob.count({
      where: { snapshotId: reviewedSnapshotId, documentType: 'IMPACT_REPORT' },
    })).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(3);
  });

  it('rejects a report from another analysis and clears both report identity fields on delete', async () => {
    const { analysisId, reviewedSnapshotId } = await seedCompletedAnalysis(prisma, adminUserId);
    const { analysisId: otherAnalysisId } = await seedCompletedAnalysis(prisma, adminUserId);
    const documentJobId = await createQueuedDocumentJob(analysisId);
    queuedDocumentJobId = documentJobId;
    const report = await prisma.generatedDocument.create({
      data: {
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Report for analysis one',
      },
    });
    const foreignReport = await prisma.generatedDocument.create({
      data: {
        impactAnalysisId: otherAnalysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Report for analysis two',
      },
    });

    await prisma.documentJob.update({
      where: { id: documentJobId },
      data: {
        status: 'COMPLETED',
        generatedDocumentId: report.id,
        generatedDocumentAnalysisId: analysisId,
      },
    });
    await expect(prisma.documentJob.update({
      where: { id: documentJobId },
      data: {
        generatedDocumentId: foreignReport.id,
        generatedDocumentAnalysisId: otherAnalysisId,
      },
    })).rejects.toThrow();
    await expect(prisma.documentJob.findUniqueOrThrow({
      where: { id: documentJobId },
      select: { analysisId: true, snapshotId: true, generatedDocumentId: true, generatedDocumentAnalysisId: true },
    })).resolves.toEqual({
      analysisId,
      snapshotId: reviewedSnapshotId,
      generatedDocumentId: report.id,
      generatedDocumentAnalysisId: analysisId,
    });

    await prisma.generatedDocument.delete({ where: { id: report.id } });
    await expect(prisma.documentJob.findUniqueOrThrow({
      where: { id: documentJobId },
      select: { generatedDocumentId: true, generatedDocumentAnalysisId: true },
    })).resolves.toEqual({ generatedDocumentId: null, generatedDocumentAnalysisId: null });
  });

  it('recovers an orphaned report job while the worker remains online', async () => {
    const { analysisId, reviewedSnapshotId } = await seedCompletedAnalysis(prisma, adminUserId);
    previousRecoveryInterval = process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    recoveryIntervalWasOverridden = true;
    process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = '1000';
    await startLiveRecovery();

    jest.spyOn(queueService, 'enqueueDocumentJob')
      .mockRejectedValueOnce(new Error('injected transient Redis failure'));
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestKey: crypto.randomUUID() })
      .expect(500);

    const persisted = await prisma.documentJob.findUnique({
      where: {
        snapshotId_documentType: {
          snapshotId: reviewedSnapshotId,
          documentType: 'IMPACT_REPORT',
        },
      },
    });
    expect(persisted).toMatchObject({ status: 'QUEUED', attemptCount: 1 });
    expect(persisted).not.toBeNull();
    queuedDocumentJobId = persisted!.id;
    expect(await documentQueue.getJob(`doc-${queuedDocumentJobId}`)).toBeUndefined();

    const recovered = await waitForDocumentQueueJob(queuedDocumentJobId);
    expect(recovered?.data).toEqual({ documentJobId: queuedDocumentJobId });
    await expect(prisma.documentJob.findUnique({
      where: { id: queuedDocumentJobId },
      select: { status: true, attemptCount: true },
    })).resolves.toEqual({ status: 'QUEUED', attemptCount: 1 });
  }, 10_000);

  it('does not fail an expired database lease while its BullMQ job is active', async () => {
    let releaseActiveJob!: () => void;
    let signalActiveJob!: () => void;
    const holdActiveJob = new Promise<void>((resolve) => { releaseActiveJob = resolve; });
    const activeJobStarted = new Promise<void>((resolve) => { signalActiveJob = resolve; });
    let activeWorker: Worker | undefined;
    let restartedWorker: INestApplicationContext | undefined;
    const { analysisId: activeAnalysisId } = await seedCompletedAnalysis(prisma, adminUserId);
    const { analysisId: orphanAnalysisId } = await seedCompletedAnalysis(prisma, adminUserId);
    const activeDocumentJobId = await createQueuedDocumentJob(activeAnalysisId);
    queuedDocumentJobId = activeDocumentJobId;
    const orphanDocumentJobId = await createQueuedDocumentJob(orphanAnalysisId);
    additionalQueuedDocumentJobIds.push(orphanDocumentJobId);

    try {
      for (const documentJobId of [activeDocumentJobId, orphanDocumentJobId]) {
        const queued = await documentQueue.getJob(`doc-${documentJobId}`);
        expect(queued).toBeDefined();
        await queued!.remove();
      }
      const expiredAt = new Date(Date.now() - 16 * 60 * 1000);
      await prisma.documentJob.updateMany({
        where: { id: { in: [activeDocumentJobId, orphanDocumentJobId] } },
        data: { status: 'RUNNING', updatedAt: expiredAt, lastStartedAt: expiredAt },
      });
      await queueService.enqueueDocumentJob(activeDocumentJobId);

      activeWorker = new Worker(
        'document-job',
        async (job) => {
          if (job.id === `doc-${activeDocumentJobId}`) {
            signalActiveJob();
            await holdActiveJob;
          }
        },
        { connection: documentQueue.opts.connection, prefix: documentQueue.opts.prefix, concurrency: 1 },
      );
      await activeWorker.waitUntilReady();
      await activeJobStarted;
      await waitForDocumentQueueJobState(documentQueue, `doc-${activeDocumentJobId}`, 'active', 5_000);
      await expect(queueService.hasUnfinishedJob('document-job', activeDocumentJobId)).resolves.toBe(true);

      const { AppModule: WorkerAppModule } = await import('../../../worker/src/app.module');
      restartedWorker = await NestFactory.createApplicationContext(WorkerAppModule, { logger: false });
      const restartedDocumentQueue = restartedWorker.get<Queue>('BullQueue_document-job');
      expect(restartedDocumentQueue.opts.prefix).toBe(documentQueue.opts.prefix);
      expect(await restartedDocumentQueue.getJob(`doc-${activeDocumentJobId}`)).toBeDefined();

      await expect(prisma.documentJob.findUnique({
        where: { id: activeDocumentJobId }, select: { status: true },
      })).resolves.toEqual({ status: 'RUNNING' });
      const orphanedDocumentJob = await prisma.documentJob.findUniqueOrThrow({
        where: { id: orphanDocumentJobId },
        select: { status: true, error: true, failedAt: true },
      });
      expect(orphanedDocumentJob).toMatchObject({
        status: 'FAILED',
        error: { code: 'WORKER_JOB_ORPHANED' },
        failedAt: expect.any(Date),
      });
      await expect(prisma.domainEvent.findUnique({
        where: { idempotencyKey: `document-job:${orphanDocumentJobId}:stale-recovery-failed` },
        select: { eventType: true, payload: true },
      })).resolves.toMatchObject({
        eventType: 'DOCUMENT_JOB_FAILED',
        payload: {
          documentJobId: orphanDocumentJobId,
          previousStatus: 'RUNNING',
          nextStatus: 'FAILED',
          errorCode: 'WORKER_JOB_ORPHANED',
        },
      });
    } finally {
      releaseActiveJob();
      await restartedWorker?.close();
      await activeWorker?.close();
    }
  }, 30_000);

  it('rolls back stale-job failure when its audit event cannot be persisted', async () => {
    const { analysisId } = await seedCompletedAnalysis(prisma, adminUserId);
    const documentJobId = await createQueuedDocumentJob(analysisId);
    queuedDocumentJobId = documentJobId;
    const queued = await documentQueue.getJob(`doc-${documentJobId}`);
    expect(queued).toBeDefined();
    await queued!.remove();

    const expiredAt = new Date(Date.now() - 16 * 60 * 1000);
    await expect(prisma.documentJob.updateMany({
      where: { id: documentJobId },
      data: { status: 'RUNNING', updatedAt: expiredAt, lastStartedAt: expiredAt },
    })).resolves.toMatchObject({ count: 1 });
    const eventLog = app.get(EventLogService);
    const recordEvent = jest.spyOn(eventLog, 'recordEvent')
      .mockRejectedValueOnce(new Error('injected audit-store failure'));
    const recovery = new StaleJobRecoveryService(prisma, queueService, eventLog);

    await expect(recovery.recoverStaleRunningJobs({ leaseMs: 15 * 60 * 1000 }))
      .rejects.toThrow('injected audit-store failure');

    await expect(prisma.documentJob.findUnique({
      where: { id: documentJobId },
      select: { status: true, error: true, failedAt: true },
    })).resolves.toEqual({ status: 'RUNNING', error: null, failedAt: null });
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'DOCUMENT_JOB_FAILED',
      idempotencyKey: `document-job:${documentJobId}:stale-recovery-failed`,
    }), expect.anything());
    expect(await prisma.domainEvent.count({
      where: { idempotencyKey: `document-job:${documentJobId}:stale-recovery-failed` },
    })).toBe(0);
  });

  async function createQueuedDocumentJob(analysisId: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ requestKey: crypto.randomUUID() })
      .expect(201);
    return documentJobSchema.parse(response.body).id;
  }

  async function waitForDocumentQueueJob(documentJobId: string) {
    const deadline = Date.now() + 2_000;
    while (Date.now() < deadline) {
      const job = await documentQueue.getJob(`doc-${documentJobId}`);
      if (job) return job;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return undefined;
  }

  async function waitForDocumentQueueJobState(
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
    throw new Error(`Document queue job ${jobId} did not reach ${expectedState}.`);
  }

  async function startLiveRecovery() {
    const recoveryService = new StaleJobRecoveryService(
      prisma,
      queueService,
      app.get(EventLogService),
    );
    const lifecycle = recoveryService as unknown as {
      onApplicationShutdown?: () => Promise<void>;
    };
    stopLiveRecovery = lifecycle.onApplicationShutdown?.bind(recoveryService);
    await recoveryService.onApplicationBootstrap();
  }

});
