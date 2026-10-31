import { spawn } from 'node:child_process';
import * as crypto from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { documentJobSchema } from '@ba-helper/contracts';
import { PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { seedCompletedAnalysis } from './helpers/document-job-fixture';
import { resetDatabase } from './helpers/reset-db';

jest.setTimeout(90_000);

describe('Worker process recovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queueService: QueueService;
  let documentQueue: Queue;
  let adminUserId: string;
  let adminToken: string;
  let queuedDocumentJobId: string | undefined;

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
        email: 'worker-process-recovery@ba-helper.local',
        name: 'Worker Process Recovery Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterEach(async () => {
    if (queuedDocumentJobId) {
      const job = await documentQueue.getJob(`doc-${queuedDocumentJobId}`);
      if (job) await job.remove();
    }
    queuedDocumentJobId = undefined;
  });

  it('reconciles a stale RUNNING document row orphaned after worker startup', async () => {
    const previousLease = process.env.STALE_JOB_RECOVERY_LEASE_MS;
    const previousInterval = process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
    process.env.STALE_JOB_RECOVERY_LEASE_MS = '1000';
    process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = '1000';
    let worker: ReturnType<typeof startWorkerProcess> | undefined;

    try {
      worker = startWorkerProcess();
      await worker.ready;
      const { analysisId, reviewedSnapshotId } = await seedCompletedAnalysis(prisma, adminUserId);
      const staleAt = new Date(Date.now() - 60_000);
      const staleJob = await prisma.documentJob.create({
        data: {
          analysisId,
          snapshotId: reviewedSnapshotId,
          documentType: 'IMPACT_REPORT',
          status: 'RUNNING',
          progress: 50,
          attemptCount: 1,
          createdAt: staleAt,
          updatedAt: staleAt,
        },
      });
      const queueJobId = `doc-${staleJob.id}`;
      expect(await documentQueue.getJob(queueJobId)).toBeUndefined();

      const deadline = Date.now() + 4_000;
      let persistedStatus = 'RUNNING';
      while (Date.now() < deadline && persistedStatus === 'RUNNING') {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const current = await prisma.documentJob.findUnique({
          where: { id: staleJob.id },
          select: { status: true },
        });
        persistedStatus = current?.status ?? 'MISSING';
      }

      expect(persistedStatus).toBe('FAILED');
      await expect(prisma.documentJob.findUniqueOrThrow({
        where: { id: staleJob.id },
        select: { status: true, error: true },
      })).resolves.toEqual({ status: 'FAILED', error: { code: 'WORKER_JOB_ORPHANED' } });
      await expect(prisma.domainEvent.findUnique({
        where: { idempotencyKey: `document-job:${staleJob.id}:stale-recovery-failed` },
        select: { eventType: true },
      })).resolves.toEqual({ eventType: 'DOCUMENT_JOB_FAILED' });
    } finally {
      await stopWorkerProcess(worker);
      if (previousLease === undefined) delete process.env.STALE_JOB_RECOVERY_LEASE_MS;
      else process.env.STALE_JOB_RECOVERY_LEASE_MS = previousLease;
      if (previousInterval === undefined) delete process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS;
      else process.env.QUEUED_JOB_RECOVERY_INTERVAL_MS = previousInterval;
    }
  }, 30_000);

  it('recovers and completes a committed report job after the worker process restarts', async () => {
    const { analysisId, reviewedSnapshotId } = await seedCompletedAnalysis(prisma, adminUserId);
    const requestKey = crypto.randomUUID();
    const firstWorker = startWorkerProcess();
    let restartedWorker: ReturnType<typeof startWorkerProcess> | undefined;
    let enqueueFailure: jest.SpyInstance | undefined;
    const rowLockAcquired = createDeferred();
    const releaseRowLock = createDeferred();
    let rowLockTransaction: Promise<void> | undefined;

    try {
      await firstWorker.ready;
      await stopWorkerProcess(firstWorker);

      enqueueFailure = jest.spyOn(queueService, 'enqueueDocumentJob')
        .mockRejectedValueOnce(new Error('injected failure after database commit'));
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ requestKey })
        .expect(500);
      enqueueFailure.mockRestore();
      enqueueFailure = undefined;

      const persisted = await prisma.documentJob.findUnique({
        where: {
          snapshotId_documentType: {
            snapshotId: reviewedSnapshotId,
            documentType: 'IMPACT_REPORT',
          },
        },
      });
      expect(persisted).toMatchObject({ analysisId, status: 'QUEUED', attemptCount: 1, requestKey });
      expect(persisted).not.toBeNull();
      queuedDocumentJobId = persisted!.id;
      expect(await documentQueue.getJob(`doc-${queuedDocumentJobId}`)).toBeUndefined();

      rowLockTransaction = prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "document_job" WHERE "id" = ${queuedDocumentJobId} FOR UPDATE`;
        rowLockAcquired.resolve();
        await releaseRowLock.promise;
      }, { timeout: 60_000 }).catch((error) => {
        rowLockAcquired.reject(error);
        throw error;
      });
      await rowLockAcquired.promise;

      restartedWorker = startWorkerProcess();
      await restartedWorker.ready;
      const queueJobId = `doc-${queuedDocumentJobId}`;
      try {
        await waitForDocumentQueueJobState(documentQueue, queueJobId, 'active', 30_000);
      } catch (error) {
        const queueJob = await documentQueue.getJob(queueJobId).catch(() => undefined);
        const queueState = queueJob ? await queueJob.getState().catch(() => 'unavailable') : 'missing';
        const counts = await documentQueue.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed')
          .catch(() => ({}));
        const workerLogs = restartedWorker.output()
          .split(/\r?\n/)
          .filter((line) => /WORKER_READY|WORKER_QUEUED_JOB_RECOVERY|DOCUMENT_JOB_(COMPLETED|FAILED)/.test(line))
          .slice(-8)
          .join('|') || 'none';
        throw new Error(
          `Restarted worker did not claim the expected BullMQ job ` +
          `(state=${queueState}, counts=${JSON.stringify(counts)}, ` +
          `prefix=${documentQueue.opts.prefix}, workerExit=${restartedWorker.child.exitCode}, ` +
          `logs=${workerLogs}, cause=${String(error)}).`,
        );
      }
      const activeQueueJob = await documentQueue.getJob(queueJobId);
      expect(activeQueueJob?.data).toEqual({ documentJobId: queuedDocumentJobId });
      await expect(prisma.documentJob.findUnique({
        where: { id: queuedDocumentJobId },
        select: { status: true },
      })).resolves.toEqual({ status: 'QUEUED' });

      releaseRowLock.resolve();
      await rowLockTransaction;
      await expect(waitForDocumentJobStatus(prisma, queuedDocumentJobId, 'COMPLETED', 30_000))
        .resolves.toBe('COMPLETED');

      const completed = await prisma.documentJob.findUniqueOrThrow({
        where: { id: queuedDocumentJobId },
        select: { status: true, analysisId: true, generatedDocumentId: true, generatedDocumentAnalysisId: true },
      });
      expect(completed.status).toBe('COMPLETED');
      expect(completed.generatedDocumentId).toBeTruthy();
      expect(completed.generatedDocumentAnalysisId).toBe(completed.analysisId);
      await expect(prisma.generatedDocument.findUnique({
        where: { id: completed.generatedDocumentId! },
        select: { reviewedReportSnapshotId: true, content: true },
      })).resolves.toMatchObject({
        reviewedReportSnapshotId: reviewedSnapshotId,
        content: expect.any(String),
      });

      const replay = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ requestKey })
        .expect(201);
      expect(documentJobSchema.parse(replay.body)).toMatchObject({
        id: queuedDocumentJobId,
        status: 'COMPLETED',
        requestKey,
        generatedDocumentId: completed.generatedDocumentId,
      });
      expect(await prisma.documentJob.count({
        where: { snapshotId: reviewedSnapshotId, documentType: 'IMPACT_REPORT' },
      })).toBe(1);
    } finally {
      enqueueFailure?.mockRestore();
      releaseRowLock.resolve();
      await rowLockTransaction?.catch(() => undefined);
      await stopWorkerProcess(restartedWorker);
      await stopWorkerProcess(firstWorker);
    }
  });
});

function startWorkerProcess() {
  const child = spawn(process.execPath, [
    '-r', 'ts-node/register',
    '-r', 'tsconfig-paths/register',
    'apps/worker/src/main.ts',
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      TS_NODE_PROJECT: `${process.cwd()}/apps/worker/tsconfig.json`,
      TS_NODE_TRANSPILE_ONLY: 'true',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let readySettled = false;
  const ready = new Promise<void>((resolve, reject) => {
    const diagnostics = () => output
      .split(/\r?\n/)
      .filter((line) => /WORKER_READY|Worker failed to start|PrismaClient(?:KnownRequestError|InitializationError)|P20\d{2}|ECONNREFUSED|ECONNRESET|ETIMEDOUT|Error:/.test(line))
      .slice(-8)
      .join(' | ')
      .replace(/((?:postgres(?:ql)?|redis):\/\/)[^@\s]+@/gi, '$1[redacted]@') || 'no worker diagnostic output';
    const timeout = setTimeout(() => finish(new Error(
      `Worker process did not become ready (exitCode=${child.exitCode}, diagnostics=${diagnostics()}).`,
    )), 60_000);
    const onOutput = (chunk: Buffer) => {
      output = `${output}${chunk.toString()}`.slice(-16_000);
      if (!readySettled && output.includes('WORKER_READY')) finish();
    };
    const onExit = (code: number | null) => finish(new Error(
      `Worker process exited before readiness (code ${code}, diagnostics=${diagnostics()}).`,
    ));
    const onError = (error: Error) => finish(error);
    const finish = (error?: Error) => {
      if (readySettled) return;
      readySettled = true;
      clearTimeout(timeout);
      child.off('exit', onExit);
      child.off('error', onError);
      if (error) reject(error);
      else resolve();
    };
    child.stdout.on('data', onOutput);
    child.stderr.on('data', onOutput);
    child.once('exit', onExit);
    child.once('error', onError);
  });

  return { child, ready, output: () => output };
}

function createDeferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function stopWorkerProcess(worker: ReturnType<typeof startWorkerProcess> | undefined): Promise<void> {
  if (!worker || worker.child.exitCode !== null || worker.child.signalCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      worker.child.kill('SIGKILL');
      reject(new Error('Worker process did not stop after termination was requested.'));
    }, 10_000);
    worker.child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    worker.child.kill();
  });
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

async function waitForDocumentJobStatus(
  prisma: PrismaService,
  documentJobId: string,
  expectedStatus: 'COMPLETED',
  timeoutMs: number,
): Promise<'COMPLETED'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await prisma.documentJob.findUnique({
      where: { id: documentJobId },
      select: { status: true },
    });
    if (job?.status === expectedStatus) return expectedStatus;
    if (job?.status === 'FAILED') throw new Error('Recovered document job entered FAILED state.');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Recovered document job did not reach ${expectedStatus}.`);
}
