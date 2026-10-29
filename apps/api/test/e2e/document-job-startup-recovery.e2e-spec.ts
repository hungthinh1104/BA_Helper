import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import { documentJobSchema } from '@ba-helper/contracts';
import { PrismaService, QueueService } from '@ba-helper/backend-runtime';
import { StaleJobRecoveryService } from '../../../worker/src/shared/stale-job-recovery.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';

interface DocumentQueueJob {
  data: unknown;
  remove(): Promise<void>;
}

interface DocumentQueue {
  getJob(jobId: string): Promise<DocumentQueueJob | undefined>;
}

describe('Document job startup recovery (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let queueService: QueueService;
  let documentQueue: DocumentQueue;
  let adminUserId: string;
  let adminToken: string;
  let queuedDocumentJobId: string | undefined;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    queueService = app.get(QueueService);
    documentQueue = app.get<DocumentQueue>('BullQueue_document-job');
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
        email: 'document-recovery@ba-helper.local',
        name: 'Document Recovery Admin',
        role: 'ADMIN',
      },
    });
    adminUserId = admin.id;
    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (queuedDocumentJobId) {
      const job = await documentQueue.getJob(`doc-${queuedDocumentJobId}`);
      if (job) await job.remove();
      queuedDocumentJobId = undefined;
    }
  });

  it('recovers a committed report job at worker startup before a client retries', async () => {
    const { analysisId, reviewedSnapshotId } = await seedCompletedAnalysis();
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

    await new StaleJobRecoveryService(prisma, queueService).onApplicationBootstrap();
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

  async function seedCompletedAnalysis() {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const sourceSnapshotId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();
    const reviewedSnapshotId = crypto.randomUUID();
    const commitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

    await prisma.project.create({ data: { id: projectId, name: 'Document Recovery Project' } });
    await grantProjectMembership(prisma, { projectId, userId: adminUserId, role: 'OWNER' });
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/document-recovery',
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
        id: sourceSnapshotId,
        repositoryId,
        commitSha,
        analyzerVersion: 'test-v1',
        coverageStatus: 'READY',
      },
    });
    await prisma.requirement.create({ data: { id: requirementId, projectId } });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Refund paid bookings',
        rawText: 'Allow cancellation and refund for paid bookings.',
        normalizedText: 'Allow cancellation and refund for paid bookings.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        snapshotId: sourceSnapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    await prisma.reviewedReportSnapshot.create({
      data: {
        id: reviewedSnapshotId,
        analysisId,
        markdown: '# Approved report',
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {
          missingEvidence: 0,
          reviewRequired: 0,
          evidenced: 0,
          inferred: 0,
          weakEvidence: 0,
        },
        createdByUserId: adminUserId,
      },
    });

    return { analysisId, reviewedSnapshotId };
  }
});
