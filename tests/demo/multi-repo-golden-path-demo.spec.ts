import * as crypto from 'crypto';
import request from 'supertest';
import { createTestApp } from '../../apps/api/test/e2e/helpers/test-app';
import { resetDatabase } from '../../apps/api/test/e2e/helpers/reset-db';
import { grantProjectMembership } from '../../apps/api/test/e2e/helpers/grant-project-membership';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import {
  multiRepoApprovedReportResponseSchema,
  multiRepoAnalysisRunDetailResponseSchema,
  multiRepoImpactAnalysisCreateResponseSchema,
} from '@ba-helper/contracts';

describe('Multi-repo Golden Path Demo', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let prisma: PrismaService;
  let adminUserId: string;
  let adminToken: string;

  beforeAll(async () => {
    process.env.AI_PROVIDER = 'fake';
    process.env.EMBEDDING_PROVIDER = 'fake';
    process.env.ENABLE_DEV_LOGIN = 'true';

    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    const admin = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'multi-repo-demo@ba-helper.local',
        name: 'Multi Repo Demo',
        role: 'ADMIN',
      },
    });

    adminUserId = admin.id;
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ email: admin.email, role: admin.role })
      .expect(201);
    adminToken = loginResponse.body.accessToken;
  });

  async function seedProjectWithRequirement() {
    const project = await prisma.project.create({
      data: { name: 'Multi Repo Demo Project' },
    });
    await grantProjectMembership(prisma, {
      projectId: project.id,
      userId: adminUserId,
      role: 'OWNER',
    });

    const requirement = await prisma.requirement.create({
      data: { projectId: project.id },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        requirementId: requirement.id,
        title: 'Refund paid bookings across services',
        rawText:
          'Allow users to cancel paid bookings and receive refund across booking and payment services.',
        normalizedText:
          'Allow users to cancel paid bookings and receive refund across booking and payment services.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    return { projectId: project.id, revisionId: revision.id };
  }

  async function seedRepository(projectId: string, name: string) {
    const repository = await prisma.repository.create({
      data: {
        projectId,
        canonicalUrl: `https://github.com/example/${name}`,
      },
    });
    const commitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    const target = await prisma.repositoryTarget.create({
      data: {
        repositoryId: repository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: commitSha,
        lastObservedAt: new Date(),
      },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.id,
        commitSha,
        analyzerVersion: 'demo-multi-repo-v1',
        coverageStatus: 'READY',
      },
    });

    return { repositoryId: repository.id, snapshotId: snapshot.id, targetId: target.id };
  }

  async function acceptChildAnalysis(analysisId: string, marker: string) {
    const evidence = await prisma.evidence.create({
      data: {
        provenanceKey: `demo:${analysisId}:${marker}`,
        sourceType: 'CODE',
        sourcePath: `src/${marker}.ts`,
        startLine: 1,
        endLine: 8,
        excerpt: `Evidence for ${marker}`,
        contentHash: crypto.randomUUID().replace(/-/g, ''),
      },
    });
    const insight = await prisma.baInsight.create({
      data: {
        impactAnalysisId: analysisId,
        insightKey: `demo-${marker}`,
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        reviewStatus: 'CONFIRMED',
        confidence: 0.9,
        title: `Reviewed impact for ${marker}`,
        description: `Reviewed multi-repo impact for ${marker}.`,
      },
    });
    await prisma.insightEvidence.create({
      data: {
        insightId: insight.id,
        evidenceId: evidence.id,
      },
    });
    await prisma.impactAnalysis.update({
      where: { id: analysisId },
      data: { status: 'COMPLETED' },
    });
    await prisma.analysisReviewDecision.create({
      data: {
        analysisId,
        decision: 'ACCEPTED',
        reviewedByUserId: adminUserId,
      },
    });
  }

  it('creates, finalizes, reviews, and exports a snapshot-sourced merged report', async () => {
    const { projectId, revisionId } = await seedProjectWithRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const created = multiRepoImpactAnalysisCreateResponseSchema.parse(
      createResponse.body,
    );
    expect(created.items).toHaveLength(2);

    for (const item of created.items) {
      await acceptChildAnalysis(item.analysisId, item.repositoryDisplayName);
    }

    const readyResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${created.runId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const readyRun = multiRepoAnalysisRunDetailResponseSchema.parse(
      readyResponse.body,
    );

    expect(readyRun.mergedReportStatus).toBe('NOT_CREATED');
    expect(readyRun.capabilities.canFinalizeMergedReport).toBe(true);

    const finalizeResponse = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${created.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    const finalized = multiRepoApprovedReportResponseSchema.parse(
      finalizeResponse.body,
    );

    expect(finalized.mergedReportStatus).toBe('CURRENT');
    expect(finalized.capabilities.canExportMergedReport).toBe(true);
    expect(finalized.markdown).toContain('## Review Coverage');
    expect(finalized.markdown).toContain('## Cross-domain Impact Matrix');

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${created.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'Demo merged report accepted.' })
      .expect(201);

    const exportResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${created.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(exportResponse.text).toBe(finalized.markdown);
  });
});
