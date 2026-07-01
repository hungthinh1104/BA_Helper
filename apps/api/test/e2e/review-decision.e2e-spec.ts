import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { PrismaService } from "@ba-helper/backend-runtime";

describe('Review Decision Endpoints (e2e)', () => {
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
        id: crypto.randomUUID(),
        email: 'admin@ba-helper.local',
        name: 'John Doe',
        role: 'ADMIN',
      },
    });
    adminUserId = user.id;
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  async function setupBasicAnalysis(status: 'COMPLETED' | 'WAITING_FOR_REVIEW' = 'COMPLETED', derivedFromId?: string) {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Proj' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: { id: repositoryId, projectId, canonicalUrl: 'https://github.com/a/b' },
    });

    const targetId = crypto.randomUUID();
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc',
        lastObservedAt: new Date(),
      },
    });

    const snapshotId = crypto.randomUUID();
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc',
        analyzerVersion: '1.0',
        coverageStatus: 'READY',
      },
    });

    const reqId = crypto.randomUUID();
    await prisma.requirement.create({
      data: { id: reqId, projectId },
    });

    const revId = crypto.randomUUID();
    await prisma.requirementRevision.create({
      data: { id: revId, requirementId: reqId, title: 'R1', rawText: 'text', normalizedText: 'text', readinessStatus: 'READY_FOR_ANALYSIS' },
    });

    const analysisId = crypto.randomUUID();
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status,
        stage: 'DONE',
        derivedFromAnalysisId: derivedFromId,
      },
    });

    return { projectId, repositoryId, snapshotId, targetId, analysisId };
  }

  it('POST /api/v1/impact-analyses/:id/review-decisions creates decision and returns custom response structure', async () => {
    const { analysisId } = await setupBasicAnalysis('COMPLETED');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'ACCEPTED',
        note: 'Everything is fine',
      })
      .expect(201);

    expect(res.body.decision).toBeDefined();
    expect(res.body.decision.decision).toBe('ACCEPTED');
    expect(res.body.decision.note).toBe('Everything is fine');
    expect(res.body.decision.reviewedBy).toBe('John Doe');
    expect(res.body.reportRegenerated).toBeDefined();

    // Verify database record
    const dbDecisions = await prisma.analysisReviewDecision.findMany({
      where: { analysisId },
    });
    expect(dbDecisions).toHaveLength(1);
    expect(dbDecisions[0].decision).toBe('ACCEPTED');
    expect(dbDecisions[0].reviewedByUserId).toBe(adminUserId);
  });

  it('rejects POST /review-decisions when analysis status is not COMPLETED', async () => {
    const { analysisId } = await setupBasicAnalysis('WAITING_FOR_REVIEW');

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(400); // Because of INVALID_ANALYSIS_STATUS
  });

  it('rejects POST /review-decisions ACCEPTED when derived diff is not computable, but allows REJECTED', async () => {
    // 1. Setup baseline analysis that is WAITING_FOR_REVIEW (so it's not COMPLETED, making diff not computable)
    const { analysisId: baselineId } = await setupBasicAnalysis('WAITING_FOR_REVIEW');

    // 2. Setup current analysis derived from it
    const { analysisId } = await setupBasicAnalysis('COMPLETED', baselineId);

    // ACCEPTED should fail
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(400);

    // REJECTED should succeed
    const res = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED' })
      .expect(201);

    expect(res.body.decision.decision).toBe('REJECTED');
  });

  it('GET /api/v1/impact-analyses/:id/review-decisions returns decision history sorted newest-first', async () => {
    const { analysisId } = await setupBasicAnalysis('COMPLETED');

    const user1 = await prisma.user.create({
      data: { email: 'user1@test.com', name: 'User One', role: 'REVIEWER' }
    });
    const user2 = await prisma.user.create({
      data: { email: 'user2@test.com', name: 'User Two', role: 'REVIEWER' }
    });

    // Insert 2 decisions manually with different timestamps
    await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'REJECTED',
        note: 'First note',
        reviewedByUserId: user1.id,
        createdAt: new Date(Date.now() - 5000),
      },
    });

    await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'ACCEPTED',
        note: 'Second note',
        reviewedByUserId: user2.id,
        createdAt: new Date(),
      },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].reviewedBy).toBe('User Two'); // Newest first
    expect(res.body.items[1].reviewedBy).toBe('User One');
  });
});
