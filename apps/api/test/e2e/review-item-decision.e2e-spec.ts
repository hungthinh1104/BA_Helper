import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { PrismaService } from '@ba-helper/backend-runtime';

describe('Unified review-item decision endpoint (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let ownerToken: string;
  let ownerUserId: string;

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
        email: 'owner@ba-helper.local',
        name: 'Olivia Owner',
        role: 'ADMIN',
      },
    });
    ownerUserId = user.id;
    ownerToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  async function setupReviewable() {
    const projectId = crypto.randomUUID();
    const repositoryId = crypto.randomUUID();
    await prisma.project.create({ data: { id: projectId, name: 'Proj' } });
    await grantProjectMembership(prisma, { projectId, userId: ownerUserId, role: 'OWNER' });
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
    await prisma.requirement.create({ data: { id: reqId, projectId } });
    const revId = crypto.randomUUID();
    await prisma.requirementRevision.create({
      data: {
        id: revId,
        requirementId: reqId,
        title: 'R1',
        rawText: 'text',
        normalizedText: 'text',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    const analysisId = crypto.randomUUID();
    await prisma.impactAnalysis.create({
      data: {
        id: analysisId,
        requirementRevisionId: revId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
      },
    });

    const artifactId = crypto.randomUUID();
    await prisma.codeArtifact.create({
      data: {
        id: artifactId,
        snapshotId,
        artifactKey: 'src/booking.controller.ts',
        name: 'BookingController',
        artifactType: 'FILE',
        universalKind: 'API_ENDPOINT',
        filePath: 'src/booking.controller.ts',
        language: 'typescript',
      },
    });

    const linkId = crypto.randomUUID();
    await prisma.traceabilityLink.create({
      data: {
        id: linkId,
        impactAnalysisId: analysisId,
        artifactId,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 0.9,
      },
    });

    const insightId = crypto.randomUUID();
    await prisma.baInsight.create({
      data: {
        id: insightId,
        impactAnalysisId: analysisId,
        insightKey: 'risk:duplicate-refund',
        insightType: 'CLAIM',
        certainty: 'INFERRED',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Duplicate refund risk',
        description: 'Refund retry may duplicate.',
      },
    });

    return { projectId, analysisId, linkId, insightId };
  }

  function decide(analysisId: string, itemId: string, token: string, body: unknown) {
    return request(app.getHttpServer())
      .put(`/api/v1/impact-analyses/${analysisId}/review-items/${itemId}/decision`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);
  }

  it('persists an impact decision with rationale and reviewer attribution', async () => {
    const { analysisId, linkId } = await setupReviewable();

    const res = await decide(analysisId, linkId, ownerToken, {
      target: 'impact',
      action: 'accept',
      rationale: 'Confirmed the endpoint is affected.',
    }).expect(200);

    expect(res.body).toMatchObject({
      itemId: linkId,
      target: 'impact',
      currentDecision: 'accepted',
      reviewNote: 'Confirmed the endpoint is affected.',
      idempotent: false,
    });

    const decision = await prisma.traceabilityReviewDecision.findUnique({
      where: { traceabilityLinkId: linkId },
    });
    expect(decision?.decision).toBe('ACCEPTED');
    expect(decision?.note).toBe('Confirmed the endpoint is affected.');
    expect(decision?.reviewedByUserId).toBe(ownerUserId);

    const link = await prisma.traceabilityLink.findUnique({ where: { id: linkId } });
    expect(link?.reviewStatus).toBe('CONFIRMED');
  });

  it('is idempotent when the same impact decision is submitted twice', async () => {
    const { analysisId, linkId } = await setupReviewable();
    const body = { target: 'impact', action: 'accept', rationale: 'ok' };

    await decide(analysisId, linkId, ownerToken, body).expect(200);
    const second = await decide(analysisId, linkId, ownerToken, body).expect(200);
    expect(second.body.idempotent).toBe(true);

    const decisions = await prisma.traceabilityReviewDecision.findMany({
      where: { traceabilityLinkId: linkId },
    });
    expect(decisions).toHaveLength(1);
  });

  it('undoes an impact decision back to needs_review', async () => {
    const { analysisId, linkId } = await setupReviewable();
    await decide(analysisId, linkId, ownerToken, { target: 'impact', action: 'reject', rationale: 'no' }).expect(200);

    const res = await decide(analysisId, linkId, ownerToken, { target: 'impact', action: 'undo' }).expect(200);
    expect(res.body.currentDecision).toBe('needs_review');

    const decision = await prisma.traceabilityReviewDecision.findUnique({
      where: { traceabilityLinkId: linkId },
    });
    expect(decision).toBeNull();
    const link = await prisma.traceabilityLink.findUnique({ where: { id: linkId } });
    expect(link?.reviewStatus).toBe('NEEDS_REVIEW');
  });

  it('persists an insight decision rationale as a review note', async () => {
    const { analysisId, insightId } = await setupReviewable();

    const res = await decide(analysisId, insightId, ownerToken, {
      target: 'insight',
      action: 'reject',
      rationale: 'Not a real risk.',
    }).expect(200);
    expect(res.body).toMatchObject({ currentDecision: 'rejected', reviewNote: 'Not a real risk.' });

    const insight = await prisma.baInsight.findUnique({ where: { id: insightId } });
    expect(insight?.reviewStatus).toBe('REJECTED');
    const note = await prisma.reviewNote.findUnique({
      where: { impactAnalysisId_insightId: { impactAnalysisId: analysisId, insightId } },
    });
    expect(note?.body).toBe('Not a real risk.');
  });

  it('undoes an insight decision and clears its rationale', async () => {
    const { analysisId, insightId } = await setupReviewable();
    await decide(analysisId, insightId, ownerToken, { target: 'insight', action: 'accept', rationale: 'agreed' }).expect(200);

    const res = await decide(analysisId, insightId, ownerToken, { target: 'insight', action: 'undo' }).expect(200);
    expect(res.body.currentDecision).toBe('needs_review');

    const insight = await prisma.baInsight.findUnique({ where: { id: insightId } });
    expect(insight?.reviewStatus).toBe('NEEDS_REVIEW');
    const note = await prisma.reviewNote.findUnique({
      where: { impactAnalysisId_insightId: { impactAnalysisId: analysisId, insightId } },
    });
    expect(note).toBeNull();
  });

  it('rejects needs_more_evidence for insight items', async () => {
    const { analysisId, insightId } = await setupReviewable();
    await decide(analysisId, insightId, ownerToken, {
      target: 'insight',
      action: 'needs_more_evidence',
    }).expect(400);
  });

  it('forbids a viewer without review:write from deciding', async () => {
    const { projectId, analysisId, linkId } = await setupReviewable();
    const viewer = await prisma.user.create({
      data: { email: 'viewer@ba-helper.local', name: 'Vic Viewer', role: 'REVIEWER' },
    });
    await grantProjectMembership(prisma, { projectId, userId: viewer.id, role: 'VIEWER' });
    const viewerToken = jwtService.sign({ sub: viewer.id, email: viewer.email, role: viewer.role });

    await decide(analysisId, linkId, viewerToken, { target: 'impact', action: 'accept' }).expect(403);
  });
});
