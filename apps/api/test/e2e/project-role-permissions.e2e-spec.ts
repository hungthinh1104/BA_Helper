import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import {
  documentJobSchema,
  impactAnalysisResponseSchema,
  testTraceEvidenceResponseSchema,
} from '@ba-helper/contracts';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';

interface TestQueueJob {
  data: unknown;
  remove(): Promise<void>;
}

interface TestBullQueue {
  getJob(jobId: string): Promise<TestQueueJob | undefined>;
}

describe('Project role permissions (PostgreSQL API e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let scanQueue: TestBullQueue;
  let documentQueue: TestBullQueue;
  let impactQueue: TestBullQueue;
  const queuedScanJobIds: string[] = [];
  let queuedDocumentJobId: string | undefined;
  const queuedAnalysisIds: string[] = [];
  let projectId: string;
  let repositoryId: string;
  let ownerToken: string;
  let maintainerToken: string;
  let analystToken: string;
  let reviewerToken: string;
  let viewerToken: string;
  let outsiderToken: string;
  let ownerUserId: string;
  let reviewerUserId: string;
  let analysisId: string;
  let completedAnalysisId: string;
  let requirementRevisionId: string;
  let requirementId: string;
  let snapshotId: string;
  let sourceTargetId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    scanQueue = app.get<TestBullQueue>('BullQueue_scan-job');
    documentQueue = app.get<TestBullQueue>('BullQueue_document-job');
    impactQueue = app.get<TestBullQueue>('BullQueue_impact-analysis');
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    for (const scanJobId of queuedScanJobIds.splice(0)) {
      const job = await scanQueue.getJob(`scan-${scanJobId}`);
      if (job) await job.remove();
    }
    if (queuedDocumentJobId) {
      const job = await documentQueue.getJob(`doc-${queuedDocumentJobId}`);
      if (job) await job.remove();
      queuedDocumentJobId = undefined;
    }
    for (const analysisId of queuedAnalysisIds.splice(0)) {
      const job = await impactQueue.getJob(`impact-${analysisId}`);
      if (job) await job.remove();
    }
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const [owner, maintainer, analyst, reviewer, viewer, outsider] = await Promise.all([
      prisma.user.create({ data: { email: 'role-owner@test.local', role: 'ADMIN' } }),
      prisma.user.create({ data: { email: 'role-maintainer@test.local', role: 'VIEWER' } }),
      prisma.user.create({ data: { email: 'role-analyst@test.local', role: 'VIEWER' } }),
      prisma.user.create({ data: { email: 'role-reviewer@test.local', role: 'VIEWER' } }),
      prisma.user.create({ data: { email: 'role-viewer@test.local', role: 'VIEWER' } }),
      prisma.user.create({ data: { email: 'role-outsider@test.local', role: 'ADMIN' } }),
    ]);
    ownerUserId = owner.id;
    reviewerUserId = reviewer.id;
    projectId = crypto.randomUUID();
    const outsiderProjectId = crypto.randomUUID();
    await Promise.all([
      prisma.project.create({ data: { id: projectId, name: 'Protected role project' } }),
      prisma.project.create({ data: { id: outsiderProjectId, name: 'Outsider project' } }),
    ]);
    await Promise.all([
      grantProjectMembership(prisma, { projectId, userId: owner.id, role: 'OWNER' }),
      grantProjectMembership(prisma, { projectId, userId: maintainer.id, role: 'MAINTAINER' }),
      grantProjectMembership(prisma, { projectId, userId: analyst.id, role: 'ANALYST' }),
      grantProjectMembership(prisma, { projectId, userId: reviewer.id, role: 'REVIEWER' }),
      grantProjectMembership(prisma, { projectId, userId: viewer.id, role: 'VIEWER' }),
      grantProjectMembership(prisma, { projectId: outsiderProjectId, userId: outsider.id, role: 'OWNER' }),
    ]);
    maintainerToken = jwtService.sign({ sub: maintainer.id, email: maintainer.email, role: maintainer.role });
    ownerToken = jwtService.sign({ sub: owner.id, email: owner.email, role: owner.role });
    analystToken = jwtService.sign({ sub: analyst.id, email: analyst.email, role: analyst.role });
    reviewerToken = jwtService.sign({ sub: reviewer.id, email: reviewer.email, role: reviewer.role });
    viewerToken = jwtService.sign({ sub: viewer.id, email: viewer.email, role: viewer.role });
    outsiderToken = jwtService.sign({ sub: outsider.id, email: outsider.email, role: outsider.role });

    const repository = await prisma.repository.create({
      data: { id: crypto.randomUUID(), projectId, canonicalUrl: 'https://github.com/ba-helper/role-matrix' },
    });
    repositoryId = repository.id;
    const target = await prisma.repositoryTarget.create({
      data: {
        id: crypto.randomUUID(), repositoryId, targetKey: 'main', requestedRef: 'main',
        resolvedRefType: 'BRANCH', latestObservedCommitSha: 'abc123', lastObservedAt: new Date(),
      },
    });
    sourceTargetId = target.id;
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        id: crypto.randomUUID(), repositoryId, commitSha: 'abc123',
        analyzerVersion: '1.0.0', coverageStatus: 'READY',
      },
    });
    snapshotId = snapshot.id;
    const requirement = await prisma.requirement.create({
      data: { id: crypto.randomUUID(), projectId },
    });
    requirementId = requirement.id;
    const revision = await prisma.requirementRevision.create({
      data: {
        id: crypto.randomUUID(), requirementId: requirement.id, title: 'Role matrix',
        rawText: 'Test project permission boundaries.', normalizedText: 'Test project permission boundaries.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    requirementRevisionId = revision.id;
    const analysis = await prisma.impactAnalysis.create({
      data: {
        id: crypto.randomUUID(), requirementRevisionId: revision.id, requirementId, projectId, repositoryId, snapshotId: snapshot.id,
        sourceTargetId: target.id, requestKey: crypto.randomUUID(), status: 'WAITING_FOR_REVIEW', stage: 'DONE',
      },
    });
    analysisId = analysis.id;
    const completedAnalysis = await prisma.impactAnalysis.create({
      data: {
        id: crypto.randomUUID(), requirementRevisionId: revision.id, requirementId, projectId, repositoryId, snapshotId: snapshot.id,
        sourceTargetId: target.id, requestKey: crypto.randomUUID(), status: 'COMPLETED', stage: 'DONE',
      },
    });
    completedAnalysisId = completedAnalysis.id;
  });

  it('enforces maintainer and analyst capabilities and hides cross-project resources', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${requirementRevisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${maintainerToken}`)
      .send({
        snapshotId, sourceTargetId, allowPartialSnapshot: false, requestKey: crypto.randomUUID(),
      })
      .expect(403);
    expect(await prisma.impactAnalysis.count({ where: { requirementRevisionId } })).toBe(2);

    const connectedRepository = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${maintainerToken}`)
      .send({ url: 'https://github.com/ba-helper/maintainer-connected' })
      .expect(201);
    expect(await prisma.repository.findUnique({ where: { id: connectedRepository.body.repositoryId } }))
      .toMatchObject({ projectId });

    const ownerRepository = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ url: 'https://github.com/ba-helper/owner-connected' })
      .expect(201);
    expect(await prisma.repository.findUnique({ where: { id: ownerRepository.body.repositoryId } }))
      .toMatchObject({ projectId });

    const requirementCountBefore = await prisma.requirement.count({ where: { projectId } });
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${maintainerToken}`)
      .send({ requestKey: crypto.randomUUID(), title: 'Denied', rawText: 'Must not persist.' })
      .expect(403);
    expect(await prisma.requirement.count({ where: { projectId } })).toBe(requirementCountBefore);

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ requestKey: crypto.randomUUID(), title: 'Denied viewer', rawText: 'Must not persist.' })
      .expect(403);
    expect(await prisma.requirement.count({ where: { projectId } })).toBe(requirementCountBefore);

    const repositoryCountBefore = await prisma.repository.count({ where: { projectId } });
    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ url: 'https://github.com/ba-helper/analyst-must-not-connect' })
      .expect(403);
    expect(await prisma.repository.count({ where: { projectId } })).toBe(repositoryCountBefore);

    const scanCountBefore = await prisma.scanJob.count({ where: { repositoryId } });
    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(403);
    expect(await prisma.scanJob.count({ where: { repositoryId } })).toBe(scanCountBefore);

    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(403);
    expect(await prisma.scanJob.count({ where: { repositoryId } })).toBe(scanCountBefore);

    const decisionCountBefore = await prisma.analysisReviewDecision.count({ where: { analysisId } });
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-decisions`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ decision: 'REJECTED', note: 'Must not persist.' })
      .expect(403);
    expect(await prisma.analysisReviewDecision.count({ where: { analysisId } })).toBe(decisionCountBefore);

    const createdAnalysis = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${requirementRevisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        snapshotId, sourceTargetId, allowPartialSnapshot: false, requestKey: crypto.randomUUID(),
      })
      .expect(201);
    queuedAnalysisIds.push(createdAnalysis.body.id);
    expect(await prisma.impactAnalysis.findUnique({ where: { id: createdAnalysis.body.id } }))
      .toMatchObject({ requirementRevisionId, snapshotId, sourceTargetId });

    const createdRequirement = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        requestKey: crypto.randomUUID(), title: 'Allowed analyst requirement',
        rawText: 'Analyst role can create requirements.', submitForReadinessCheck: false,
      })
      .expect(201);
    expect(await prisma.requirement.findUnique({ where: { id: createdRequirement.body.requirementId } }))
      .toMatchObject({ projectId });

    const ownerRequirement = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        requestKey: crypto.randomUUID(), title: 'Allowed owner requirement',
        rawText: 'Owner role can create requirements.', submitForReadinessCheck: false,
      })
      .expect(201);
    expect(await prisma.requirement.findUnique({
      where: { id: ownerRequirement.body.requirementId },
    })).toMatchObject({ projectId });

    const ownerAnalysis = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${requirementRevisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        snapshotId, sourceTargetId, allowPartialSnapshot: false, requestKey: crypto.randomUUID(),
      })
      .expect(201);
    queuedAnalysisIds.push(ownerAnalysis.body.id);
    expect(await prisma.impactAnalysis.findUnique({ where: { id: ownerAnalysis.body.id } }))
      .toMatchObject({ requirementRevisionId, snapshotId, sourceTargetId, status: 'QUEUED' });

    const analysisCountBeforeViewerAttempt = await prisma.impactAnalysis.count({
      where: { requirementRevisionId },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${requirementRevisionId}/impact-analyses`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        snapshotId, sourceTargetId, allowPartialSnapshot: false, requestKey: crypto.randomUUID(),
      })
      .expect(403);
    expect(await prisma.impactAnalysis.count({ where: { requirementRevisionId } }))
      .toBe(analysisCountBeforeViewerAttempt);

    const maintainerScan = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${maintainerToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(201);
    queuedScanJobIds.push(maintainerScan.body.id);
    expect(await prisma.scanJob.count({ where: { repositoryId, requestedRef: 'main' } })).toBe(1);

    const ownerScan = await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'main' })
      .expect(201);
    queuedScanJobIds.push(ownerScan.body.id);
    expect(await prisma.scanJob.findUnique({ where: { id: ownerScan.body.id } }))
      .toMatchObject({ repositoryId, requestedRef: 'main', status: 'QUEUED' });
    expect(await scanQueue.getJob(`scan-${ownerScan.body.id}`))
      .toMatchObject({ data: { jobId: ownerScan.body.id } });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/repositories/${repositoryId}/scan-jobs`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ requestKey: crypto.randomUUID(), ref: 'unauthorized' })
      .expect(404);
    expect(await prisma.scanJob.count({ where: { repositoryId } })).toBe(2);

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${maintainerToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(403);
    expect(await prisma.impactAnalysis.findUnique({ where: { id: analysisId } }))
      .toMatchObject({ status: 'WAITING_FOR_REVIEW' });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(403);
    expect(await prisma.impactAnalysis.findUnique({ where: { id: analysisId } }))
      .toMatchObject({ status: 'WAITING_FOR_REVIEW' });

    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(201);
    expect(await prisma.impactAnalysis.findUnique({ where: { id: analysisId } }))
      .toMatchObject({ status: 'COMPLETED' });

    const ownerFinalizableAnalysis = await prisma.impactAnalysis.create({
      data: {
        id: crypto.randomUUID(),
        requirementRevisionId,
        requirementId,
        projectId,
        repositoryId,
        snapshotId,
        sourceTargetId,
        requestKey: crypto.randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
      },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${ownerFinalizableAnalysis.id}/finalize`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(201);
    expect(await prisma.impactAnalysis.findUnique({ where: { id: ownerFinalizableAnalysis.id } }))
      .toMatchObject({ status: 'COMPLETED' });
  });

  it('allows reviewer decisions and keeps viewer access read-only', async () => {
    const reviewResult = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${completedAnalysisId}/review-decisions`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ decision: 'ACCEPTED', note: 'Reviewer role check.' })
      .expect(201);
    expect(reviewResult.body.decision).toMatchObject({
      analysisId: completedAnalysisId,
      decision: 'ACCEPTED',
    });
    const persistedReview = await prisma.analysisReviewDecision.findFirst({
      where: { analysisId: completedAnalysisId },
    });
    expect(persistedReview).toMatchObject({
      analysisId: completedAnalysisId,
      decision: 'ACCEPTED',
      reviewedByUserId: reviewerUserId,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const decisionCountBefore = await prisma.analysisReviewDecision.count({
      where: { analysisId: completedAnalysisId },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${completedAnalysisId}/review-decisions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ decision: 'REJECTED', note: 'Must not persist.' })
      .expect(403);
    expect(await prisma.analysisReviewDecision.count({
      where: { analysisId: completedAnalysisId },
    })).toBe(decisionCountBefore);

    const repositoryCountBefore = await prisma.repository.count({ where: { projectId } });
    const deniedRepositoryConnect = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/repositories`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ url: 'https://github.com/ba-helper/viewer-must-not-connect' })
      .expect(403);
    expect(deniedRepositoryConnect.body).toMatchObject({
      statusCode: 403,
      error: 'Forbidden',
    });
    expect(deniedRepositoryConnect.body.message).toEqual(expect.any(String));
    expect(await prisma.repository.count({ where: { projectId } })).toBe(repositoryCountBefore);
  });

  it('allows every project role to export an approved report', async () => {
    await prisma.generatedDocument.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: completedAnalysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Approved report\n\n## Evidence Appendix\n\n- persisted evidence',
      },
    });

    for (const token of [
      ownerToken,
      maintainerToken,
      analystToken,
      reviewerToken,
      viewerToken,
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${completedAnalysisId}/approved-report/export.md`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toContain('.md');
    }
  });

  it('allows a viewer to enqueue a document job from an approved report snapshot', async () => {
    const reviewedSnapshot = await prisma.reviewedReportSnapshot.create({
      data: {
        id: crypto.randomUUID(),
        analysisId: completedAnalysisId,
        markdown: '# Approved report snapshot',
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {
          missingEvidence: 0,
          reviewRequired: 0,
          evidenced: 0,
          inferred: 0,
          weakEvidence: 0,
        },
        createdByUserId: reviewerUserId,
      },
    });
    const requestKey = crypto.randomUUID();

    const response = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${completedAnalysisId}/document-jobs`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ requestKey })
      .expect(201);
    queuedDocumentJobId = response.body.id;

    expect(documentJobSchema.parse(response.body)).toMatchObject({
      id: queuedDocumentJobId,
      analysisId: completedAnalysisId,
      snapshotId: reviewedSnapshot.id,
      requestKey,
      status: 'QUEUED',
    });
    expect(await prisma.documentJob.findUnique({ where: { id: queuedDocumentJobId } }))
      .toMatchObject({ analysisId: completedAnalysisId, status: 'QUEUED', requestKey });
    expect(await documentQueue.getJob(`doc-${queuedDocumentJobId}`)).toMatchObject({
      data: { documentJobId: queuedDocumentJobId },
    });
  });

  it('allows reviewers to decide review items and denies analyst and viewer writes', async () => {
    const artifact = await prisma.codeArtifact.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId,
        artifactKey: 'src/refund.service.ts#RefundService',
        name: 'RefundService',
        artifactType: 'SERVICE',
        filePath: 'src/refund.service.ts',
      },
    });
    const link = await prisma.traceabilityLink.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        snapshotId,
        artifactId: artifact.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
      },
    });

    for (const token of [maintainerToken, analystToken, viewerToken]) {
      await request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${link.id}/decision`)
        .set('Authorization', `Bearer ${token}`)
        .send({ target: 'impact', action: 'accept', rationale: 'Must be denied.', requestKey: crypto.randomUUID() })
        .expect(403);
    }
    expect(await prisma.traceabilityLink.findUnique({ where: { id: link.id } }))
      .toMatchObject({ reviewStatus: 'NEEDS_REVIEW' });
    expect(await prisma.traceabilityReviewDecision.findUnique({
      where: { traceabilityLinkId: link.id },
    })).toBeNull();

    const accepted = await request(app.getHttpServer())
      .put(`/api/v1/impact-analyses/${analysisId}/review-items/${link.id}/decision`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ target: 'impact', action: 'accept', rationale: 'Evidence reviewed.', requestKey: crypto.randomUUID() })
      .expect(200);
    expect(accepted.body).toMatchObject({
      itemId: link.id,
      currentDecision: 'accepted',
      reviewNote: 'Evidence reviewed.',
    });
    expect(await prisma.traceabilityReviewDecision.findUnique({
      where: { traceabilityLinkId: link.id },
    })).toMatchObject({
      decision: 'ACCEPTED',
      reviewedByUserId: reviewerUserId,
      note: 'Evidence reviewed.',
    });

    const ownerArtifact = await prisma.codeArtifact.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId,
        artifactKey: 'src/refund-processor.ts#RefundProcessor',
        name: 'RefundProcessor',
        artifactType: 'SERVICE',
        filePath: 'src/refund-processor.ts',
      },
    });
    const ownerLink = await prisma.traceabilityLink.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        snapshotId,
        artifactId: ownerArtifact.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
      },
    });
    await request(app.getHttpServer())
      .put(`/api/v1/impact-analyses/${analysisId}/review-items/${ownerLink.id}/decision`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        target: 'impact', action: 'accept', rationale: 'Owner review permission.',
        requestKey: crypto.randomUUID(),
      })
      .expect(200);
    expect(await prisma.traceabilityReviewDecision.findUnique({
      where: { traceabilityLinkId: ownerLink.id },
    })).toMatchObject({ decision: 'ACCEPTED', reviewedByUserId: ownerUserId });
  });

  it('limits project member management to owners without creating denied users', async () => {
    const email = 'role-managed-member@test.local';
    const membersPath = `/api/v1/projects/${projectId}/members`;
    const memberCountBefore = await prisma.projectMember.count({ where: { projectId } });

    for (const token of [maintainerToken, analystToken, reviewerToken, viewerToken]) {
      await request(app.getHttpServer())
        .post(membersPath)
        .set('Authorization', `Bearer ${token}`)
        .send({
          email,
          initialPassword: 'role-matrix-initial-password',
          role: 'ANALYST',
        })
        .expect(403);
    }

    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(await prisma.projectMember.count({ where: { projectId } })).toBe(memberCountBefore);

    const created = await request(app.getHttpServer())
      .post(membersPath)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email,
        name: 'Managed Analyst',
        initialPassword: 'role-matrix-initial-password',
        role: 'ANALYST',
      })
      .expect(201);
    expect(created.body.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ email, role: 'ANALYST' })]),
    );
    expect(await prisma.projectMember.findFirst({
      where: { projectId, user: { email } },
    })).toMatchObject({ role: 'ANALYST' });

    const managedMember = await prisma.projectMember.findFirstOrThrow({
      where: { projectId, user: { email } },
      select: { userId: true },
    });
    const managedCount = await prisma.projectMember.count({ where: { projectId } });
    for (const token of [
      ownerToken,
      maintainerToken,
      analystToken,
      reviewerToken,
      viewerToken,
    ]) {
      const memberList = await request(app.getHttpServer())
        .get(membersPath)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(memberList.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ userId: managedMember.userId, role: 'ANALYST' }),
        ]),
      );
    }

    for (const token of [maintainerToken, analystToken, reviewerToken, viewerToken]) {
      await request(app.getHttpServer())
        .patch(`${membersPath}/${managedMember.userId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'REVIEWER' })
        .expect(403);
      await request(app.getHttpServer())
        .delete(`${membersPath}/${managedMember.userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
      expect(await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: managedMember.userId },
        },
      })).toMatchObject({ role: 'ANALYST' });
    }
    expect(await prisma.projectMember.count({ where: { projectId } })).toBe(managedCount);

    await request(app.getHttpServer())
      .patch(`${membersPath}/${managedMember.userId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'REVIEWER' })
      .expect(200);
    expect(await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: managedMember.userId },
      },
    })).toMatchObject({ role: 'REVIEWER' });

    await request(app.getHttpServer())
      .delete(`${membersPath}/${managedMember.userId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(await prisma.projectMember.findUnique({
      where: {
        projectId_userId: { projectId, userId: managedMember.userId },
      },
    })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: managedMember.userId } }))
      .not.toBeNull();
  });

  it('allows analyst and reviewer clarification work while keeping viewer writes forbidden', async () => {
    const analystInsight = await prisma.baInsight.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        insightKey: 'role-matrix:analyst-clarification',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Refund trigger',
        description: 'The refund trigger needs stakeholder confirmation.',
      },
    });

    for (const token of [maintainerToken, viewerToken]) {
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
        .set('Authorization', `Bearer ${token}`)
        .send({ sourceInsightId: analystInsight.id })
        .expect(403);
    }
    expect(await prisma.clarificationItem.count({ where: { impactAnalysisId: analysisId } }))
      .toBe(0);

    const analystCreated = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ sourceInsightId: analystInsight.id })
      .expect(201);
    expect(analystCreated.body).toMatchObject({ status: 'OPEN', answer: null });

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${analystCreated.body.id}/answer`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ answer: 'Viewer must not answer.' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${analystCreated.body.id}/answer`)
      .set('Authorization', `Bearer ${maintainerToken}`)
      .send({ answer: 'Maintainer must not answer.' })
      .expect(403);
    expect(await prisma.clarificationItem.findUnique({
      where: { id: analystCreated.body.id },
      select: { status: true, answer: true },
    })).toEqual({ status: 'OPEN', answer: null });

    await request(app.getHttpServer())
      .patch(`/api/v1/clarifications/${analystCreated.body.id}/answer`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ answer: 'Refund follows successful cancellation.' })
      .expect(200);
    expect(await prisma.clarificationItem.findUnique({
      where: { id: analystCreated.body.id },
      select: { status: true, answer: true },
    })).toEqual({
      status: 'ANSWERED',
      answer: 'Refund follows successful cancellation.',
    });

    const reviewerInsight = await prisma.baInsight.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        insightKey: 'role-matrix:reviewer-clarification',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Refund ownership',
        description: 'The owning payment component needs confirmation.',
      },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ sourceInsightId: reviewerInsight.id })
      .expect(201);

    const ownerInsight = await prisma.baInsight.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        insightKey: 'role-matrix:owner-clarification',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Refund ownership for owner',
        description: 'The owner path must allow clarification creation.',
      },
    });
    const ownerClarification = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/clarifications`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sourceInsightId: ownerInsight.id })
      .expect(201);
    expect(await prisma.clarificationItem.findUnique({
      where: { id: ownerClarification.body.id },
      select: { status: true, answer: true },
    })).toEqual({ status: 'OPEN', answer: null });
  });

  it('lets every project role read evidence, review, and QA resources while hiding them from outsiders', async () => {
    const artifact = await prisma.codeArtifact.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId,
        artifactKey: 'src/booking.service.ts#BookingService',
        name: 'BookingService',
        artifactType: 'SERVICE',
        filePath: 'src/booking.service.ts',
      },
    });
    const evidence = await prisma.evidence.create({
      data: {
        id: crypto.randomUUID(),
        provenanceKey: `role-matrix:${crypto.randomUUID()}`,
        sourceType: 'CODE',
        snapshotId,
        artifactId: artifact.id,
        sourcePath: artifact.filePath,
        excerpt: 'await refundService.refund(booking.paymentId);',
        contentHash: crypto.randomUUID(),
      },
    });
    const testArtifactId = crypto.randomUUID();
    const testArtifactKey = 'test:test/booking.spec.ts#refunds-after-cancellation';
    const testEvidenceId = crypto.randomUUID();
    const testEvidenceProvenance = `snapshot:${snapshotId}:artifact:${testArtifactKey}`;
    await prisma.codeArtifact.create({
      data: {
        id: testArtifactId,
        snapshotId,
        artifactKey: testArtifactKey,
        name: 'refunds after cancellation',
        artifactType: 'JEST_TEST_CASE',
        universalKind: 'TEST_CASE',
        filePath: 'test/booking.spec.ts',
        startLine: 8,
        endLine: 20,
        metadata: {
          testCase: {
            framework: 'jest',
            suitePath: ['BookingService'],
            title: 'refunds after cancellation',
            modifier: 'NORMAL',
            declaredModifier: 'NORMAL',
            parentFileArtifactKey: 'test:test%2Fbooking.spec.ts#file',
          },
        },
      },
    });
    await prisma.evidence.create({
      data: {
        id: testEvidenceId,
        provenanceKey: testEvidenceProvenance,
        sourceType: 'TEST',
        snapshotId,
        artifactId: testArtifactId,
        sourcePath: 'test/booking.spec.ts',
        startLine: 8,
        endLine: 20,
        excerpt: "it('refunds after cancellation', () => refundService.refund(booking.paymentId));",
        contentHash: crypto.randomUUID(),
      },
    });
    await prisma.dependencyEdge.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId,
        fromArtifactId: testArtifactId,
        toArtifactId: artifact.id,
        type: 'TESTS',
        confidence: 1,
        metadata: {
          kind: 'STATIC_SOURCE_REFERENCE',
          resolver: 'TS_AST_DIRECT_CALL',
          evidenceProvenanceKey: testEvidenceProvenance,
          locations: [{ sourcePath: 'test/booking.spec.ts', startLine: 14, endLine: 14 }],
        },
      },
    });
    const insight = await prisma.baInsight.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        insightKey: 'role-matrix:evidenced-refund',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Refund path',
        description: 'The booking service calls the refund service.',
      },
    });
    await prisma.insightEvidence.create({
      data: { insightId: insight.id, evidenceId: evidence.id },
    });
    const link = await prisma.traceabilityLink.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        snapshotId,
        artifactId: artifact.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
      },
    });
    await prisma.traceabilityEvidence.create({
      data: { traceabilityLinkId: link.id, evidenceId: evidence.id },
    });

    for (const token of [
      ownerToken,
      maintainerToken,
      analystToken,
      reviewerToken,
      viewerToken,
    ]) {
      const auth = { Authorization: `Bearer ${token}` };
      const evidenceResponse = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/evidence`)
        .set(auth)
        .expect(200);
      expect(evidenceResponse.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: evidence.id })]),
      );

      const insightResponse = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/insights`)
        .set(auth)
        .expect(200);
      expect(insightResponse.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: insight.id })]),
      );

      const traceabilityResponse = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/traceability`)
        .set(auth)
        .expect(200);
      expect(traceabilityResponse.body.items).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: link.id })]),
      );

      await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/qa-coverage`)
        .set(auth)
        .expect(200);
      const traceEvidence = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/qa-coverage/evidence/${testEvidenceId}`)
        .set(auth)
        .expect(200);
      expect(testTraceEvidenceResponseSchema.parse(traceEvidence.body)).toMatchObject({
        analysisId,
        snapshotId,
        commitSha: 'abc123',
        evidence: {
          id: testEvidenceId,
          artifactId: testArtifactId,
          sourceType: 'TEST',
          filePath: 'test/booking.spec.ts',
        },
      });
      const reviewQueue = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/review-queue`)
        .set(auth)
        .expect(200);
      expect(reviewQueue.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: insight.id }),
          expect.objectContaining({ id: link.id }),
        ]),
      );
    }

    const scopedReadPaths = [
      `/api/v1/impact-analyses/${analysisId}/evidence`,
      `/api/v1/impact-analyses/${analysisId}/insights`,
      `/api/v1/impact-analyses/${analysisId}/traceability`,
      `/api/v1/impact-analyses/${analysisId}/qa-coverage`,
      `/api/v1/impact-analyses/${analysisId}/qa-coverage/evidence/${testEvidenceId}`,
      `/api/v1/impact-analyses/${analysisId}/review-queue`,
    ];
    for (const path of scopedReadPaths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
      expect(JSON.stringify(response.body)).not.toContain(
        'The booking service calls the refund service.',
      );
      expect(JSON.stringify(response.body)).not.toContain(
        'await refundService.refund(booking.paymentId);',
      );
    }
  });

  it('allows analyst and reviewer roles to reach the derived-analysis state gate', async () => {
    const reviewDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: reviewerUserId,
      },
    });
    const clarification = await prisma.reviewClarificationRequest.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        reviewDecisionId: reviewDecision.id,
        question: 'Which payment event starts the refund?',
        status: 'OPEN',
        createdByUserId: reviewerUserId,
      },
    });
    const requirement = await prisma.requirementRevision.findUniqueOrThrow({
      where: { id: requirementRevisionId },
      select: { requirementId: true },
    });
    const derivedAnalysisCountBefore = await prisma.impactAnalysis.count({
      where: { derivedFromAnalysisId: analysisId },
    });
    const revisionCountBefore = await prisma.requirementRevision.count({
      where: { requirementId: requirement.requirementId },
    });

    const outcomeByRole = [
      [ownerToken, 400],
      [maintainerToken, 403],
      [analystToken, 400],
      [reviewerToken, 400],
      [viewerToken, 403],
    ] as const;
    for (const [token, expectedStatus] of outcomeByRole) {
      await request(app.getHttpServer())
        .post(`/api/v1/review-clarifications/${clarification.id}/derived-analyses`)
        .set('Authorization', `Bearer ${token}`)
        .expect(expectedStatus);
    }

    expect(await prisma.impactAnalysis.count({
      where: { derivedFromAnalysisId: analysisId },
    })).toBe(derivedAnalysisCountBefore);
    expect(await prisma.requirementRevision.count({
      where: { requirementId: requirement.requirementId },
    })).toBe(revisionCountBefore);
    expect(await prisma.reviewClarificationRequest.findUnique({
      where: { id: clarification.id },
      select: { status: true, answer: true },
    })).toEqual({ status: 'OPEN', answer: null });
  });

  it('creates one provenance-linked derived analysis from an answered clarification', async () => {
    const reviewDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: reviewerUserId,
      },
    });
    const clarification = await prisma.reviewClarificationRequest.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        reviewDecisionId: reviewDecision.id,
        question: 'Which settlement event starts the refund?',
        answer: 'Refunds begin after the settlement is reversed.',
        status: 'ANSWERED',
        createdByUserId: reviewerUserId,
        answeredByUserId: reviewerUserId,
        answeredAt: new Date(),
      },
    });
    const requirement = await prisma.requirementRevision.findUniqueOrThrow({
      where: { id: requirementRevisionId },
      select: { requirementId: true },
    });
    const revisionCountBefore = await prisma.requirementRevision.count({
      where: { requirementId: requirement.requirementId },
    });

    const sendAs = (token: string) => request(app.getHttpServer())
      .post(`/api/v1/review-clarifications/${clarification.id}/derived-analyses`)
      .set('Authorization', `Bearer ${token}`);
    const first = await sendAs(ownerToken).expect(201);
    const created = impactAnalysisResponseSchema.parse(first.body);
    queuedAnalysisIds.push(created.id);

    expect(created).toMatchObject({
      status: 'QUEUED',
      derivedFromAnalysisId: analysisId,
      requirement: {
        revisionTitle: 'Role matrix (Clarified)',
      },
    });
    expect(created.requirement.rawText).toContain(
      'Refunds begin after the settlement is reversed.',
    );
    expect(await prisma.impactAnalysis.findUnique({ where: { id: created.id } }))
      .toMatchObject({
        derivedFromAnalysisId: analysisId,
        reviewClarificationRequestId: clarification.id,
        requirementRevisionId: created.requirement.revisionId,
        status: 'QUEUED',
      });
    expect(await prisma.requirementRevision.count({
      where: { requirementId: requirement.requirementId },
    })).toBe(revisionCountBefore + 1);
    expect(await impactQueue.getJob(`impact-${created.id}`)).toMatchObject({
      data: { analysisId: created.id },
    });

    const retry = await sendAs(reviewerToken).expect(201);
    expect(impactAnalysisResponseSchema.parse(retry.body).id).toBe(created.id);
    expect(await prisma.impactAnalysis.count({
      where: { reviewClarificationRequestId: clarification.id },
    })).toBe(1);
    expect(await prisma.requirementRevision.count({
      where: { requirementId: requirement.requirementId },
    })).toBe(revisionCountBefore + 1);
  });
});
