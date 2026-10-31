import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import { MultiRepoAnalysisRunRepository, PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { multiRepoImpactAnalysisCreateResponseSchema } from '@ba-helper/contracts';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { CreateImpactAnalysisUseCase } from '../../src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase';

interface ImpactQueueJob {
  data: unknown;
  remove(): Promise<void>;
}

interface ImpactAnalysisQueue {
  getJob(jobId: string): Promise<ImpactQueueJob | undefined>;
}

describe('Multi-repo analysis idempotency (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let impactQueue: ImpactAnalysisQueue;
  let queueService: QueueService;
  let adminUserId: string;
  let adminToken: string;
  const createdRunIds: string[] = [];

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    impactQueue = app.get<ImpactAnalysisQueue>('BullQueue_impact-analysis');
    queueService = app.get(QueueService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const admin = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'multi-repo-idempotency@ba-helper.local',
        name: 'Multi Repo Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    for (const runId of createdRunIds.splice(0)) {
      const analyses = await prisma.impactAnalysis.findMany({
        where: { multiRepoRunId: runId },
        select: { id: true },
      });
      for (const analysis of analyses) {
        const job = await impactQueue.getJob(`impact-${analysis.id}`);
        if (job) await job.remove();
      }
    }
  });

  it('returns the same run for concurrent identical requests', async () => {
    const { projectId, requirementId, revisionId, repositoryIds } = await seedAnalysisInputs();
    const requestKey = crypto.randomUUID();
    const runRepository = app.get(MultiRepoAnalysisRunRepository);
    const findRun = runRepository.findByProjectRequestKey.bind(runRepository);
    let arrivals = 0;
    let release!: () => void;
    const bothLookupsFinished = new Promise<void>((resolve) => {
      release = resolve;
    });

    jest.spyOn(runRepository, 'findByProjectRequestKey').mockImplementation(async (projectIdArg, keyArg) => {
      const result = await findRun(projectIdArg, keyArg);
      arrivals += 1;
      if (arrivals === 2) release();
      await bothLookupsFinished;
      return result;
    });

    const send = (allowPartialSnapshot = false) => request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds,
        allowPartialSnapshot,
        requestKey,
      });
    const responses = await Promise.all([send(), send()]);

    const persistedRun = await prisma.multiRepoAnalysisRun.findUnique({
      where: { projectId_requestKey: { projectId, requestKey } },
      select: { id: true },
    });
    if (persistedRun) createdRunIds.push(persistedRun.id);
    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    const results = responses.map(({ body }) => multiRepoImpactAnalysisCreateResponseSchema.parse(body));
    expect(results[1].runId).toBe(results[0].runId);
    expect(results[1].items.map(({ analysisId }) => analysisId).sort()).toEqual(
      results[0].items.map(({ analysisId }) => analysisId).sort(),
    );
    expect(await prisma.multiRepoAnalysisRun.count({ where: { requestKey } })).toBe(1);
    expect(await prisma.impactAnalysis.count({ where: { multiRepoRunId: results[0].runId } })).toBe(2);

    const changedPayloadResponse = await send(true).expect(409);
    expect(changedPayloadResponse.body.code).toBe('REQUEST_KEY_MISMATCH');
  });

  it('does not switch snapshots when a partial fan-out is retried after a target moves', async () => {
    const { projectId, revisionId, repositoryIds } = await seedAnalysisInputs();
    const snapshots = await prisma.repositorySnapshot.findMany({
      where: { repositoryId: { in: repositoryIds } },
      select: { id: true, repositoryId: true },
    });
    const firstSnapshot = snapshots.find((snapshot) => snapshot.repositoryId === repositoryIds[0])!;
    const secondSnapshot = snapshots.find((snapshot) => snapshot.repositoryId === repositoryIds[1])!;
    const requestKey = crypto.randomUUID();
    const payload = {
      requirementRevisionId: revisionId,
      repositoryIds,
      allowPartialSnapshot: false,
      requestKey,
    };
    const createAnalysis = app.get(CreateImpactAnalysisUseCase);
    const execute = createAnalysis.execute.bind(createAnalysis);
    let releaseSecondChild!: () => void;
    const firstChildCreated = new Promise<void>((resolve) => {
      releaseSecondChild = resolve;
    });

    jest.spyOn(createAnalysis, 'execute').mockImplementation(async (params) => {
      if (params.snapshotId === secondSnapshot.id) {
        await firstChildCreated;
        throw new Error('injected child creation failure');
      }
      const child = await execute(params);
      releaseSecondChild();
      return child;
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);
    jest.restoreAllMocks();

    const existingRun = await prisma.multiRepoAnalysisRun.findUnique({
      where: { projectId_requestKey: { projectId, requestKey } },
    });
    expect(existingRun).not.toBeNull();
    createdRunIds.push(existingRun!.id);
    expect(await prisma.impactAnalysis.count({ where: { multiRepoRunId: existingRun!.id } })).toBe(1);

    const secondTarget = await prisma.repositoryTarget.findFirstOrThrow({
      where: { repositoryId: repositoryIds[1] },
    });
    const nextCommitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await prisma.repositoryTarget.update({
      where: { id: secondTarget.id },
      data: { latestObservedCommitSha: nextCommitSha },
    });
    const movedSnapshotId = crypto.randomUUID();
    await prisma.repositorySnapshot.create({
      data: {
        id: movedSnapshotId,
        repositoryId: repositoryIds[1],
        commitSha: nextCommitSha,
        analyzerVersion: 'test-v1',
        coverageStatus: 'READY',
      },
    });

    const retry = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(409);
    expect(retry.body.code).toBe('ANALYSIS_STALE');
    expect(await prisma.impactAnalysis.count({ where: { multiRepoRunId: existingRun!.id } })).toBe(1);
    expect(await prisma.impactAnalysis.findFirst({
      where: { multiRepoRunId: existingRun!.id, snapshotId: movedSnapshotId },
    })).toBeNull();
    expect(firstSnapshot.id).not.toBe(secondSnapshot.id);
  });

  it('re-enqueues the failed child across concurrent same-key multi-repo retries', async () => {
    const { projectId, revisionId, repositoryIds } = await seedAnalysisInputs();
    const requestKey = crypto.randomUUID();
    const payload = {
      requirementRevisionId: revisionId,
      repositoryIds,
      allowPartialSnapshot: false,
      requestKey,
    };
    const enqueue = queueService.enqueueImpactAnalysis.bind(queueService);
    let failFirstEnqueue = true;
    jest.spyOn(queueService, 'enqueueImpactAnalysis').mockImplementation(async (analysisId) => {
      if (failFirstEnqueue) {
        failFirstEnqueue = false;
        throw new Error('injected transient Redis enqueue failure');
      }
      return enqueue(analysisId);
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(500);

    const run = await prisma.multiRepoAnalysisRun.findUniqueOrThrow({
      where: { projectId_requestKey: { projectId, requestKey } },
      select: { id: true },
    });
    createdRunIds.push(run.id);
    await waitForChildQueueStates(run.id);

    const beforeRetry = await prisma.impactAnalysis.findMany({
      where: { multiRepoRunId: run.id },
      select: { id: true, status: true, error: true },
    });
    expect(beforeRetry).toHaveLength(2);
    const failedChild = beforeRetry.find(({ status }) => status === 'FAILED');
    const queuedChild = beforeRetry.find(({ status }) => status === 'QUEUED');
    expect(failedChild?.error).toMatchObject({ code: 'QUEUE_ENQUEUE_FAILED' });
    expect(queuedChild).toBeDefined();
    expect(await impactQueue.getJob(`impact-${failedChild!.id}`)).toBeUndefined();
    expect(await impactQueue.getJob(`impact-${queuedChild!.id}`)).toBeDefined();

    const sendRetry = () => request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload);
    const retries = await Promise.all([sendRetry(), sendRetry()]);
    expect(retries.map(({ status }) => status)).toEqual([201, 201]);
    const responses = retries.map(({ body }) => multiRepoImpactAnalysisCreateResponseSchema.parse(body));

    for (const response of responses) {
      expect(response.runId).toBe(run.id);
      expect(response.items.map(({ analysisId }) => analysisId).sort()).toEqual(
        beforeRetry.map(({ id }) => id).sort(),
      );
      expect(response.items.find(({ analysisId }) => analysisId === failedChild!.id)?.status).toBe('QUEUED');
    }
    expect(await prisma.impactAnalysis.count({ where: { multiRepoRunId: run.id } })).toBe(2);
    expect(await prisma.domainEvent.count({
      where: {
        eventType: 'IMPACT_ANALYSIS_QUEUE_RETRY_REQUESTED',
        idempotencyKey: { startsWith: `impact:${failedChild!.id}:queue-retry:` },
      },
    })).toBe(1);
    const recoveredJob = await impactQueue.getJob(`impact-${failedChild!.id}`);
    expect(recoveredJob?.data).toEqual({ analysisId: failedChild!.id });
    expect(await prisma.impactAnalysis.findUniqueOrThrow({ where: { id: failedChild!.id } }))
      .toMatchObject({ status: 'QUEUED', error: null });
  });

  it('reconstructs a complete legacy run plan from persisted child provenance', async () => {
    const { projectId, requirementId, revisionId, repositoryIds } = await seedAnalysisInputs();
    const requestKey = crypto.randomUUID();
    const run = await prisma.multiRepoAnalysisRun.create({
      data: {
        projectId,
        requirementId,
        requirementRevisionId: revisionId,
        createdByUserId: adminUserId,
        requestKey,
      },
    });
    createdRunIds.push(run.id);

    const originalSnapshots = await prisma.repositorySnapshot.findMany({
      where: { repositoryId: { in: repositoryIds } },
      select: { id: true, repositoryId: true, commitSha: true },
    });
    for (const snapshot of originalSnapshots) {
      const sourceTarget = await prisma.repositoryTarget.findFirstOrThrow({
        where: { repositoryId: snapshot.repositoryId },
      });
      await prisma.impactAnalysis.create({
        data: {
          requirementRevisionId: revisionId,
          requirementId,
          projectId,
          repositoryId: snapshot.repositoryId,
          snapshotId: snapshot.id,
          sourceTargetId: sourceTarget.id,
          multiRepoRunId: run.id,
          requestKey: `legacy-child-${snapshot.repositoryId}`,
          status: 'COMPLETED',
          stage: 'DONE',
          progress: 100,
        },
      });
    }

    const movedSnapshotIds: string[] = [];
    for (const repositoryId of repositoryIds) {
      const sourceTarget = await prisma.repositoryTarget.findFirstOrThrow({
        where: { repositoryId },
      });
      const nextCommitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      await prisma.repositoryTarget.update({
        where: { id: sourceTarget.id },
        data: { latestObservedCommitSha: nextCommitSha },
      });
      const movedSnapshot = await prisma.repositorySnapshot.create({
        data: {
          repositoryId,
          commitSha: nextCommitSha,
          analyzerVersion: 'test-v1',
          coverageStatus: 'READY',
        },
      });
      movedSnapshotIds.push(movedSnapshot.id);
    }

    const retry = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds,
        allowPartialSnapshot: false,
        requestKey,
      })
      .expect(409);

    expect(retry.body.code).toBe('ANALYSIS_STALE');
    expect(await prisma.impactAnalysis.count({ where: { multiRepoRunId: run.id } })).toBe(2);
    expect(await prisma.impactAnalysis.count({ where: { snapshotId: { in: movedSnapshotIds } } })).toBe(0);
    const migratedRun = await prisma.multiRepoAnalysisRun.findUniqueOrThrow({ where: { id: run.id } });
    expect(migratedRun.requestPlan).not.toBeNull();
    expect(migratedRun.requestPayloadHash).not.toBeNull();
  });

  async function seedAnalysisInputs() {
    const projectId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    await prisma.project.create({ data: { id: projectId, name: 'Multi Repo Retry Project' } });
    await grantProjectMembership(prisma, { projectId, userId: adminUserId, role: 'OWNER' });
    await prisma.requirement.create({ data: { id: requirementId, projectId } });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Refund paid bookings across services',
        rawText: 'Allow users to cancel paid bookings and receive a refund across services.',
        normalizedText: 'Allow users to cancel paid bookings and receive a refund across services.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    const repositoryIds: string[] = [];
    for (const name of ['booking-service', 'payment-service']) {
      const repositoryId = crypto.randomUUID();
      const targetId = crypto.randomUUID();
      const commitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
      repositoryIds.push(repositoryId);
      await prisma.repository.create({
        data: {
          id: repositoryId,
          projectId,
          canonicalUrl: `https://github.com/example/${name}`,
        },
      });
      await prisma.repositoryTarget.create({
        data: {
          id: targetId,
          repositoryId,
          targetKey: 'main',
          requestedRef: 'main',
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: commitSha,
          lastObservedAt: new Date(),
        },
      });
      await prisma.repositorySnapshot.create({
        data: {
          id: crypto.randomUUID(),
          repositoryId,
          commitSha,
          analyzerVersion: 'test-v1',
          coverageStatus: 'READY',
        },
      });
    }
    return { projectId, requirementId, revisionId, repositoryIds };
  }

  async function waitForChildQueueStates(runId: string) {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const children = await prisma.impactAnalysis.findMany({
        where: { multiRepoRunId: runId },
        select: { status: true },
      });
      if (children.length === 2 && children.some(({ status }) => status === 'FAILED') &&
        children.some(({ status }) => status === 'QUEUED')) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Multi-repo run ${runId} did not reach one FAILED and one QUEUED child.`);
  }
});
