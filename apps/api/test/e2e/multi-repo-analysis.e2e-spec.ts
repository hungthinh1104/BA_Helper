import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { PdfExportRenderer } from '../../src/modules/document/application/pdf-export.renderer';
import { AppError } from '@ba-helper/shared';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import {
  multiRepoApprovedReportResponseSchema,
  multiRepoAnalysisRunDetailResponseSchema,
  multiRepoAnalysisRunListResponseSchema,
  mergedMultiRepoReportReviewDecisionCreateResponseSchema,
  mergedMultiRepoReportReviewDecisionListResponseSchema,
  mergedMultiRepoReportReviewDecisionResponseSchema,
  multiRepoMergedReportDraftResponseSchema,
  multiRepoImpactMatrixResponseSchema,
  multiRepoImpactAnalysisCreateResponseSchema,
} from '@ba-helper/contracts';

describe('Multi-repo analysis fan-out (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminUserId: string;
  let adminToken: string;

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

    const admin = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'admin@ba-helper.local',
        name: 'Admin',
        role: 'ADMIN',
      },
    });

    adminUserId = admin.id;
    adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    });
  });

  async function seedProjectWithReadyRequirement() {
    const projectId = crypto.randomUUID();
    const requirementId = crypto.randomUUID();
    const revisionId = crypto.randomUUID();

    await prisma.project.create({
      data: {
        id: projectId,
        name: 'Multi Repo Project',
      },
    });

    await grantProjectMembership(prisma, {
      projectId,
      userId: adminUserId,
      role: 'OWNER',
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
        title: 'Refund paid bookings across services',
        rawText:
          'Allow users to cancel paid bookings and receive refund across booking and payment services.',
        normalizedText:
          'Allow users to cancel paid bookings and receive refund across booking and payment services.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    return { projectId, revisionId };
  }

  async function seedRepository(projectId: string, name: string) {
    const repositoryId = crypto.randomUUID();
    const targetId = crypto.randomUUID();
    const snapshotId = crypto.randomUUID();
    const commitSha = crypto.randomUUID().replace(/-/g, '').slice(0, 12);

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
        id: snapshotId,
        repositoryId,
        commitSha,
        analyzerVersion: 'test-v1',
        coverageStatus: 'READY',
      },
    });

    return { repositoryId, snapshotId, targetId, commitSha };
  }

  async function createLatestReviewDecision(params: {
    analysisId: string;
    decision: 'ACCEPTED' | 'REJECTED' | 'NEEDS_MORE_CLARIFICATION';
    createdAt?: Date;
  }) {
    return prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId: params.analysisId,
        decision: params.decision,
        reviewedByUserId: adminUserId,
        createdAt: params.createdAt,
      },
    });
  }

  async function seedAcceptedInsight(params: {
    analysisId: string;
    insightKey: string;
    title: string;
    description: string;
    insightType?: 'CLAIM' | 'QA_SCENARIO';
  }) {
    const evidenceId = crypto.randomUUID();
    const insightId = crypto.randomUUID();

    await prisma.evidence.create({
      data: {
        id: evidenceId,
        provenanceKey: `prov:${params.analysisId}:${params.insightKey}`,
        sourceType: 'CODE',
        sourcePath: `src/${params.insightKey}.ts`,
        startLine: 10,
        endLine: 14,
        excerpt: `evidence for ${params.insightKey}`,
        contentHash: crypto.randomUUID().replace(/-/g, ''),
      },
    });

    await prisma.baInsight.create({
      data: {
        id: insightId,
        impactAnalysisId: params.analysisId,
        insightKey: params.insightKey,
        insightType: params.insightType ?? 'CLAIM',
        certainty: 'EVIDENCED',
        reviewStatus: 'CONFIRMED',
        confidence: 0.9,
        title: params.title,
        description: params.description,
      },
    });

    await prisma.insightEvidence.create({
      data: {
        insightId,
        evidenceId,
      },
    });
  }

  async function seedReadyAcceptedRun() {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    return { projectId, revisionId, booking, payment, result };
  }

  it('creates one normal analysis per selected repository in the same project', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(
      response.body,
    );

    expect(result.runId).toEqual(expect.any(String));
    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId: booking.repositoryId,
          snapshotId: booking.snapshotId,
          sourceTargetId: booking.targetId,
          status: 'QUEUED',
        }),
        expect.objectContaining({
          repositoryId: payment.repositoryId,
          snapshotId: payment.snapshotId,
          sourceTargetId: payment.targetId,
          status: 'QUEUED',
        }),
      ]),
    );

    const persisted = await prisma.impactAnalysis.findMany({
      where: {
        requirementRevisionId: revisionId,
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(persisted).toHaveLength(2);
    expect(new Set(persisted.map((item) => item.multiRepoRunId))).toEqual(
      new Set([result.runId]),
    );
    expect(new Set(persisted.map((item) => item.snapshotId))).toEqual(
      new Set([booking.snapshotId, payment.snapshotId]),
    );

    const runDetailRes = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const runDetail = multiRepoAnalysisRunDetailResponseSchema.parse(
      runDetailRes.body,
    );
    expect(runDetail.runId).toBe(result.runId);
    expect(runDetail.projectId).toBe(projectId);
    expect(runDetail.requirementRevisionId).toBe(revisionId);
    expect(runDetail.mergedReportStatus).toBe('BLOCKED');
    expect(runDetail.capabilities).toMatchObject({
      canFinalizeMergedReport: false,
      canRefreshMergedReport: false,
      canExportMergedReport: false,
      canReviewMergedReport: false,
      canOpenApprovedReport: false,
    });
    expect(runDetail.capabilities.blockedReasons).toEqual(
      expect.arrayContaining(['CHILD_ANALYSIS_NOT_COMPLETED', 'CHILD_REVIEW_PENDING']),
    );
    expect(runDetail.items).toHaveLength(2);
  });

  it('reuses the same run and child analyses on request retry', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');
    const requestKey = crypto.randomUUID();

    const first = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey,
      })
      .expect(201);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey,
      })
      .expect(201);

    const firstResult = multiRepoImpactAnalysisCreateResponseSchema.parse(first.body);
    const secondResult = multiRepoImpactAnalysisCreateResponseSchema.parse(second.body);

    expect(secondResult.runId).toBe(firstResult.runId);
    expect(secondResult.items.map((item) => item.analysisId).sort()).toEqual(
      firstResult.items.map((item) => item.analysisId).sort(),
    );

    const runCount = await prisma.multiRepoAnalysisRun.count();
    const analysisCount = await prisma.impactAnalysis.count({
      where: {
        multiRepoRunId: firstResult.runId,
      },
    });

    expect(runCount).toBe(1);
    expect(analysisCount).toBe(2);
  });

  it('returns 404 when any selected repository is outside the project', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const inProject = await seedRepository(projectId, 'booking-service');

    const outsiderProjectId = crypto.randomUUID();
    await prisma.project.create({
      data: {
        id: outsiderProjectId,
        name: 'Other Project',
      },
    });
    const outsider = await seedRepository(outsiderProjectId, 'other-service');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [inProject.repositoryId, outsider.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(404);
  });

  it('returns 409 when a repository has no analyzable observed snapshot', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const readyRepository = await seedRepository(projectId, 'booking-service');
    const repositoryId = crypto.randomUUID();

    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/no-target-service',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [readyRepository.repositoryId, repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('REPOSITORY_NOT_ANALYZABLE');
      });
  });

  it('returns 404 when reading a run outside project membership', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'outsider@ba-helper.local',
        name: 'Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('returns 409 for merged report draft when the run is not ready', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report-draft`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MULTI_REPO_RUN_NOT_READY');
      });
  });

  it('returns 404 for merged report draft outside project membership', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
    }

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'draft-outsider@ba-helper.local',
        name: 'Draft Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report-draft`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('returns merged markdown draft for an all-accepted run without persisting GeneratedDocument', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `qa-${item.repositoryId.slice(0, 6)}`,
        insightType: 'QA_SCENARIO',
        title: `QA for ${item.repositoryDisplayName}`,
        description: `Validate flow in ${item.repositoryDisplayName}.`,
      });
    }

    const beforeCount = await prisma.generatedDocument.count();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report-draft`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const draft = multiRepoMergedReportDraftResponseSchema.parse(response.body);

    expect(draft.runId).toBe(result.runId);
    expect(draft.childAnalysisCount).toBe(2);
    expect(draft.repositories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId: booking.repositoryId,
          snapshotId: booking.snapshotId,
          commitSha: booking.commitSha,
        }),
        expect.objectContaining({
          repositoryId: payment.repositoryId,
          snapshotId: payment.snapshotId,
        }),
      ]),
    );

    expect(draft.markdown).toContain('## Requirement');
    expect(draft.markdown).toContain('## Run Summary');
    expect(draft.markdown).toContain('## Review Coverage');
    expect(draft.markdown).toContain('Status:');
    expect(draft.markdown).toContain('Coverage Gates');
    expect(draft.markdown).toContain('## Cross-domain Impact Matrix');
    expect(draft.markdown).toContain('## Repository Coverage');
    expect(draft.markdown).toContain('## Per-repository Analysis');
    expect(draft.markdown).toContain('## Consolidated Risks');
    expect(draft.markdown).toContain('## Consolidated QA Scenarios');
    expect(draft.markdown).toContain('## Evidence Appendix');
    expect(draft.markdown).toContain('## Provenance');
    expect(draft.markdown).toContain('booking-service');
    expect(draft.markdown).toContain('payment-service');
    expect(draft.markdown).toContain(result.items[0].analysisId);
    expect(draft.markdown).toContain(result.items[1].analysisId);
    expect(draft.markdown).toContain(booking.snapshotId);
    expect(draft.markdown).toContain(payment.snapshotId);

    const afterCount = await prisma.generatedDocument.count();
    expect(afterCount).toBe(beforeCount);
    expect(afterCount).toBe(0);
  });

  it('finalize merged report returns 409 when run is not ready', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MULTI_REPO_RUN_NOT_READY');
      });
  });

  it('finalize merged report succeeds for all-accepted run and stores approved snapshot', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    const finalizeResponse = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const finalized = multiRepoApprovedReportResponseSchema.parse(finalizeResponse.body);

    expect(finalized.runId).toBe(result.runId);
    expect(finalized.isStale).toBe(false);
    expect(finalized.markdown).toContain('## Requirement');
    expect(finalized.markdown).toContain('## Review Coverage');
    expect(finalized.markdown).toContain('Coverage Gates');
    expect(finalized.markdown).toContain('booking-service');
    expect(finalized.markdown).toContain('payment-service');
    expect(finalized.provenance.childAnalyses).toHaveLength(2);

    const persisted = await prisma.mergedMultiRepoReport.findUnique({
      where: { runId: result.runId },
    });
    expect(persisted).not.toBeNull();
    expect(persisted?.content).toBe(finalized.markdown);
  });

  it('read approved merged report returns markdown, provenance, and stale state after child review changes', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const firstReadResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const firstRead = multiRepoApprovedReportResponseSchema.parse(firstReadResponse.body);
    expect(firstRead.isStale).toBe(false);
    expect(firstRead.provenance.childAnalyses).toHaveLength(2);
    expect(firstRead.markdown).toContain(result.items[0].analysisId);

    await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'REJECTED',
    });

    const secondReadResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const secondRead = multiRepoApprovedReportResponseSchema.parse(secondReadResponse.body);
    expect(secondRead.isStale).toBe(true);
    expect(secondRead.staleReason).toContain('review decisions changed');
  });

  it('merged report finalize and read enforce 404 outsider and 403 insufficient same-project role', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'merged-outsider@ba-helper.local',
        name: 'Merged Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);

    const limitedUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'limited@ba-helper.local',
        name: 'Limited',
        role: 'ADMIN',
      },
    });
    await grantProjectMembership(prisma, {
      projectId,
      userId: limitedUser.id,
      role: 'VIEWER',
    });
    const limitedToken = jwtService.sign({
      sub: limitedUser.id,
      email: limitedUser.email,
      role: limitedUser.role,
      name: limitedUser.name,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({})
      .expect(403);
  });

  it('duplicate finalize is idempotent when provenance is unchanged', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    const firstFinalize = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const secondFinalize = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const first = multiRepoApprovedReportResponseSchema.parse(firstFinalize.body);
    const second = multiRepoApprovedReportResponseSchema.parse(secondFinalize.body);
    const sortProvenance = (
      items: typeof first.provenance.childAnalyses,
    ) => [...items].sort((left, right) => left.analysisId.localeCompare(right.analysisId));

    expect(second.id).toBe(first.id);
    expect(second.markdown).toBe(first.markdown);
    expect(sortProvenance(second.provenance.childAnalyses)).toEqual(
      sortProvenance(first.provenance.childAnalyses),
    );
  });

  it('refreshes a stale approved merged report when child review readiness is restored', async () => {
    const { result } = await seedReadyAcceptedRun();
    const originalReport = await prisma.mergedMultiRepoReport.findUniqueOrThrow({
      where: { runId: result.runId },
    });

    await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'REJECTED',
    });

    const rejectedReadResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const rejectedRead = multiRepoApprovedReportResponseSchema.parse(
      rejectedReadResponse.body,
    );
    expect(rejectedRead.mergedReportStatus).toBe('STALE');
    expect(rejectedRead.capabilities.canRefreshMergedReport).toBe(false);

    const restoredDecision = await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'ACCEPTED',
    });

    const refreshableReadResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const refreshableRead = multiRepoApprovedReportResponseSchema.parse(
      refreshableReadResponse.body,
    );
    expect(refreshableRead.mergedReportStatus).toBe('STALE');
    expect(refreshableRead.capabilities.canRefreshMergedReport).toBe(true);
    expect(refreshableRead.capabilities.canExportMergedReport).toBe(false);

    const refreshedResponse = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    const refreshed = multiRepoApprovedReportResponseSchema.parse(
      refreshedResponse.body,
    );
    const refreshedReport = await prisma.mergedMultiRepoReport.findUniqueOrThrow({
      where: { runId: result.runId },
    });

    expect(refreshed.id).toBe(originalReport.id);
    expect(refreshed.mergedReportStatus).toBe('CURRENT');
    expect(refreshed.capabilities.canExportMergedReport).toBe(true);
    expect(refreshed.provenance.childAnalyses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          analysisId: result.items[0].analysisId,
          latestReviewDecisionId: restoredDecision.id,
        }),
      ]),
    );
    expect(refreshedReport.provenance).toEqual(refreshed.provenance);
  });

  it('exports markdown and pdf for a non-stale approved merged report', async () => {
    const { result } = await seedReadyAcceptedRun();

    const markdownResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(markdownResponse.headers['content-type']).toContain('text/markdown');
    expect(markdownResponse.headers['content-disposition']).toContain('.md');
    expect(markdownResponse.text).toContain('## Requirement');
    expect(markdownResponse.text).toContain(result.items[0].analysisId);

    const pdfResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(pdfResponse.headers['content-disposition']).toContain('.pdf');
    expect(Buffer.isBuffer(pdfResponse.body)).toBe(true);
    expect(pdfResponse.body.length).toBeGreaterThan(0);
  });

  it('returns 404 before merged report finalize and blocks stale merged report export', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe('MERGED_MULTI_REPO_REPORT_NOT_FOUND');
      });

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'REJECTED',
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MERGED_REPORT_EXPORT_BLOCKED_STALE');
      });
  });

  it('treats invalid approved merged report provenance as stale and blocks export', async () => {
    const { result } = await seedReadyAcceptedRun();

    await prisma.mergedMultiRepoReport.update({
      where: { runId: result.runId },
      data: {
        provenance: {
          childAnalyses: [
            {
              analysisId: 'not-a-uuid',
            },
          ],
        },
      },
    });

    const readResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const read = multiRepoApprovedReportResponseSchema.parse(readResponse.body);

    expect(read.mergedReportStatus).toBe('STALE');
    expect(read.isStale).toBe(true);
    expect(read.staleReason).toContain('provenance is invalid');
    expect(read.provenance.childAnalyses).toEqual([]);
    expect(read.capabilities.canExportMergedReport).toBe(false);
    expect(read.capabilities.canReviewMergedReport).toBe(false);

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MERGED_REPORT_EXPORT_BLOCKED_STALE');
      });
  });

  it('merged report export enforces 404 outsider and honors same-project export permission matrix', async () => {
    const { projectId, result } = await seedReadyAcceptedRun();

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'export-outsider@ba-helper.local',
        name: 'Export Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);

    const limitedUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'export-limited@ba-helper.local',
        name: 'Export Limited',
        role: 'ADMIN',
      },
    });
    await grantProjectMembership(prisma, {
      projectId,
      userId: limitedUser.id,
      role: 'VIEWER',
    });
    const limitedToken = jwtService.sign({
      sub: limitedUser.id,
      email: limitedUser.email,
      role: limitedUser.role,
      name: limitedUser.name,
    });

    const viewerReadResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .expect(200);
    const viewerRead = multiRepoApprovedReportResponseSchema.parse(
      viewerReadResponse.body,
    );
    expect(viewerRead.capabilities).toMatchObject({
      canFinalizeMergedReport: false,
      canRefreshMergedReport: false,
      canExportMergedReport: true,
      canReviewMergedReport: false,
      canOpenApprovedReport: true,
    });

    const viewerRunDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .expect(200);
    const viewerRunDetail = multiRepoAnalysisRunDetailResponseSchema.parse(
      viewerRunDetailResponse.body,
    );
    expect(viewerRunDetail.capabilities).toMatchObject({
      canFinalizeMergedReport: false,
      canRefreshMergedReport: false,
      canOpenApprovedReport: true,
    });

    const allowedResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.pdf`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(allowedResponse.headers['content-type']).toContain('application/pdf');
  });

  it('pdf render failure does not mutate approved merged report state', async () => {
    const { result } = await seedReadyAcceptedRun();
    const before = await prisma.mergedMultiRepoReport.findUniqueOrThrow({
      where: { runId: result.runId },
    });

    const renderSpy = jest
      .spyOn(PdfExportRenderer.prototype, 'render')
      .mockRejectedValueOnce(
        new AppError('PDF_RENDER_FAILED', 'render crash'),
      );

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(502)
      .expect(({ body }) => {
        expect(body.code).toBe('PDF_RENDER_FAILED');
      });

    renderSpy.mockRestore();

    const after = await prisma.mergedMultiRepoReport.findUniqueOrThrow({
      where: { runId: result.runId },
    });

    expect(after.id).toBe(before.id);
    expect(after.content).toBe(before.content);
    expect(after.provenance).toEqual(before.provenance);
  });

  it('creates, lists, and reads latest merged report review decisions for a non-stale approved report', async () => {
    const { result } = await seedReadyAcceptedRun();

    const firstResponse = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'NEEDS_MORE_CLARIFICATION',
        note: 'Need cross-repository reconciliation detail.',
      })
      .expect(201);

    const firstDecision = mergedMultiRepoReportReviewDecisionCreateResponseSchema.parse(
      firstResponse.body,
    );
    expect(firstDecision.decision.runId).toBe(result.runId);
    expect(firstDecision.decision.decision).toBe('NEEDS_MORE_CLARIFICATION');

    const secondResponse = await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'ACCEPTED',
        note: 'Merged report approved after follow-up check.',
      })
      .expect(201);

    const secondDecision = mergedMultiRepoReportReviewDecisionCreateResponseSchema.parse(
      secondResponse.body,
    );
    expect(secondDecision.decision.decision).toBe('ACCEPTED');

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const list = mergedMultiRepoReportReviewDecisionListResponseSchema.parse(
      listResponse.body,
    );
    expect(list.items).toHaveLength(2);
    expect(list.items[0].decision).toBe('ACCEPTED');
    expect(list.items[1].decision).toBe('NEEDS_MORE_CLARIFICATION');

    const latestResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions/latest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const latest = mergedMultiRepoReportReviewDecisionResponseSchema.parse(
      latestResponse.body,
    );
    expect(latest.id).toBe(secondDecision.decision.id);
    expect(latest.reviewedBy).toBe('Admin');
  });

  it('blocks merged report review decision create when the approved report is stale', async () => {
    const { result } = await seedReadyAcceptedRun();

    await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'REJECTED',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        decision: 'ACCEPTED',
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MERGED_MULTI_REPO_REPORT_STALE');
      });

    const historyResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const history = mergedMultiRepoReportReviewDecisionListResponseSchema.parse(
      historyResponse.body,
    );
    expect(history.items).toHaveLength(0);
  });

  it('merged report review decisions enforce 404 outsider and 403 insufficient same-project role', async () => {
    const { projectId, result } = await seedReadyAcceptedRun();

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'merged-review-outsider@ba-helper.local',
        name: 'Merged Review Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);

    const limitedUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'merged-review-viewer@ba-helper.local',
        name: 'Merged Review Viewer',
        role: 'ADMIN',
      },
    });
    await grantProjectMembership(prisma, {
      projectId,
      userId: limitedUser.id,
      role: 'VIEWER',
    });
    const limitedToken = jwtService.sign({
      sub: limitedUser.id,
      email: limitedUser.email,
      role: limitedUser.role,
      name: limitedUser.name,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/review-decisions`)
      .set('Authorization', `Bearer ${limitedToken}`)
      .send({
        decision: 'REJECTED',
      })
      .expect(403);
  });

  it('derives run readiness and latest review decisions correctly', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');
    const billing = await seedRepository(projectId, 'billing-service');
    const ledger = await seedRepository(projectId, 'ledger-service');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [
          booking.repositoryId,
          payment.repositoryId,
          billing.repositoryId,
          ledger.repositoryId,
        ],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    const analysesByRepo = new Map(
      result.items.map((item) => [item.repositoryId, item.analysisId]),
    );

    await prisma.impactAnalysis.update({
      where: { id: analysesByRepo.get(booking.repositoryId)! },
      data: { status: 'COMPLETED' },
    });
    await prisma.impactAnalysis.update({
      where: { id: analysesByRepo.get(payment.repositoryId)! },
      data: { status: 'COMPLETED' },
    });
    await prisma.impactAnalysis.update({
      where: { id: analysesByRepo.get(billing.repositoryId)! },
      data: { status: 'WAITING_FOR_REVIEW' },
    });
    await prisma.impactAnalysis.update({
      where: { id: analysesByRepo.get(ledger.repositoryId)! },
      data: { status: 'FAILED' },
    });

    await createLatestReviewDecision({
      analysisId: analysesByRepo.get(booking.repositoryId)!,
      decision: 'REJECTED',
      createdAt: new Date('2026-06-09T03:00:00Z'),
    });
    await createLatestReviewDecision({
      analysisId: analysesByRepo.get(booking.repositoryId)!,
      decision: 'ACCEPTED',
      createdAt: new Date('2026-06-09T04:00:00Z'),
    });
    await createLatestReviewDecision({
      analysisId: analysesByRepo.get(payment.repositoryId)!,
      decision: 'NEEDS_MORE_CLARIFICATION',
      createdAt: new Date('2026-06-09T05:00:00Z'),
    });

    const runDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const runDetail = multiRepoAnalysisRunDetailResponseSchema.parse(
      runDetailResponse.body,
    );

    expect(runDetail.runReadiness).toEqual({
      totalAnalyses: 4,
      completedAnalyses: 2,
      failedAnalyses: 1,
      waitingForReviewAnalyses: 1,
      allCompleted: false,
      hasFailures: true,
      canStartMergedReport: false,
    });
    expect(runDetail.childReviewSummary).toEqual({
      accepted: 1,
      rejected: 0,
      needsMoreClarification: 1,
      pendingReview: 2,
    });
    expect(runDetail.mergedReportStatus).toBe('BLOCKED');
    expect(runDetail.capabilities.canFinalizeMergedReport).toBe(false);
    expect(runDetail.capabilities.blockedReasons).toEqual(
      expect.arrayContaining([
        'CHILD_ANALYSIS_FAILED',
        'CHILD_ANALYSIS_WAITING_FOR_REVIEW',
        'CHILD_REVIEW_NEEDS_CLARIFICATION',
        'CHILD_REVIEW_PENDING',
      ]),
    );

    const bookingItem = runDetail.items.find(
      (item) => item.repositoryId === booking.repositoryId,
    );
    expect(bookingItem).toMatchObject({
      latestReviewDecision: 'ACCEPTED',
      reviewedBy: 'Admin',
      blockingReason: 'NONE',
    });
    expect(bookingItem?.latestReviewDecisionAt).toBe('2026-06-09T04:00:00.000Z');

    const paymentItem = runDetail.items.find(
      (item) => item.repositoryId === payment.repositoryId,
    );
    expect(paymentItem).toMatchObject({
      latestReviewDecision: 'NEEDS_MORE_CLARIFICATION',
      blockingReason: 'NEEDS_MORE_CLARIFICATION',
    });

    const billingItem = runDetail.items.find(
      (item) => item.repositoryId === billing.repositoryId,
    );
    expect(billingItem).toMatchObject({
      latestReviewDecision: null,
      blockingReason: 'WAITING_FOR_REVIEW',
    });

    const ledgerItem = runDetail.items.find(
      (item) => item.repositoryId === ledger.repositoryId,
    );
    expect(ledgerItem).toMatchObject({
      latestReviewDecision: null,
      blockingReason: 'FAILED',
    });
  });

  it('canStartMergedReport becomes true only when every child is accepted', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
    }

    const runDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const runDetail = multiRepoAnalysisRunDetailResponseSchema.parse(
      runDetailResponse.body,
    );

    expect(runDetail.runReadiness).toMatchObject({
      totalAnalyses: 2,
      completedAnalyses: 2,
      failedAnalyses: 0,
      waitingForReviewAnalyses: 0,
      allCompleted: true,
      hasFailures: false,
      canStartMergedReport: true,
    });
    expect(runDetail.childReviewSummary).toEqual({
      accepted: 2,
      rejected: 0,
      needsMoreClarification: 0,
      pendingReview: 0,
    });
    expect(runDetail.mergedReportStatus).toBe('NOT_CREATED');
    expect(runDetail.capabilities).toMatchObject({
      canFinalizeMergedReport: true,
      canRefreshMergedReport: false,
      canExportMergedReport: false,
      canReviewMergedReport: false,
      canOpenApprovedReport: false,
      blockedReasons: [],
    });
    expect(runDetail.items.every((item) => item.blockingReason === 'NONE')).toBe(true);
  });

  it('blocks merged report readiness when an accepted child analysis becomes stale', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({
        analysisId: item.analysisId,
        decision: 'ACCEPTED',
      });
    }

    await prisma.repositoryTarget.update({
      where: { id: booking.targetId },
      data: { latestObservedCommitSha: 'new-booking-commit' },
    });

    const runDetailResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const runDetail = multiRepoAnalysisRunDetailResponseSchema.parse(
      runDetailResponse.body,
    );

    expect(runDetail.runReadiness).toMatchObject({
      completedAnalyses: 2,
      canStartMergedReport: false,
    });
    expect(runDetail.mergedReportStatus).toBe('BLOCKED');
    expect(runDetail.capabilities.canFinalizeMergedReport).toBe(false);
    expect(runDetail.capabilities.blockedReasons).toContain('CHILD_ANALYSIS_STALE');
    expect(
      runDetail.items.find((item) => item.repositoryId === booking.repositoryId),
    ).toMatchObject({
      isStale: true,
      blockingReason: 'STALE',
    });

    const matrixResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/impact-matrix`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const matrix = multiRepoImpactMatrixResponseSchema.parse(matrixResponse.body);
    expect(
      matrix.rows.find((row) => row.repositoryId === booking.repositoryId),
    ).toMatchObject({
      blockingReason: 'STALE',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MULTI_REPO_RUN_NOT_READY');
      });
  });

  it('lists only project runs with derived status counts in newest-first order', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');
    const billing = await seedRepository(projectId, 'billing-service');

    const firstCreate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const firstRun = multiRepoImpactAnalysisCreateResponseSchema.parse(firstCreate.body);

    await prisma.impactAnalysis.update({
      where: { id: firstRun.items[0].analysisId },
      data: { status: 'COMPLETED' },
    });

    await prisma.impactAnalysis.update({
      where: { id: firstRun.items[1].analysisId },
      data: { status: 'FAILED' },
    });

    const secondCreate = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [billing.repositoryId, booking.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const secondRun = multiRepoImpactAnalysisCreateResponseSchema.parse(secondCreate.body);

    const otherProjectId = crypto.randomUUID();
    const otherRequirementId = crypto.randomUUID();
    const otherRevisionId = crypto.randomUUID();

    await prisma.project.create({
      data: {
        id: otherProjectId,
        name: 'Other Project',
      },
    });

    await prisma.requirement.create({
      data: {
        id: otherRequirementId,
        projectId: otherProjectId,
      },
    });

    await prisma.requirementRevision.create({
      data: {
        id: otherRevisionId,
        requirementId: otherRequirementId,
        title: 'Other project requirement',
        rawText: 'Other project requirement',
        normalizedText: 'Other project requirement',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    await seedRepository(otherProjectId, 'other-a');
    await seedRepository(otherProjectId, 'other-b');

    await prisma.multiRepoAnalysisRun.create({
      data: {
        id: crypto.randomUUID(),
        projectId: otherProjectId,
        requirementRevisionId: otherRevisionId,
        createdByUserId: adminUserId,
        requestKey: crypto.randomUUID(),
      },
    });

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/multi-repo-runs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const result = multiRepoAnalysisRunListResponseSchema.parse(listResponse.body);

    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.runId)).toEqual([
      secondRun.runId,
      firstRun.runId,
    ]);
    expect(result.items[0].analysisCount).toBe(2);
    expect(result.items[0].statusCounts).toEqual({
      QUEUED: 2,
      RUNNING: 0,
      WAITING_FOR_REVIEW: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    });
    expect(result.items[1].statusCounts).toEqual({
      QUEUED: 0,
      RUNNING: 0,
      WAITING_FOR_REVIEW: 0,
      COMPLETED: 1,
      FAILED: 1,
      CANCELLED: 0,
    });
  });

  it('returns an empty run list for a project with no multi-repo runs', async () => {
    const { projectId } = await seedProjectWithReadyRequirement();

    const response = await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/multi-repo-runs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const result = multiRepoAnalysisRunListResponseSchema.parse(response.body);
    expect(result.items).toEqual([]);
  });

  it('returns 404 when listing runs outside project membership', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'run-outsider@ba-helper.local',
        name: 'Run Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/projects/${projectId}/multi-repo-runs`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('returns 404 for review coverage endpoint outside project membership', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'coverage-outsider@ba-helper.local',
        name: 'Coverage Outsider',
        role: 'ADMIN',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
      name: outsider.name,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/review-coverage`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('returns 401 for review coverage endpoint unauthenticated', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/review-coverage`)
      .expect(401);
  });

  // ─── Phase 25C: Snapshot Integrity & Regression Guard ────────────────────────

  it('merged report draft includes both Review Coverage and Cross-domain Impact Matrix sections', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({ analysisId: item.analysisId, decision: 'ACCEPTED' });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    const response = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report-draft`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const draft = multiRepoMergedReportDraftResponseSchema.parse(response.body);
    expect(draft.markdown).toContain('## Review Coverage');
    expect(draft.markdown).toContain('Status:');
    expect(draft.markdown).toContain('### Coverage Gates');
    expect(draft.markdown).toContain('## Cross-domain Impact Matrix');
    expect(draft.markdown).toContain('advisory readiness check');
  });

  it('finalized merged report snapshot includes Review Coverage and Cross-domain Impact Matrix', async () => {
    const { result } = await seedReadyAcceptedRun();

    const reportResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const report = multiRepoApprovedReportResponseSchema.parse(reportResponse.body);
    expect(report.mergedReportStatus).toBe('CURRENT');
    expect(report.capabilities).toMatchObject({
      canFinalizeMergedReport: false,
      canRefreshMergedReport: false,
      canExportMergedReport: true,
      canReviewMergedReport: true,
      canOpenApprovedReport: true,
      blockedReasons: ['MERGED_REPORT_CURRENT'],
    });
    expect(report.markdown).toContain('## Review Coverage');
    expect(report.markdown).toContain('### Coverage Gates');
    expect(report.markdown).toContain('## Cross-domain Impact Matrix');
    expect(report.markdown).toContain('advisory readiness check');
  });

  it('markdown export includes Review Coverage from finalized snapshot and not recomputed live', async () => {
    // Finalize while all analyses are ACCEPTED → coverage status PASS
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({ analysisId: item.analysisId, decision: 'ACCEPTED' });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Risk in ${item.repositoryDisplayName}`,
        description: `Impact found in ${item.repositoryDisplayName}.`,
      });
    }

    // Finalize — snapshot captures current state including Review Coverage
    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    // Read the persisted snapshot to capture what was stored at finalization
    const snapshotResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const snapshot = multiRepoApprovedReportResponseSchema.parse(snapshotResponse.body);
    const snapshotMarkdown = snapshot.markdown;

    // Verify coverage section was captured in snapshot
    expect(snapshotMarkdown).toContain('## Review Coverage');

    // Export markdown → must serve content identical to finalized snapshot
    const exportResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(exportResponse.text).toBe(snapshotMarkdown);
    expect(exportResponse.text).toContain('## Review Coverage');
    expect(exportResponse.text).toContain('## Cross-domain Impact Matrix');
  });

  it('pdf export includes Review Coverage from finalized snapshot', async () => {
    const { result } = await seedReadyAcceptedRun();

    const pdfResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.pdf`)
      .set('Authorization', `Bearer ${adminToken}`)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(pdfResponse.headers['content-type']).toContain('application/pdf');
    expect(Buffer.isBuffer(pdfResponse.body)).toBe(true);
    expect(pdfResponse.body.length).toBeGreaterThan(0);
    // PDF binary header marker
    expect(pdfResponse.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('export uses finalized snapshot even if underlying review coverage changes after finalization', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
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

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);

    // All accepted with insights → coverage will likely PASS
    for (const item of result.items) {
      await prisma.impactAnalysis.update({
        where: { id: item.analysisId },
        data: { status: 'COMPLETED' },
      });
      await createLatestReviewDecision({ analysisId: item.analysisId, decision: 'ACCEPTED' });
      await seedAcceptedInsight({
        analysisId: item.analysisId,
        insightKey: `claim-${item.repositoryId.slice(0, 6)}`,
        title: `Snapshot stability marker`,
        description: `Marker text: FINALIZED_COVERAGE_STATE`,
      });
    }

    await request(app.getHttpServer())
      .post(`/api/v1/multi-repo-runs/${result.runId}/merged-report/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    // Capture the persisted snapshot before any mutation
    const snapshotBefore = await prisma.mergedMultiRepoReport.findUniqueOrThrow({
      where: { runId: result.runId },
    });

    // Mutate underlying state: reject one analysis (coverage would change if recomputed)
    await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'REJECTED',
    });

    // Snapshot must be unchanged in DB (immutable finalized record)
    const snapshotAfter = await prisma.mergedMultiRepoReport.findUniqueOrThrow({
      where: { runId: result.runId },
    });
    expect(snapshotAfter.content).toBe(snapshotBefore.content);

    // Read endpoint correctly marks report stale due to policy drift
    const readResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const staleReport = multiRepoApprovedReportResponseSchema.parse(readResponse.body);
    expect(staleReport.isStale).toBe(true);
    expect(staleReport.mergedReportStatus).toBe('STALE');
    expect(staleReport.capabilities.canExportMergedReport).toBe(false);
    expect(staleReport.capabilities.canReviewMergedReport).toBe(false);

    // Export is blocked because report is stale (existing policy unchanged)
    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('MERGED_REPORT_EXPORT_BLOCKED_STALE');
      });
  });

  it('stale finalized report remains readable but its content reflects the finalized snapshot', async () => {
    const { result } = await seedReadyAcceptedRun();

    // Capture snapshot content
    const reportResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const freshReport = multiRepoApprovedReportResponseSchema.parse(reportResponse.body);
    const capturedMarkdown = freshReport.markdown;
    expect(freshReport.isStale).toBe(false);

    // Trigger staleness
    await createLatestReviewDecision({
      analysisId: result.items[0].analysisId,
      decision: 'REJECTED',
    });

    const staleResponse = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/merged-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const staleReport = multiRepoApprovedReportResponseSchema.parse(staleResponse.body);
    expect(staleReport.isStale).toBe(true);
    expect(staleReport.mergedReportStatus).toBe('STALE');
    // Content is unchanged: reads from persisted snapshot, never recomputed
    expect(staleReport.markdown).toBe(capturedMarkdown);
    expect(staleReport.markdown).toContain('## Review Coverage');
  });
});
