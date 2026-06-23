import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
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
import { RunDocumentJobUseCase } from '../../src/modules/document/application/run-document-job.usecase';

describe('Analysis Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let runDocumentJob: RunDocumentJobUseCase;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    runDocumentJob = app.get(RunDocumentJobUseCase);
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
        email: 'admin@ba-helper.local',
        name: 'John Doe',
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  it('completes the entire UC01-UC08 lifecycle successfully', async () => {
    // Step 1: POST /api/v1/projects
    const createProjectRes = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E Project' })
      .expect(201);
    
    const projectDto = projectCreateResponseSchema.parse(createProjectRes.body);
    const projectId = projectDto.projectId;
    expect(projectId).toBeDefined();

    // Step 2: POST /api/v1/projects/:projectId/repositories
    const createRepoRes = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/repo' })
      .expect(201);
    
    const repoDto = repositoryCreateResponseSchema.parse(createRepoRes.body);
    const repositoryId = repoDto.repositoryId;
    expect(repositoryId).toBeDefined();

    // Step 3: POST /api/v1/repositories/:repositoryId/scan-jobs
    const scanRequestKey = crypto.randomUUID();
    const createScanJobRes = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(201);

    const analysisDto = impactAnalysisResponseSchema.parse(createAnalysisRes.body);
    const analysisId = analysisDto.id;
    expect(analysisDto.status).toBe('QUEUED');

    // Step 7.1: Idempotency check - same requestKey and payload reuses analysis
    const retryAnalysisRes = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${readyRevisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ...payload,
        sourceTargetId: fakeTarget.id, // Different payload triggering mismatch
      })
      .expect(409); // REQUEST_KEY_MISMATCH

    // Step 8: Test helper completes analysis to WAITING_FOR_REVIEW
    const { insightId } = await seedImpactAnalysisCompletion(prisma, analysisId);

    // Step 9: POST /api/v1/insights/:insightId/review
    const reviewRes = await request(app.getHttpServer())
      .post(`/api/v1/insights/${insightId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(201);

    expect(reviewRes.body.ok).toBe(true);

    // Step 10: POST /api/v1/impact-analyses/:id/finalize
    const finalizeRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ acknowledgeUnreviewed: true });
    
    if (finalizeRes.status !== 201) {
      console.error(finalizeRes.body);
    }
    
    expect(finalizeRes.status).toBe(201);

    expect(finalizeRes.body.status).toBe('COMPLETED');

    // Step 10.5: Run async document generation worker
    const documentJob = await prisma.documentJob.findFirst({
      where: { analysisId, documentType: 'IMPACT_REPORT' },
    });
    expect(documentJob).toBeDefined();
    await runDocumentJob.execute({ documentJobId: documentJob!.id });

    // Step 11: GET /api/v1/impact-analyses/:id/approved-report
    const exportRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const pdfExportRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const reportRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const reportDto = approvedImpactReportResponseSchema.parse(reportRes.body);
    expect(reportDto.status).toBe('APPROVED');
    expect(reportDto.isStale).toBe(false);
    expect(exportRes.headers['content-disposition']).toContain('.md');
    expect(pdfExportRes.headers['content-disposition']).toContain('.pdf');
    expect(pdfExportRes.headers['content-type']).toContain('application/pdf');
    expect(reportDto.provenance.generatedDocumentId).toEqual(expect.any(String));
  });
});
