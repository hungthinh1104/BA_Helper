import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import * as crypto from 'crypto';
import {
  seedScanJobCompletion,
  seedImpactAnalysisCompletion,
} from './helpers/seed-fixture';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
  scanJobResponseSchema,
  requirementCreateResponseSchema,
  requirementRevisionCreateResponseSchema,
  impactAnalysisResponseSchema,
  approvedImpactReportResponseSchema,
} from '@ba-helper/contracts';

describe('Analysis Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('completes the entire UC01-UC08 lifecycle successfully', async () => {
    // Step 1: POST /api/v1/projects
    const createProjectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .send({ name: 'E2E Project' })
      .expect(201);
    
    const projectDto = projectCreateResponseSchema.parse(createProjectRes.body);
    const projectId = projectDto.projectId;
    expect(projectId).toBeDefined();

    // Step 2: POST /api/v1/projects/:projectId/repositories
    const createRepoRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .send({ url: 'https://github.com/mock/repo' })
      .expect(201);
    
    const repoDto = repositoryCreateResponseSchema.parse(createRepoRes.body);
    const repositoryId = repoDto.repositoryId;
    expect(repositoryId).toBeDefined();

    // Step 3: POST /api/v1/repositories/:repositoryId/scan-jobs
    const scanRequestKey = crypto.randomUUID();
    const createScanJobRes = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .send({
        requestKey: scanRequestKey,
        requestedRef: 'main',
      })
      .expect(201);

    const scanDto = scanJobResponseSchema.parse(createScanJobRes.body);
    const scanJobId = scanDto.id;
    expect(scanJobId).toBeDefined();

    // Step 4: Test helper publishes READY snapshot
    const { snapshot, target } = await seedScanJobCompletion(prisma, scanJobId);

    // Step 5: POST /api/v1/projects/:projectId/requirements
    const createReqRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .send({
        title: 'Refund API',
        rawText: 'Allow users to cancel and refund bookings.',
      })
      .expect(201);

    const reqDto = requirementCreateResponseSchema.parse(createReqRes.body);
    const requirementId = reqDto.requirementId;
    const initialRevisionId = reqDto.revisionId;
    expect(requirementId).toBeDefined();

    // Step 6: POST /api/v1/requirements/:requirementId/revisions (to qualify/READY)
    const createRevRes = await request(app.getHttpServer())
      .post(`/api/v1/requirements/${requirementId}/revisions`)
      .send({
        title: 'Refund API (Final)',
        rawText: 'Allow users to cancel and refund bookings.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      })
      .expect(201);

    const revDto = requirementRevisionCreateResponseSchema.parse(createRevRes.body);
    const readyRevisionId = revDto.revisionId;

    // Step 7: POST /api/v1/impact-analyses
    const analysisRequestKey = crypto.randomUUID();
    const payload = {
      snapshotId: snapshot.id,
      sourceTargetId: target.id,
      allowPartialSnapshot: false,
      requestKey: analysisRequestKey,
    };

    const createAnalysisRes = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${readyRevisionId}/impact-analyses`)
      .send(payload)
      .expect(201);

    const analysisDto = impactAnalysisResponseSchema.parse(createAnalysisRes.body);
    const analysisId = analysisDto.id;
    expect(analysisDto.status).toBe('QUEUED');

    // Step 7.1: Idempotency check - same requestKey and payload reuses analysis
    const retryAnalysisRes = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${readyRevisionId}/impact-analyses`)
      .send(payload)
      .expect(201);
    expect(retryAnalysisRes.body.id).toBe(analysisId); // Must return the same ID

    // Step 7.2: Idempotency check - same requestKey but different payload fails
    const fakeTarget = await prisma.repositoryTarget.create({
      data: {
        repositoryId: repositoryId,
        targetKey: 'another-branch',
        requestedRef: 'another-branch',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'mock-commit-sha', // Match snapshot to pass ANALYSIS_STALE
        lastObservedAt: new Date(),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${readyRevisionId}/impact-analyses`)
      .send({
        ...payload,
        sourceTargetId: fakeTarget.id, // Different payload triggering mismatch
      })
      .expect(409); // REQUEST_KEY_MISMATCH

    // Step 8: Test helper completes analysis to WAITING_FOR_REVIEW
    const { insightId } = await seedImpactAnalysisCompletion(prisma, analysisId);

    // Step 9: POST /api/v1/insights/:insightId/review
    const reviewRes = await request(app.getHttpServer())
      .post(`/api/v1/insights/${insightId}/review`)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(201);

    expect(reviewRes.body.ok).toBe(true);

    // Step 10: POST /api/v1/impact-analyses/:id/finalize
    const finalizeRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .send({ acknowledgeUnreviewed: false });
    
    if (finalizeRes.status !== 201) {
      console.error(finalizeRes.body);
    }
    
    expect(finalizeRes.status).toBe(201);

    expect(finalizeRes.body.status).toBe('COMPLETED');

    // Step 11: GET /api/v1/impact-analyses/:id/approved-report
    const reportRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .expect(200);

    const reportDto = approvedImpactReportResponseSchema.parse(reportRes.body);
    expect(reportDto.status).toBe('APPROVED');
    expect(reportDto.isStale).toBe(false);
  });
});
