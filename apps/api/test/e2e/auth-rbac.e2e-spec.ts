import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { artifactListResponseSchema } from '@ba-helper/contracts';

describe('Auth and RBAC (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  let adminToken: string;
  let reviewerToken: string;
  let viewerToken: string;
  let adminUserId: string;
  let reviewerUserId: string;
  let viewerUserId: string;
  let originalEnableDevLogin: string | undefined;
  let originalWorkspaceMode: string | undefined;

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

    originalEnableDevLogin = process.env.ENABLE_DEV_LOGIN;
    originalWorkspaceMode = process.env.WORKSPACE_MODE;

    const [admin, reviewer, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'admin@ba-helper.local',
          name: 'Admin',
          role: 'ADMIN',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'reviewer@ba-helper.local',
          name: 'Reviewer',
          role: 'REVIEWER',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'viewer@ba-helper.local',
          name: 'Viewer',
          role: 'VIEWER',
        },
      }),
    ]);

    adminUserId = admin.id;
    reviewerUserId = reviewer.id;
    viewerUserId = viewer.id;

    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role, name: admin.name });
    reviewerToken = jwtService.sign({ sub: reviewer.id, email: reviewer.email, role: reviewer.role, name: reviewer.name });
    viewerToken = jwtService.sign({ sub: viewer.id, email: viewer.email, role: viewer.role, name: viewer.name });
  });

  afterEach(() => {
    if (originalEnableDevLogin === undefined) {
      delete process.env.ENABLE_DEV_LOGIN;
    } else {
      process.env.ENABLE_DEV_LOGIN = originalEnableDevLogin;
    }

    if (originalWorkspaceMode === undefined) {
      delete process.env.WORKSPACE_MODE;
    } else {
      process.env.WORKSPACE_MODE = originalWorkspaceMode;
    }
  });

  async function seedAnalysisGraph(status: 'WAITING_FOR_REVIEW' | 'COMPLETED' = 'WAITING_FOR_REVIEW') {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const artifactId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();
    const insightId = crypto.randomUUID();
    const linkId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Auth RBAC Project' } });
    await Promise.all([
      grantProjectMembership(prisma, {
        projectId,
        userId: adminUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId,
        userId: reviewerUserId,
        role: 'REVIEWER',
      }),
      grantProjectMembership(prisma, {
        projectId,
        userId: viewerUserId,
        role: 'VIEWER',
      }),
    ]);
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/repo',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        id: artifactId,
        snapshotId,
        artifactKey: 'src/orders/orders.service.ts#OrdersService',
        name: 'OrdersService',
        artifactType: 'SERVICE',
        universalKind: 'DOMAIN_SERVICE',
        filePath: 'src/orders/orders.service.ts',
      },
    });
    await prisma.requirement.create({
      data: {
        id: requirementId,
        projectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Refund paid bookings',
        rawText: 'Allow users to cancel paid bookings and receive refund.',
        normalizedText: 'Allow users to cancel paid bookings and receive refund.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status,
        stage: 'DONE',
      },
    });
    await prisma.baInsight.create({
      data: {
        id: insightId,
        impactAnalysisId: analysisId,
        insightKey: 'unknown-refund-path',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Refund path needs clarification',
        description: 'Unsure whether refund is handled in payment service.',
      },
    });
    await prisma.impactAnalysis.update({
      where: { id: analysisId },
      data: {
        traceabilityLinks: {
          create: {
            id: linkId,
            artifactId,
            linkType: 'AFFECTED',
            linkBasis: 'EVIDENCED',
            reviewStatus: 'NEEDS_REVIEW',
          },
        },
      },
    });

    return {
      projectId,
      snapshotId,
      requirementId,
      revisionId,
      analysisId,
      insightId,
      linkId,
    };
  }

  it('serves dev-login on /api/v1/auth/dev-login and gates it by ENABLE_DEV_LOGIN', async () => {
    process.env.ENABLE_DEV_LOGIN = 'false';

    await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'new-user@ba-helper.local' })
      .expect(403);

    process.env.ENABLE_DEV_LOGIN = 'true';

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ email: 'new-user@ba-helper.local', role: 'REVIEWER' })
      .expect(201);

    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('new-user@ba-helper.local');
    expect(res.body.user.role).toBe('REVIEWER');
  });

  it('allows unauthenticated workspace bootstrap through GET /api/v1/workspace/current', async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .expect(200);

    expect(res.body.projectId).toEqual(expect.any(String));
    expect(res.body.mode).toBe('dev-single-user');
    expect(res.body.membershipRole).toBeNull();
  });

  it('returns project membership role when workspace bootstrap is called with an authenticated actor', async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';

    const res = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    expect(res.body.membershipRole).toBe('REVIEWER');
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId: res.body.projectId,
      },
    });
    expect(member).toMatchObject({
      role: 'REVIEWER',
    });
  });

  it('enforces admin-only project creation', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Viewer Project' })
      .expect(403);

    const res = await request(app.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Project' })
      .expect(201);

    expect(res.body.name).toBe('Admin Project');
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId: res.body.projectId,
      },
    });
    expect(member).toMatchObject({
      userId: expect.any(String),
      role: 'OWNER',
    });
  });

  it('blocks reviewer from admin-only setup, scan, requirement, base-analysis, and finalize operations', async () => {
    const project = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'RBAC Project' },
    });
    await Promise.all([
      grantProjectMembership(prisma, {
        projectId: project.id,
        userId: adminUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId: project.id,
        userId: reviewerUserId,
        role: 'REVIEWER',
      }),
      grantProjectMembership(prisma, {
        projectId: project.id,
        userId: viewerUserId,
        role: 'VIEWER',
      }),
    ]);
    const repository = await prisma.repository.create({
      data: {
        id: crypto.randomUUID(),
        projectId: project.id,
        canonicalUrl: 'https://github.com/example/repo',
      },
    });
    const target = await prisma.repositoryTarget.create({
      data: {
        id: crypto.randomUUID(),
        repositoryId: repository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        id: crypto.randomUUID(),
        repositoryId: repository.id,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    const requirement = await prisma.requirement.create({
      data: { id: crypto.randomUUID(), projectId: project.id },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        id: crypto.randomUUID(),
        requirementId: requirement.id,
        title: 'Refund paid bookings',
        rawText: 'Allow users to cancel paid bookings and receive refund.',
        normalizedText: 'Allow users to cancel paid bookings and receive refund.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const analysis = await prisma.impactAnalysis.create({
      data: {
        id: crypto.randomUUID(),
        requirementRevisionId: revision.id,
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        requestKey: crypto.randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/repositories`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ url: 'https://github.com/example/other' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repository.id}/scan-jobs`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${project.id}/requirements`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ title: 'Reviewer requirement', rawText: 'text' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revision.id}/impact-analyses`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysis.id}/finalize`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(403);
  });

  it('blocks viewers but allows reviewer insight and traceability review', async () => {
    const { insightId, linkId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    await request(app.getHttpServer())
      .post(`/api/v1/insights/${insightId}/review`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/insights/${insightId}/review`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reviewStatus: 'CONFIRMED' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${linkId}/confirm`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/traceability-links/${linkId}/confirm`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(201);
  });

  it('blocks viewers but allows reviewer clarification creation and answer', async () => {
    const { analysisId, insightId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ sourceInsightId: insightId })
      .expect(403);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ sourceInsightId: insightId })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${createRes.body.id}/answer`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ answer: 'Refund is handled by payment service.' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${createRes.body.id}/answer`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ answer: 'Refund is handled by payment service.' })
      .expect(200);
  });

  it('keeps convert-to-revision admin-only and review notes reviewer-capable', async () => {
    const { analysisId, insightId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    const clarification = await prisma.clarificationItem.create({
      data: {
        impactAnalysisId: analysisId,
        sourceInsightId: insightId,
        question: 'How is refund triggered?',
        answer: 'Refund is triggered after cancellation succeeds.',
        status: 'ANSWERED',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/clarifications/${clarification.id}/convert-to-revision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/clarifications/${clarification.id}/convert-to-revision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ insightId, body: 'Viewer note should be forbidden' })
      .expect(403);

    const noteRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ insightId, body: 'Reviewer note is allowed' })
      .expect(200);

    expect(noteRes.body.body).toBe('Reviewer note is allowed');
  });

  it('serves review clarification routes under /api/v1 and enforces reviewer/admin roles', async () => {
    const { analysisId } = await seedAnalysisGraph('WAITING_FOR_REVIEW');
    const adminUser = await prisma.user.findUniqueOrThrow({
      where: { email: 'admin@ba-helper.local' },
    });

    const reviewDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: adminUser.id,
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ reviewDecisionId: reviewDecision.id, question: 'What triggers refund creation?' })
      .expect(403);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ reviewDecisionId: reviewDecision.id, question: 'What triggers refund creation?' })
      .expect(201);

    expect(createRes.body.question).toBe('What triggers refund creation?');
  });

  it('keeps approved report endpoints authenticated and exportable for viewers', async () => {
    const { analysisId } = await seedAnalysisGraph('COMPLETED');

    await prisma.generatedDocument.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Approved report\n\n## Evidence Appendix\n\n- persisted',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .expect(401);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const markdownExport = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(markdownExport.headers['content-type']).toContain('text/markdown');

    const pdfExport = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.pdf`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    expect(pdfExport.headers['content-type']).toContain('application/pdf');
    expect(pdfExport.headers['content-disposition']).toContain('.pdf');
  });

  it('returns 404 for cross-project analysis reads and exports outside membership scope', async () => {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Hidden Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/hidden',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.requirement.create({
      data: {
        id: requirementId,
        projectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Restricted report',
        rawText: 'restricted',
        normalizedText: 'restricted',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    await prisma.generatedDocument.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Restricted report',
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
  });

  it('returns 404 for cross-project review mutation even when global reviewer role matches', async () => {
    const { analysisId } = await seedAnalysisGraph('COMPLETED');
    const outsiderProjectId = crypto.randomUUID();

    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Reviewer Own Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: outsiderProjectId,
      userId: reviewerUserId,
      role: 'REVIEWER',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(201);

    const hiddenProjectId = crypto.randomUUID();
    const hiddenRepositoryId = crypto.randomUUID();
    const hiddenTargetId = crypto.randomUUID();
    const hiddenSnapshotId = crypto.randomUUID();
    const hiddenRequirementId = crypto.randomUUID();
    const hiddenRevisionId = crypto.randomUUID();
    const hiddenAnalysisId = crypto.randomUUID();

    await prisma.project.create({
      data: { id: hiddenProjectId, name: 'Hidden Review Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: hiddenProjectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: {
        id: hiddenRepositoryId,
        projectId: hiddenProjectId,
        canonicalUrl: 'https://github.com/example/hidden-review',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: hiddenTargetId,
        repositoryId: hiddenRepositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'hidden123',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: hiddenSnapshotId,
        repositoryId: hiddenRepositoryId,
        commitSha: 'hidden123',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.requirement.create({
      data: {
        id: hiddenRequirementId,
        projectId: hiddenProjectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: hiddenRevisionId,
        requirementId: hiddenRequirementId,
        title: 'Hidden review',
        rawText: 'Hidden review',
        normalizedText: 'Hidden review',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: hiddenAnalysisId,
        requirementRevisionId: hiddenRevisionId,
        snapshotId: hiddenSnapshotId,
        sourceTargetId: hiddenTargetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${hiddenAnalysisId}/review-decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'REJECTED' })
      .expect(404);
  });

  it('returns 404 for cross-project snapshot artifacts, graph, and evidence reads', async () => {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();
    const analysisId = crypto.randomUUID();
    const artifactId = crypto.randomUUID();
    const evidenceId = crypto.randomUUID();

    await prisma.project.create({ data: { id: projectId, name: 'Hidden Graph Project' } });
    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
    });
    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/hidden-graph',
      },
    });
    await prisma.repositoryTarget.create({
      data: {
        id: targetId,
        repositoryId,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        lastObservedAt: new Date(),
      },
    });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: 'abc1234',
        analyzerVersion: '1.0.0',
        coverageStatus: 'READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        id: artifactId,
        snapshotId,
        artifactKey: 'src/hidden.ts:HiddenService',
        name: 'HiddenService',
        artifactType: 'SERVICE',
        filePath: 'src/hidden.ts',
      },
    });
    await prisma.requirement.create({
      data: {
        id: requirementId,
        projectId,
      },
    });
    await prisma.requirementRevision.create({
      data: {
        id: revisionId,
        requirementId,
        title: 'Hidden evidence',
        rawText: 'Hidden evidence',
        normalizedText: 'Hidden evidence',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revisionId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    await prisma.evidence.create({
      data: {
        id: evidenceId,
        provenanceKey: 'hidden-evidence',
        sourceType: 'CODE',
        excerpt: 'hidden',
        contentHash: 'hidden-hash',
        sourcePath: 'src/hidden.ts',
      },
    });
    await prisma.insightEvidence.create({
      data: {
        insightId: (
          await prisma.baInsight.create({
            data: {
              id: crypto.randomUUID(),
              impactAnalysisId: analysisId,
              insightKey: 'hidden-insight',
              insightType: 'CLAIM',
              certainty: 'EVIDENCED',
              reviewStatus: 'NEEDS_REVIEW',
              title: 'Hidden insight',
              description: 'Hidden desc',
            },
          })
        ).id,
        evidenceId,
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/graph`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/evidence`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(404);
  });

  it('returns universalKind for same-project snapshot artifact reads', async () => {
    const seeded = await seedAnalysisGraph('WAITING_FOR_REVIEW');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${seeded.snapshotId}/artifacts`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    const parsed = artifactListResponseSchema.parse(response.body);
    expect(parsed.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: 'SERVICE',
          universalKind: 'DOMAIN_SERVICE',
        }),
      ]),
    );
  });
});
