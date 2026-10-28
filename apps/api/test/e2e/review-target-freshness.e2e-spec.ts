import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import type { ReviewNoteRepository, TraceabilityRepository } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { createReviewAuditFixture } from './helpers/review-audit-fixture';
import { SaveReviewNoteUseCase } from '../../src/modules/impact-analysis/application/review/save-review-note.usecase';
import { SubmitReviewItemDecisionUseCase } from '../../src/modules/review/application/submit-review-item-decision.usecase';
import { ReviewTraceabilityUseCase } from '../../src/modules/traceability/application/review-traceability.usecase';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('Review target freshness concurrency (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'review-freshness@ba-helper.local',
        name: 'Review Freshness',
        role: 'ADMIN',
      },
    });
    adminUserId = user.id;
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  it('rejects a review note when the source target changes after its status read', async () => {
    const { analysisId, traceabilityLinkId, targetId } = await createReviewAuditFixture(prisma, adminUserId);
    const saveNote = app.get(SaveReviewNoteUseCase);
    const reviewNotes = (saveNote as unknown as { reviewNoteRepo: ReviewNoteRepository }).reviewNoteRepo;
    const originalUpsert = reviewNotes.upsert.bind(reviewNotes);
    const reachedPersistence = createDeferred();
    const releaseWrite = createDeferred();
    const spy = jest.spyOn(reviewNotes, 'upsert').mockImplementation(async (data, transaction) => {
      reachedPersistence.resolve();
      await releaseWrite.promise;
      return originalUpsert(data, transaction);
    });

    try {
      const responsePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ traceabilityLinkId, body: 'Should not be attached to stale source.' })
        .then((response) => response);

      await reachedPersistence.promise;
      await prisma.repositoryTarget.update({
        where: { id: targetId },
        data: { latestObservedCommitSha: 'newer-review-audit-sha' },
      });
      releaseWrite.resolve();
      const response = await responsePromise;

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('ANALYSIS_STALE');
      expect(await prisma.reviewNote.findFirst({
        where: { impactAnalysisId: analysisId, traceabilityLinkId },
      })).toBeNull();
    } finally {
      releaseWrite.resolve();
      spy.mockRestore();
    }
  }, 30_000);

  it('rejects a traceability decision when the source target changes after its status read', async () => {
    const { analysisId, traceabilityLinkId, targetId } = await createReviewAuditFixture(prisma, adminUserId);
    const submitDecision = app.get(SubmitReviewItemDecisionUseCase);
    const traceability = (submitDecision as unknown as {
      traceabilityRepo: TraceabilityRepository;
    }).traceabilityRepo;
    const originalUpsert = traceability.upsertReviewDecision.bind(traceability);
    const reachedPersistence = createDeferred();
    const releaseWrite = createDeferred();
    const spy = jest.spyOn(traceability, 'upsertReviewDecision').mockImplementation(async (params, transaction) => {
      reachedPersistence.resolve();
      await releaseWrite.promise;
      return originalUpsert(params, transaction);
    });

    try {
      const responsePromise = request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${traceabilityLinkId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'impact', action: 'accept', rationale: 'Should not review stale source.' })
        .then((response) => response);

      await reachedPersistence.promise;
      await prisma.repositoryTarget.update({
        where: { id: targetId },
        data: { latestObservedCommitSha: 'newer-review-audit-sha' },
      });
      releaseWrite.resolve();
      const response = await responsePromise;

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('ANALYSIS_STALE');
      expect(await prisma.traceabilityLink.findUnique({
        where: { id: traceabilityLinkId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'NEEDS_REVIEW' });
      expect(await prisma.traceabilityReviewDecision.findUnique({
        where: { traceabilityLinkId },
      })).toBeNull();
    } finally {
      releaseWrite.resolve();
      spy.mockRestore();
    }
  }, 30_000);

  it('keeps pinned-commit review valid when a later target observation changes', async () => {
    const { analysisId, traceabilityLinkId, targetId } = await createReviewAuditFixture(prisma, adminUserId);
    await prisma.repositoryTarget.update({
      where: { id: targetId },
      data: { resolvedRefType: 'COMMIT' },
    });
    const reviewTraceability = app.get(ReviewTraceabilityUseCase);
    const traceability = (reviewTraceability as unknown as {
      repository: TraceabilityRepository;
    }).repository;
    const originalUpdate = traceability.updateReviewStatusIfCurrent.bind(traceability);
    const reachedPersistence = createDeferred();
    const releaseWrite = createDeferred();
    const spy = jest.spyOn(traceability, 'updateReviewStatusIfCurrent').mockImplementation(async (params, transaction) => {
      reachedPersistence.resolve();
      await releaseWrite.promise;
      return originalUpdate(params, transaction);
    });

    try {
      const responsePromise = request(app.getHttpServer())
        .post(`/api/v1/traceability-links/${traceabilityLinkId}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewStatus: 'CONFIRMED' })
        .then((response) => response);

      await reachedPersistence.promise;
      await prisma.repositoryTarget.update({
        where: { id: targetId },
        data: { latestObservedCommitSha: 'later-observed-commit' },
      });
      releaseWrite.resolve();
      const response = await responsePromise;

      expect(response.status).toBe(201);
      expect(await prisma.traceabilityLink.findUnique({
        where: { id: traceabilityLinkId },
        select: { reviewStatus: true },
      })).toEqual({ reviewStatus: 'CONFIRMED' });
      expect(await prisma.impactAnalysis.findUnique({
        where: { id: analysisId },
        select: { snapshot: { select: { commitSha: true } } },
      })).toEqual({ snapshot: { commitSha: 'review-audit-sha' } });
    } finally {
      releaseWrite.resolve();
      spy.mockRestore();
    }
  }, 30_000);
});
