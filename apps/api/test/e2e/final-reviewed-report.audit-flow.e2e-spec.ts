import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  approvedImpactReportResponseSchema,
  finalReviewedReportResponseSchema,
  impactGraphResponseSchema,
  localizedReportArtifactSchema,
  localizationStatusResponseSchema,
  reviewedReportSnapshotSchema,
} from '@ba-helper/contracts';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { grantProjectMembership } from './helpers/grant-project-membership';
import {
  EventLogService,
  PrismaService,
  QueueService,
  ReviewedSnapshotReportContextAdapter,
} from '@ba-helper/backend-runtime';
import type { ReviewNoteRepository, TraceabilityRepository } from '@ba-helper/backend-runtime';
import { RunDocumentJobUseCase } from '@ba-helper/application';
import { ApprovedReportContextReader } from '../../src/modules/document/application/queries/approved-report-context.reader';
import { GetReviewCompletionUseCase } from '../../src/modules/traceability/application/get-review-completion.usecase';
import { CreateReviewedReportSnapshotUseCase } from '../../src/modules/document/application/commands/create-reviewed-report-snapshot.usecase';
import { FinalizeImpactAnalysisUseCase } from '../../src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase';
import { SaveReviewNoteUseCase } from '../../src/modules/impact-analysis/application/review/save-review-note.usecase';
import { SubmitReviewItemDecisionUseCase } from '../../src/modules/review/application/submit-review-item-decision.usecase';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function withDeadline<T>(promise: Promise<T>, label: string, timeoutMs = 10_000): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

async function waitForRepositoryTargetUpdateLock(prisma: PrismaService): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const waiting = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query ILIKE '%RepositoryTarget%'
    `;
    if ((waiting[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for RepositoryTarget update to block on finalization.');
}

async function waitForReviewNoteAnalysisLock(prisma: PrismaService): Promise<void> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const waiting = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query ILIKE '%FROM "ImpactAnalysis" AS analysis%'
        AND query ILIKE '%FOR UPDATE OF analysis%'
    `;
    if ((waiting[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for the review note transaction to block on the finalization lock.');
}

async function waitForClarificationAnalysisLock(prisma: PrismaService): Promise<void> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const waiting = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM pg_stat_activity
      WHERE pid <> pg_backend_pid()
        AND wait_event_type = 'Lock'
        AND query ILIKE '%FROM "ImpactAnalysis"%'
        AND query ILIKE '%FOR UPDATE%'
    `;
    if ((waiting[0]?.count ?? 0) > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for the clarification mutation to serialize with finalization.');
}

describe('Final Reviewed Report Audit Flow (e2e)', () => {
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

  async function setupBasicAnalysisWithLinks() {
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
        requirementId: reqId,
        projectId,
        repositoryId,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
      },
    });

    const docId = crypto.randomUUID();
    await prisma.generatedDocument.create({
      data: {
        id: docId,
        impactAnalysisId: analysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Live Generated Report',
      },
    });

    // Create CodeArtifacts
    const artifact1Id = crypto.randomUUID();
    const artifact2Id = crypto.randomUUID();
    await prisma.codeArtifact.createMany({
      data: [
        { id: artifact1Id, snapshotId, artifactKey: 'src/main.ts', name: 'main.ts', artifactType: 'FILE', filePath: 'src/main.ts', language: 'typescript' },
        { id: artifact2Id, snapshotId, artifactKey: 'src/utils.ts', name: 'utils.ts', artifactType: 'FILE', filePath: 'src/utils.ts', language: 'typescript' },
      ],
    });

    // Create Traceability Links
    const link1Id = crypto.randomUUID();
    const link2Id = crypto.randomUUID();

    await prisma.traceabilityLink.createMany({
      data: [
        {
          id: link1Id,
          impactAnalysisId: analysisId,
          snapshotId,
          artifactId: artifact1Id,
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          reviewStatus: 'NEEDS_REVIEW',
          confidence: 0.9,
        },
        {
          id: link2Id,
          impactAnalysisId: analysisId,
          snapshotId,
          artifactId: artifact2Id,
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          reviewStatus: 'NEEDS_REVIEW',
          confidence: 0.8,
        },
      ],
    });

    const evidence1Id = crypto.randomUUID();
    const evidence2Id = crypto.randomUUID();
    await prisma.evidence.createMany({
      data: [
        {
          id: evidence1Id,
          provenanceKey: `audit-flow:${analysisId}:src/main.ts`,
          sourceType: 'CODE',
          snapshotId,
          artifactId: artifact1Id,
          sourcePath: 'src/main.ts',
          startLine: 1,
          endLine: 8,
          excerpt: 'export function main() { return runReviewedImpactFlow(); }',
          contentHash: 'audit-flow-main-hash',
        },
        {
          id: evidence2Id,
          provenanceKey: `audit-flow:${analysisId}:src/utils.ts`,
          sourceType: 'CODE',
          snapshotId,
          artifactId: artifact2Id,
          sourcePath: 'src/utils.ts',
          startLine: 3,
          endLine: 12,
          excerpt: 'export function utils() { return buildTraceabilityEvidence(); }',
          contentHash: 'audit-flow-utils-hash',
        },
      ],
    });

    await prisma.traceabilityEvidence.createMany({
      data: [
        { traceabilityLinkId: link1Id, evidenceId: evidence1Id },
        { traceabilityLinkId: link2Id, evidenceId: evidence2Id },
      ],
    });

    return { analysisId, link1Id, link2Id, docId, targetId };
  }

  async function markAnalysisCompleted(analysisId: string) {
    await prisma.impactAnalysis.update({
      where: { id: analysisId },
      data: { status: 'COMPLETED' },
    });
  }

  it('enforces the confidence range for persisted insights and traceability links', async () => {
    const { analysisId, link1Id } = await setupBasicAnalysisWithLinks();
    const insight = await prisma.baInsight.create({
      data: {
        impactAnalysisId: analysisId,
        insightKey: 'confidence-range-check',
        insightType: 'CLAIM',
        certainty: 'INFERRED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 0.5,
        title: 'Confidence range fixture',
        description: 'Persisted confidence must remain within the public contract range.',
      },
    });

    await expect(prisma.baInsight.update({
      where: { id: insight.id },
      data: { confidence: 1.01 },
    })).rejects.toMatchObject({ code: 'P2039' });
    await expect(prisma.traceabilityLink.update({
      where: { id: link1Id },
      data: { confidence: -0.01 },
    })).rejects.toMatchObject({ code: 'P2039' });

    const persistedInsight = await prisma.baInsight.findUniqueOrThrow({ where: { id: insight.id } });
    const persistedLink = await prisma.traceabilityLink.findUniqueOrThrow({ where: { id: link1Id } });
    expect(persistedInsight.confidence).toBe(0.5);
    expect(persistedLink.confidence).toBe(0.9);

    for (const confidence of [0, 1, null]) {
      await prisma.baInsight.update({ where: { id: insight.id }, data: { confidence } });
      await prisma.traceabilityLink.update({ where: { id: link1Id }, data: { confidence } });
    }
  });

  it('preserves zero traceability confidence in the impact graph API response', async () => {
    const { analysisId, link1Id } = await setupBasicAnalysisWithLinks();
    await prisma.traceabilityLink.update({
      where: { id: link1Id },
      data: { confidence: 0 },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/graph`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const graph = impactGraphResponseSchema.parse(response.body);

    expect(graph.edges.find((edge) => edge.id === `edge-trace-${link1Id}`)?.confidence).toBe(0);
  });

  it('serves the reviewed snapshot captured with completion when a newer snapshot is published concurrently', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Approved for report' })
        .expect(200);
    }
    await markAnalysisCompleted(analysisId);
    const firstSnapshotResponse = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    const firstSnapshotId = firstSnapshotResponse.body.id as string;
    await prisma.reviewedReportSnapshot.update({
      where: { id: firstSnapshotId },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    const completion = app.get(GetReviewCompletionUseCase);
    const readCompletion = completion.executeWithReviewDecisions.bind(completion);
    const completionCaptured = createDeferred();
    const releaseCompletion = createDeferred();
    let pauseFirstRead = true;
    const completionSpy = jest.spyOn(completion, 'executeWithReviewDecisions')
      .mockImplementation(async (id) => {
        const result = await readCompletion(id);
        if (pauseFirstRead) {
          pauseFirstRead = false;
          completionCaptured.resolve();
          await releaseCompletion.promise;
        }
        return result;
      });

    try {
      const pendingReport = request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
        .set('Authorization', `Bearer ${adminToken}`);
      const reportResponsePromise = pendingReport.then((response) => response);
      await withDeadline(completionCaptured.promise, 'captured review completion');

      await prisma.$transaction([
        prisma.traceabilityReviewDecision.updateMany({
          where: { traceabilityLinkId: link1Id },
          data: { decision: 'REJECTED' },
        }),
        prisma.traceabilityReviewDecision.updateMany({
          where: { traceabilityLinkId: link2Id },
          data: { decision: 'ACCEPTED' },
        }),
      ]);
      const newSnapshotResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send()
        .expect(201);
      const latestSnapshot = await prisma.reviewedReportSnapshot.findFirstOrThrow({
        where: { analysisId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, reviewDecisionsSnapshot: true },
      });
      expect(latestSnapshot.id).not.toBe(firstSnapshotId);
      expect(latestSnapshot.id).toBe(newSnapshotResponse.body.id);
      expect(latestSnapshot.reviewDecisionsSnapshot)
        .not.toEqual(firstSnapshotResponse.body.reviewDecisionsSnapshot);

      releaseCompletion.resolve();
      const reportResponse = await withDeadline(reportResponsePromise, 'final reviewed report response');
      expect(reportResponse.status).toBe(200);
      expect(reportResponse.body.snapshotId).toBe(firstSnapshotId);
      expect(reportResponse.body.reviewCompletion).toMatchObject({
        latestSnapshotId: firstSnapshotId,
        accepted: 2,
        rejected: 0,
        unreviewed: 0,
      });
      expect(reportResponse.body.reviewDecisionsSnapshot)
        .toEqual(firstSnapshotResponse.body.reviewDecisionsSnapshot);
    } finally {
      releaseCompletion.resolve();
      completionSpy.mockRestore();
    }
  }, 30_000);

  it('scopes the completion snapshot lookup to its analysis', async () => {
    const source = await setupBasicAnalysisWithLinks();
    const foreign = await setupBasicAnalysisWithLinks();
    for (const linkId of [source.link1Id, source.link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Approved for report' })
        .expect(200);
    }
    await markAnalysisCompleted(source.analysisId);
    const sourceSnapshot = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${source.analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    await prisma.reviewedReportSnapshot.update({
      where: { id: sourceSnapshot.body.id },
      data: { approvedDocumentId: source.docId, approvedDocumentAnalysisId: source.analysisId },
    });
    const foreignSnapshot = await prisma.reviewedReportSnapshot.create({
      data: {
        analysisId: foreign.analysisId,
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {
          missingEvidence: 0,
          reviewRequired: 0,
          evidenced: 0,
          inferred: 0,
          weakEvidence: 0,
        },
      },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${source.analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .expect(({ body }) => expect(body.snapshotId).toBe(sourceSnapshot.body.id));

    const completion = app.get(GetReviewCompletionUseCase);
    const readCompletion = completion.executeWithReviewDecisions.bind(completion);
    const completionSpy = jest.spyOn(completion, 'executeWithReviewDecisions')
      .mockImplementationOnce(async (analysisId) => {
        const result = await readCompletion(analysisId);
        return {
          ...result,
          completion: { ...result.completion, latestSnapshotId: foreignSnapshot.id },
        };
      });
    try {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${source.analysisId}/final-reviewed-report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
      expect(response.body.code).toBe('REPORT_PROVENANCE_MISMATCH');
      expect(response.body).not.toHaveProperty('markdown');
    } finally {
      completionSpy.mockRestore();
    }
  });

  it('rejects a document job whose analysis does not own its reviewed snapshot', async () => {
    const { analysisId } = await setupBasicAnalysisWithLinks();
    const sourceAnalysis = await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: analysisId },
    });
    const otherAnalysisId = crypto.randomUUID();
    await prisma.impactAnalysis.create({
      data: {
        id: otherAnalysisId,
        requirementRevisionId: sourceAnalysis.requirementRevisionId,
        requirementId: sourceAnalysis.requirementId,
        projectId: sourceAnalysis.projectId,
        repositoryId: sourceAnalysis.repositoryId,
        snapshotId: sourceAnalysis.snapshotId,
        sourceTargetId: sourceAnalysis.sourceTargetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    const foreignSnapshot = await prisma.reviewedReportSnapshot.create({
      data: {
        analysisId: otherAnalysisId,
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {
          missingEvidence: 0,
          reviewRequired: 0,
          evidenced: 0,
          inferred: 0,
          weakEvidence: 0,
        },
      },
    });

    await expect(prisma.documentJob.create({
      data: {
        analysisId,
        snapshotId: foreignSnapshot.id,
        documentType: 'IMPACT_REPORT',
        status: 'QUEUED',
      },
    })).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects a review decision whose analysis does not own its traceability link', async () => {
    const source = await setupBasicAnalysisWithLinks();
    const foreign = await setupBasicAnalysisWithLinks();

    await expect(prisma.traceabilityReviewDecision.create({
      data: {
        analysisId: foreign.analysisId,
        traceabilityLinkId: source.link1Id,
        decision: 'ACCEPTED',
      },
    })).rejects.toMatchObject({ code: 'P2003' });
  });

  it.each(['insight', 'traceability link'] as const)(
    'rejects a review note whose analysis does not own its %s',
    async (targetKind) => {
      const source = await setupBasicAnalysisWithLinks();
      const foreign = await setupBasicAnalysisWithLinks();
      const insight = targetKind === 'insight'
        ? await prisma.baInsight.create({
            data: {
              impactAnalysisId: source.analysisId,
              insightKey: `scope-check-${crypto.randomUUID()}`,
              insightType: 'UNKNOWN',
              certainty: 'UNKNOWN',
              reviewStatus: 'NEEDS_REVIEW',
              title: 'Scope check',
              description: 'Review note ownership fixture.',
            },
          })
        : null;

      let failure: unknown;
      let createdNoteId: string | undefined;
      try {
        const created = await prisma.reviewNote.create({
          data: {
            impactAnalysisId: foreign.analysisId,
            insightId: insight?.id,
            traceabilityLinkId: targetKind === 'traceability link' ? source.link1Id : undefined,
            body: 'This note must not cross analysis boundaries.',
          },
        });
        createdNoteId = created.id;
      } catch (error) {
        failure = error;
      } finally {
        if (createdNoteId) await prisma.reviewNote.delete({ where: { id: createdNoteId } });
      }
      expect(failure).toMatchObject({ code: 'P2003' });
    },
  );

  it.each(['no target', 'both targets'] as const)(
    'rejects a review note with %s',
    async (targetShape) => {
      const fixture = await setupBasicAnalysisWithLinks();
      const insight = targetShape === 'both targets'
        ? await prisma.baInsight.create({
            data: {
              impactAnalysisId: fixture.analysisId,
              insightKey: `exactly-one-${crypto.randomUUID()}`,
              insightType: 'UNKNOWN',
              certainty: 'UNKNOWN',
              reviewStatus: 'NEEDS_REVIEW',
              title: 'Exactly one target',
              description: 'Review note target cardinality fixture.',
            },
          })
        : null;
      let failure: unknown;
      let createdNoteId: string | undefined;
      try {
        const created = await prisma.reviewNote.create({
          data: {
            impactAnalysisId: fixture.analysisId,
            insightId: insight?.id,
            traceabilityLinkId: targetShape === 'both targets' ? fixture.link1Id : undefined,
            body: 'Review notes require exactly one target.',
          },
        });
        createdNoteId = created.id;
      } catch (error) {
        failure = error;
      } finally {
        if (createdNoteId) await prisma.reviewNote.delete({ where: { id: createdNoteId } });
      }
      expect(failure).toMatchObject({ code: 'P2039' });
    },
  );

  it('complete reviewed flow returns final report', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();

    // 1. Assign ACCEPTED to both links
    const putRes = await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'ok' });
      
    if (putRes.status !== 200) {
      console.warn(putRes.body);
    }
    expect(putRes.status).toBe(200);

    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'ok' })
      .expect(200);

    await markAnalysisCompleted(analysisId);

    // 2. Create snapshot
    const snapRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
      

    expect(snapRes.status).toBe(201);
    const createdSnapshot = reviewedReportSnapshotSchema.parse(snapRes.body);
    expect(createdSnapshot.analysisId).toBe(analysisId);
    await prisma.reviewedReportSnapshot.update({
      where: { id: createdSnapshot.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });
    const legacySnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
      where: { id: createdSnapshot.id },
    });
    const legacyDocument = await prisma.generatedDocument.findUniqueOrThrow({
      where: { id: docId },
    });
    expect(legacySnapshot).toMatchObject({ markdown: null, approvedDocumentId: docId });
    expect(legacyDocument.reviewedReportSnapshotId).toBeNull();
    expect(await prisma.documentJob.count({ where: { snapshotId: createdSnapshot.id } })).toBe(0);

    const latestSnapshotRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot/latest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const latestSnapshot = reviewedReportSnapshotSchema.parse(latestSnapshotRes.body);
    expect(latestSnapshot).toMatchObject({
      id: createdSnapshot.id,
      analysisId,
      approvedDocumentId: docId,
    });

    // 3. Review completion gate
    const compRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/review-completion`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(compRes.body.isComplete).toBe(true);
    expect(compRes.body.totalLinks).toBe(2);
    expect(compRes.body.accepted).toBe(2);
    expect(compRes.body.unreviewed).toBe(0);

    // 4. Fetch final report
    const finalRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const finalReport = finalReviewedReportResponseSchema.parse(finalRes.body);
    expect(finalReport.markdown).toBe('# Live Generated Report');
    expect(finalReport.locale).toBe('en');
    expect(finalReport.snapshotId).toBe(createdSnapshot.id);
    expect(finalReport.reviewCompletion.isComplete).toBe(true);

    const approvedRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const repositorySnapshotId = (await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: analysisId },
      select: { snapshotId: true },
    })).snapshotId;
    expect(finalReport.snapshotId).toBe(createdSnapshot.id);
    expect(approvedImpactReportResponseSchema.parse(approvedRes.body)).toMatchObject({
      id: docId,
      impactAnalysisId: analysisId,
      snapshotId: repositorySnapshotId,
      markdown: '# Live Generated Report',
      status: 'APPROVED',
      provenance: { snapshotId: repositorySnapshotId },
    });
    const legacyExport = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(legacyExport.text).toBe('# Live Generated Report');

    const contextReader = app.get(ApprovedReportContextReader);
    const context = await contextReader.readContext(analysisId);
    await prisma.localizedReportArtifact.create({
      data: {
        sourceDocumentId: docId,
        locale: 'vi-VN',
        sourceLocale: 'en',
        localizationStatus: 'COMPLETED',
        contentMarkdown: '# Báo cáo đã duyệt\n\n## Phụ lục bằng chứng',
        sourceContentHash: context.sourceContentHash,
        provider: 'deterministic-e2e',
      },
    });

    const vietnameseRes = await request(app.getHttpServer())
      .get(
        `/api/v1/impact-analyses/${analysisId}/final-reviewed-report?locale=vi-VN`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(vietnameseRes.body).toMatchObject({
      analysisId,
      locale: 'vi-VN',
      markdown: '# Báo cáo đã duyệt\n\n## Phụ lục bằng chứng',
    });
    expect(vietnameseRes.body.snapshotId).toBe(finalRes.body.snapshotId);
    await prisma.localizedReportArtifact.delete({
      where: {
        sourceDocumentId_locale: { sourceDocumentId: docId, locale: 'vi-VN' },
      },
    });

    const localizationResponse = await request(app.getHttpServer())
      .post(`/api/v1/analyses/${analysisId}/localization`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ locale: 'vi-VN' });
    if (localizationResponse.status !== 201) {
      throw new Error(
        `Expected localization to succeed, received ${localizationResponse.status}: ${JSON.stringify(localizationResponse.body)}`,
      );
    }
    const localizedArtifact = localizedReportArtifactSchema.parse(
      localizationResponse.body,
    );
    expect(localizedArtifact).toMatchObject({
      sourceDocumentId: docId,
      locale: 'vi-VN',
      sourceLocale: 'en',
      localizationStatus: 'COMPLETED',
      provider: 'FakeTranslationProvider',
    });
    expect(localizedArtifact.contentMarkdown).toBeTruthy();

    const persistedArtifact = await prisma.localizedReportArtifact.findUniqueOrThrow({
      where: {
        sourceDocumentId_locale: { sourceDocumentId: docId, locale: 'vi-VN' },
      },
    });
    expect(persistedArtifact).toMatchObject({
      id: localizedArtifact.id,
      sourceContentHash: localizedArtifact.sourceContentHash,
      contentMarkdown: localizedArtifact.contentMarkdown,
      localizationStatus: 'COMPLETED',
    });

    const localizationStatus = await request(app.getHttpServer())
      .get(`/api/v1/analyses/${analysisId}/localization/vi-VN/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(localizationStatusResponseSchema.parse(localizationStatus.body)).toMatchObject({
      status: 'READY',
      locale: 'vi-VN',
      sourceDocumentId: docId,
    });

    const localizedReportResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report?locale=vi-VN`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const localizedReport = finalReviewedReportResponseSchema.parse(
      localizedReportResponse.body,
    );
    expect(localizedReport).toMatchObject({
      analysisId,
      locale: 'vi-VN',
      markdown: localizedArtifact.contentMarkdown,
      snapshotId: createdSnapshot.id,
    });
    await expect(prisma.reviewedReportSnapshot.findUniqueOrThrow({
      where: { id: createdSnapshot.id },
      select: { markdown: true },
    })).resolves.toEqual({ markdown: null });
  });

  it('hides approved report reads and mutations from users outside the project', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED' })
        .expect(200);
    }
    await markAnalysisCompleted(analysisId);

    const snapshotResponse = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    const snapshot = reviewedReportSnapshotSchema.parse(snapshotResponse.body);
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshot.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const outsider = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: `report-outsider-${crypto.randomUUID()}@ba-helper.local`,
        role: 'REVIEWER',
      },
    });
    const outsiderToken = jwtService.sign({
      sub: outsider.id,
      email: outsider.email,
      role: outsider.role,
    });
    const domainEventsBefore = await prisma.domainEvent.count();
    const documentJobsBefore = await prisma.documentJob.count({ where: { analysisId } });
    const reportPaths = [
      `/api/v1/impact-analyses/${analysisId}/documents`,
      `/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot/latest`,
      `/api/v1/impact-analyses/${analysisId}/review-completion`,
      `/api/v1/impact-analyses/${analysisId}/final-reviewed-report`,
      `/api/v1/impact-analyses/${analysisId}/approved-report`,
      `/api/v1/impact-analyses/${analysisId}/approved-report/export.md`,
      `/api/v1/impact-analyses/${analysisId}/approved-report/export.pdf`,
    ];

    for (const path of reportPaths) {
      const response = await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);
      expect(`${response.text}${JSON.stringify(response.body)}`)
        .not.toContain('# Live Generated Report');
    }
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send()
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ requestKey: crypto.randomUUID() })
      .expect(404);

    expect(await prisma.reviewedReportSnapshot.count({ where: { analysisId } })).toBe(1);
    expect(await prisma.documentJob.count({ where: { analysisId } })).toBe(documentJobsBefore);
    expect(await prisma.domainEvent.count()).toBe(domainEventsBefore);
  });

  it('scopes approved-report context to its repository snapshot and requirement revision', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED' })
        .expect(200);
    }
    await markAnalysisCompleted(analysisId);
    const snapshot = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshot.body.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    const analysis = await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: analysisId }, select: { snapshotId: true, requirementRevisionId: true },
    });
    const foreignProject = await prisma.project.create({ data: { name: 'Foreign report-context project' } });
    const foreignRepository = await prisma.repository.create({
      data: { projectId: foreignProject.id, canonicalUrl: 'https://github.com/mock/foreign-report-context' },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: foreignRepository.id, commitSha: 'foreign-report-context-commit',
        analyzerVersion: 'analyzer@1.0.0', coverageStatus: 'READY' },
    });
    const foreignArtifact = await prisma.codeArtifact.create({
      data: { snapshotId: foreignSnapshot.id, artifactKey: 'private:report-refund',
        name: 'ForeignReportRefund', artifactType: 'SERVICE', filePath: 'src/private/report-refund.ts' },
    });
    const foreignEvidence = await prisma.evidence.create({
      data: { provenanceKey: 'foreign-report-context-evidence', sourceType: 'CODE',
        snapshotId: foreignSnapshot.id, artifactId: foreignArtifact.id,
        requirementRevisionId: analysis.requirementRevisionId, sourcePath: 'src/private/report-refund.ts',
        excerpt: 'FOREIGN REPORT CONTEXT SOURCE', contentHash: 'foreign-report-context-hash' },
    });
    await prisma.traceabilityEvidence.create({ data: { traceabilityLinkId: link1Id, evidenceId: foreignEvidence.id } });
    const insight = await prisma.baInsight.create({
      data: { impactAnalysisId: analysisId, insightKey: 'report-context-check', insightType: 'UNKNOWN',
        certainty: 'UNKNOWN', reviewStatus: 'NEEDS_REVIEW', title: 'Report context check',
        description: 'Scoped report evidence check.' },
    });
    await prisma.insightEvidence.create({ data: { insightId: insight.id, evidenceId: foreignEvidence.id } });
    await expect(prisma.traceabilityLink.create({
      data: { impactAnalysisId: analysisId, snapshotId: analysis.snapshotId, artifactId: foreignArtifact.id,
        linkType: 'AFFECTED', linkBasis: 'INFERRED', reviewStatus: 'NEEDS_REVIEW' },
    })).rejects.toMatchObject({ code: 'P2003' });

    const context = await app.get(ApprovedReportContextReader).readContext(analysisId, snapshot.body.id);
    const serializedContext = JSON.stringify(context.canonicalContext);
    expect(serializedContext).not.toContain('FOREIGN REPORT CONTEXT SOURCE');
    expect(serializedContext).not.toContain('ForeignReportRefund');
    expect(serializedContext).not.toContain('src/private/report-refund.ts');
  });

  it('unreviewed link blocks final report', async () => {
    const { analysisId, link1Id } = await setupBasicAnalysisWithLinks();

    // Assign decision to only ONE link
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    await markAnalysisCompleted(analysisId);

    // Force create snapshot from a completed analysis with incomplete review coverage.
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);

    // Attempt to fetch final report
    const res = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);


    expect(res.body.code).toBe('REVIEW_COMPLETION_REQUIRED');
    expect(res.body.details?.blockingReasons || res.body.metadata?.blockingReasons).toContain('UNREVIEWED_TRACEABILITY_LINKS');
  });

  it('missing snapshot blocks final report', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();

    // Assign decisions to ALL links
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    // Do NOT create snapshot

    // Attempt to fetch final report
    const res = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);


    expect(res.body.code).toBe('REVIEW_COMPLETION_REQUIRED');
    expect(res.body.details?.blockingReasons || res.body.metadata?.blockingReasons).toContain('REVIEWED_SNAPSHOT_MISSING');
  });

  it('rejects a final report when live review counts contradict its frozen snapshot', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();

    // 1. Assign ACCEPTED to both links
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    await markAnalysisCompleted(analysisId);

    // 2. Create snapshot
    const snapshotRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshotRes.body.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    // 3. Mutate one link to REJECTED after snapshot.
    // Bypass the API because completed analyses reject review mutation.
    await prisma.traceabilityReviewDecision.updateMany({
      where: { traceabilityLinkId: link2Id },
      data: { decision: 'REJECTED' },
    });

    // Note: Mutating the decision does not clear the snapshot, and because all links still have a decision, isComplete remains true.
    const finalRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(finalRes.status).toBe(409);
    expect(finalRes.body.code).toBe('REPORT_PROVENANCE_MISMATCH');

    const persistedSnapshot = await prisma.reviewedReportSnapshot.findUnique({
      where: { id: snapshotRes.body.id },
    });
    const decisionsArray = persistedSnapshot?.reviewDecisionsSnapshot as any[];
    expect(decisionsArray).toHaveLength(2);
    expect(decisionsArray.every(d => d.reviewDecision?.decision === 'ACCEPTED')).toBe(true);
  });

  it('rejects a final report when live decisions change identity but preserve the frozen totals', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED' })
      .expect(200);

    await markAnalysisCompleted(analysisId);
    const snapshotRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshotRes.body.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    await prisma.traceabilityReviewDecision.updateMany({
      where: { traceabilityLinkId: link1Id },
      data: { decision: 'REJECTED' },
    });
    await prisma.traceabilityReviewDecision.updateMany({
      where: { traceabilityLinkId: link2Id },
      data: { decision: 'ACCEPTED' },
    });

    const finalRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(finalRes.status).toBe(409);
    expect(finalRes.body.code).toBe('REPORT_PROVENANCE_MISMATCH');
  });

  it('fails closed when review decisions are swapped after the report read captures them but before it selects the snapshot', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED' })
      .expect(200);
    await markAnalysisCompleted(analysisId);
    const firstSnapshot = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    await prisma.reviewedReportSnapshot.update({
      where: { id: firstSnapshot.body.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    const completionUseCase = app.get(GetReviewCompletionUseCase);
    const traceabilityRepository = (completionUseCase as unknown as {
      repository: TraceabilityRepository;
    }).repository;
    const listLinks = traceabilityRepository.listByAnalysis.bind(traceabilityRepository);
    const linksCaptured = createDeferred();
    const releaseLinks = createDeferred();
    let pauseFirstQuery = true;
    const listSpy = jest.spyOn(traceabilityRepository, 'listByAnalysis').mockImplementation(async (id) => {
      const links = await listLinks(id);
      if (pauseFirstQuery) {
        pauseFirstQuery = false;
        linksCaptured.resolve();
        await releaseLinks.promise;
      }
      return links;
    });

    try {
      const reportResponsePromise = request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .then((response) => response);
      await withDeadline(Promise.race([
        linksCaptured.promise,
        reportResponsePromise.then((response) => {
          throw new Error(`Final report returned ${response.status} before the review query was captured: ${JSON.stringify(response.body)}`);
        }),
      ]), 'the first PostgreSQL review-decision query');

      // The review API rejects changes after finalization. Write directly to
      // PostgreSQL to model concurrent or legacy drift while the report read is
      // between its live-review and latest-snapshot queries; totals stay equal.
      await prisma.$transaction([
        prisma.traceabilityReviewDecision.updateMany({
          where: { traceabilityLinkId: link1Id },
          data: { decision: 'REJECTED' },
        }),
        prisma.traceabilityReviewDecision.updateMany({
          where: { traceabilityLinkId: link2Id },
          data: { decision: 'ACCEPTED' },
        }),
      ]);
      const replacementSnapshot = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send()
        .expect(201);
      expect(replacementSnapshot.body.id).not.toBe(firstSnapshot.body.id);
      await prisma.reviewedReportSnapshot.update({
        where: { id: replacementSnapshot.body.id },
        data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
      });

      releaseLinks.resolve();
      const reportResponse = await withDeadline(reportResponsePromise, 'the final reviewed report response');
      expect({ status: reportResponse.status, code: reportResponse.body.code }).toEqual({
        status: 409,
        code: 'REPORT_PROVENANCE_MISMATCH',
      });
      expect(reportResponse.body).not.toHaveProperty('markdown');
    } finally {
      releaseLinks.resolve();
      listSpy.mockRestore();
    }
  }, 30_000);

  it('rejects malformed frozen review data on snapshot and final report APIs', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED' })
        .expect(200);
    }
    await markAnalysisCompleted(analysisId);
    const snapshotResponse = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);

    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshotResponse.body.id },
      data: { reviewDecisionsSnapshot: [] },
    });

    const latestSnapshotResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot/latest`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(latestSnapshotResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');

    const finalReportResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(finalReportResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');
  });

  it('rejects a snapshot linked to an approved document from another analysis', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED' })
        .expect(200);
    }
    await markAnalysisCompleted(analysisId);
    const snapshotResponse = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);

    const sourceAnalysis = await prisma.impactAnalysis.findUniqueOrThrow({ where: { id: analysisId } });
    const otherAnalysisId = crypto.randomUUID();
    await prisma.impactAnalysis.create({
      data: {
        id: otherAnalysisId,
        requirementRevisionId: sourceAnalysis.requirementRevisionId,
        requirementId: sourceAnalysis.requirementId,
        projectId: sourceAnalysis.projectId,
        repositoryId: sourceAnalysis.repositoryId,
        snapshotId: sourceAnalysis.snapshotId,
        sourceTargetId: sourceAnalysis.sourceTargetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });
    const otherDocument = await prisma.generatedDocument.create({
      data: {
        impactAnalysisId: otherAnalysisId,
        type: 'IMPACT_REPORT',
        status: 'APPROVED',
        content: '# Report from a different analysis',
      },
    });
    await expect(prisma.reviewedReportSnapshot.update({
      where: { id: snapshotResponse.body.id },
      data: {
        approvedDocumentId: otherDocument.id,
        approvedDocumentAnalysisId: analysisId,
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    const persistedSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
      where: { id: snapshotResponse.body.id },
      select: { approvedDocumentId: true },
    });
    expect(persistedSnapshot.approvedDocumentId).toBeNull();

    const reportResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportResponse.status).toBe(409);
    expect(JSON.stringify(reportResponse.body)).not.toContain('Report from a different analysis');
    const contextReader = app.get(ApprovedReportContextReader);
    await expect(contextReader.readContext(analysisId, snapshotResponse.body.id))
      .rejects.toThrow('Approved impact report not found');
  });

  it('snapshot remains immutable after review decision changes', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED' })
        .expect(200);
    }

    await markAnalysisCompleted(analysisId);
    const snapshotResponse = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshotResponse.body.id },
      data: { approvedDocumentId: docId, approvedDocumentAnalysisId: analysisId },
    });

    await prisma.traceabilityReviewDecision.updateMany({
      where: { traceabilityLinkId: link2Id },
      data: { decision: 'REJECTED' },
    });

    const frozenSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
      where: { id: snapshotResponse.body.id },
    });
    const decisions = frozenSnapshot.reviewDecisionsSnapshot as Array<{
      reviewDecision?: { decision?: string };
    }>;
    expect(decisions).toHaveLength(2);
    expect(decisions.every(item => item.reviewDecision?.decision === 'ACCEPTED')).toBe(true);

    const finalResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(finalResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');
  });

  it('GeneratedDocument markdown reflects the snapshot payload, not the live mutated state', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(RunDocumentJobUseCase);

    // 1. Assign ACCEPTED to both links
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'Looks good' })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'Looks good' })
      .expect(200);

    // 2. Finalize to create Snapshot AND DocumentJob
    const finalizeRes = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ acknowledgeUnreviewed: true })
      .expect(201);

    expect(finalizeRes.body.status).toBe('COMPLETED');

    // 3. Mutate live DB (change one decision to REJECTED) AFTER snapshot is created
    // We must bypass the API because the analysis is COMPLETED and the API will reject it.
    await prisma.traceabilityReviewDecision.updateMany({
      where: { traceabilityLinkId: link2Id },
      data: { decision: 'REJECTED', note: 'Actually no' },
    });

    // 4. Run the DocumentJob (this simulates the async worker)
    const documentJob = await prisma.documentJob.findFirst({
      where: { analysisId, documentType: 'IMPACT_REPORT' },
    });
    expect(documentJob).toBeDefined();
    await runDocumentJob.execute({ documentJobId: documentJob!.id });

    // 5. Fetch the finalized document markdown
    const exportRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const markdown = exportRes.text;

    const reviewedSnapshot = await prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
    });
    expect(reviewedSnapshot?.markdown).toBe(markdown);

    // The markdown should contain the original ACCEPTED decisions from the snapshot
    expect(markdown).toContain('Confirmed'); // Corresponds to ACCEPTED in traceability section
    expect(markdown).not.toContain('REJECTED'); // Should not reflect the live mutation
    expect(markdown).not.toContain('Actually no'); // Should not reflect the live mutated note
  });

  it('serializes concurrent clarification answers with the reviewed report snapshot', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(RunDocumentJobUseCase);
    const createSnapshot = app.get(CreateReviewedReportSnapshotUseCase);
    const enqueue = jest.spyOn(app.get(QueueService), 'enqueueDocumentJob')
      .mockResolvedValue(undefined);
    const reviewDecision = await prisma.analysisReviewDecision.create({
      data: {
        id: crypto.randomUUID(),
        analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: adminUserId,
      },
    });
    const question = 'Does refund processing wait for settlement reversal?';
    const answer = 'Refunds start only after settlement reversal succeeds.';
    const snapshotBuildStarted = createDeferred();
    const releaseSnapshotBuild = createDeferred();
    const originalBuild = createSnapshot.buildSnapshotCreateData.bind(createSnapshot);
    const snapshotBuild = jest.spyOn(createSnapshot, 'buildSnapshotCreateData')
      .mockImplementation(async params => {
        const data = await originalBuild(params);
        snapshotBuildStarted.resolve();
        await releaseSnapshotBuild.promise;
        return data;
      });
    let finalizePromise: Promise<any> | undefined;
    let answerPromise: Promise<any> | undefined;
    let answerSettledBeforeFinalize = false;

    try {
      for (const linkId of [link1Id, link2Id]) {
        await request(app.getHttpServer())
          .put(`/api/v1/traceability-links/${linkId}/review-decision`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ decision: 'ACCEPTED', note: 'Reviewed' })
          .expect(200);
      }

      const created = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewDecisionId: reviewDecision.id, question })
        .expect(201);

      finalizePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .expect(201)
        .then(response => response);

      await withDeadline(snapshotBuildStarted.promise, 'finalization snapshot content read');
      answerPromise = request(app.getHttpServer())
        .post(`/api/v1/review-clarifications/${created.body.id}/answer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ answer })
        .expect(201)
        .then(response => {
          answerSettledBeforeFinalize = true;
          return response;
        });
      await waitForClarificationAnalysisLock(prisma);
      expect(answerSettledBeforeFinalize).toBe(false);

      releaseSnapshotBuild.resolve();
      const [finalized, answered] = await Promise.all([finalizePromise, answerPromise]);
      expect(finalized.body.status).toBe('COMPLETED');
      expect(answered.body).toMatchObject({ id: created.body.id, answer, status: 'ANSWERED' });

      const snapshotResponse = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot/latest`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const frozenSnapshot = reviewedReportSnapshotSchema.parse(snapshotResponse.body);
      expect(frozenSnapshot.clarificationsSnapshot).toEqual([
        expect.objectContaining({ id: created.body.id, question, answer: null, status: 'OPEN' }),
      ]);

      const documentJob = await prisma.documentJob.findFirstOrThrow({
        where: { analysisId, documentType: 'IMPACT_REPORT' },
      });
      await runDocumentJob.execute({ documentJobId: documentJob.id });

      const exportRes = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(exportRes.text).toContain(question);
      expect(exportRes.text).not.toContain(answer);
      expect(exportRes.text).toContain('Still Open');

      const finalReportResponse = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const finalReport = finalReviewedReportResponseSchema.parse(finalReportResponse.body);
      expect(finalReport.clarificationsSnapshot).toEqual([
        expect.objectContaining({ id: created.body.id, question, answer: null, status: 'OPEN' }),
      ]);

      const clarificationAfterAnswer = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/review-clarifications`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(clarificationAfterAnswer.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: created.body.id, answer, status: 'ANSWERED' }),
        ]),
      );
    } finally {
      releaseSnapshotBuild.resolve();
      enqueue.mockRestore();
      snapshotBuild.mockRestore();
      await Promise.allSettled([finalizePromise, answerPromise].filter(Boolean) as Promise<any>[]);
    }
  });

  it('preserves the previous report and localization when a newer snapshot is retried', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(RunDocumentJobUseCase);
    const enqueue = jest.spyOn(app.get(QueueService), 'enqueueDocumentJob')
      .mockResolvedValue(undefined);
    const triggerName = 'fail_test_reviewed_report_snapshot_publish';
    const functionName = 'fail_test_reviewed_report_snapshot_publish';

    try {
      for (const linkId of [link1Id, link2Id]) {
        await request(app.getHttpServer())
          .put(`/api/v1/traceability-links/${linkId}/review-decision`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ decision: 'ACCEPTED', note: 'Approved for the first report' })
          .expect(200);
      }

      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .expect(201);

      const firstJob = await prisma.documentJob.findFirstOrThrow({
        where: { analysisId, documentType: 'IMPACT_REPORT' },
      });
      await runDocumentJob.execute({ documentJobId: firstJob.id });
      const firstSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: firstJob.snapshotId },
      });
      const previousMarkdown = firstSnapshot.markdown;
      const firstDocumentId = firstSnapshot.approvedDocumentId;
      expect(previousMarkdown).toContain('Confirmed');
      expect(firstDocumentId).toBeTruthy();
      await prisma.localizedReportArtifact.create({
        data: {
          sourceDocumentId: firstDocumentId!,
          locale: 'vi-VN',
          sourceLocale: 'en',
          localizationStatus: 'COMPLETED',
          contentMarkdown: '# Bản dịch của báo cáo S1',
          sourceContentHash: 's1-source-hash',
          updatedAt: new Date(),
        },
      });

      await prisma.traceabilityReviewDecision.updateMany({
        where: { traceabilityLinkId: link2Id },
        data: { decision: 'REJECTED', note: 'Changed before the next report' },
      });

      const snapshotResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send()
        .expect(201);
      const secondSnapshotId = snapshotResponse.body.id as string;
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ requestKey: crypto.randomUUID() })
        .expect(201);
      const secondJob = await prisma.documentJob.findUniqueOrThrow({
        where: {
          snapshotId_documentType: {
            snapshotId: secondSnapshotId,
            documentType: 'IMPACT_REPORT',
          },
        },
      });

      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger
        LANGUAGE plpgsql AS $test$
        BEGIN
          RAISE EXCEPTION 'injected reviewed report snapshot publish failure';
        END;
        $test$;
      `);
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER ${triggerName}
        BEFORE UPDATE ON reviewed_report_snapshot
        FOR EACH ROW EXECUTE FUNCTION ${functionName}();
      `);

      try {
        await expect(runDocumentJob.execute({ documentJobId: secondJob.id }))
          .rejects.toThrow('injected reviewed report snapshot publish failure');
      } finally {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON reviewed_report_snapshot;`);
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}();`);
      }

      const documentAfterFailure = await prisma.generatedDocument.findUniqueOrThrow({ where: { id: firstDocumentId! } });
      const snapshotAfterFailure = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: secondSnapshotId },
      });
      const failedJob = await prisma.documentJob.findUniqueOrThrow({ where: { id: secondJob.id } });
      expect(documentAfterFailure.content).toBe(previousMarkdown);
      expect(snapshotAfterFailure.markdown).toBeNull();
      expect(failedJob.status).toBe('FAILED');

      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ retry: true, requestKey: crypto.randomUUID() })
        .expect(201);
      await runDocumentJob.execute({ documentJobId: secondJob.id });

      const publishedSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: secondSnapshotId },
      });
      const publishedDocumentId = publishedSnapshot.approvedDocumentId;
      expect(publishedDocumentId).toBeTruthy();
      expect(publishedDocumentId).not.toBe(firstDocumentId);
      const firstDocument = await prisma.generatedDocument.findUniqueOrThrow({ where: { id: firstDocumentId! } });
      const publishedDocument = await prisma.generatedDocument.findUniqueOrThrow({
        where: { id: publishedDocumentId! },
      });
      const secondGenerationCount = await prisma.generatedDocument.count({
        where: {
          reviewedReportSnapshotId: secondSnapshotId,
          type: 'IMPACT_REPORT',
          status: 'APPROVED',
        },
      });
      const preservedLocalization = await prisma.localizedReportArtifact.findUniqueOrThrow({
        where: { sourceDocumentId_locale: { sourceDocumentId: firstDocumentId!, locale: 'vi-VN' } },
      });
      const preservedSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: firstSnapshot.id },
      });
      expect(publishedSnapshot.markdown).not.toBe(previousMarkdown);
      expect(publishedSnapshot.markdown).toContain('Rejected');
      expect(firstDocument.reviewedReportSnapshotId).toBe(firstSnapshot.id);
      expect(publishedDocument.content).toBe(publishedSnapshot.markdown);
      expect(publishedDocument.reviewedReportSnapshotId).toBe(secondSnapshotId);
      expect(secondGenerationCount).toBe(1);
      expect(firstDocument.content).toBe(previousMarkdown);
      expect(preservedLocalization.contentMarkdown).toBe('# Bản dịch của báo cáo S1');
      expect(preservedSnapshot.markdown).toBe(previousMarkdown);

      const finalReport = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(finalReport.body.markdown).toBe(publishedSnapshot.markdown);

      const approvedReportExport = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(approvedReportExport.text).toBe(publishedSnapshot.markdown);

      const latestLocalizationStatus = await request(app.getHttpServer())
        .get(`/api/v1/analyses/${analysisId}/localization/vi-VN/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(latestLocalizationStatus.body).toMatchObject({
        status: 'NOT_TRANSLATED',
        sourceDocumentId: publishedDocumentId,
      });
    } finally {
      enqueue.mockRestore();
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON reviewed_report_snapshot;`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${functionName}();`);
    }
  });

  it('does not let a late failed worker overwrite a completed document job', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(RunDocumentJobUseCase);
    const contextAdapter = app.get(ReviewedSnapshotReportContextAdapter);
    const enqueue = jest.spyOn(app.get(QueueService), 'enqueueDocumentJob')
      .mockResolvedValue(undefined);
    const firstWorkerEnteredContext = createDeferred();
    const releaseFirstWorker = createDeferred();
    const contextSpy = jest.spyOn(contextAdapter, 'buildContext').mockImplementationOnce(async () => {
      firstWorkerEnteredContext.resolve();
      await releaseFirstWorker.promise;
      throw new Error('injected late worker failure');
    });

    try {
      for (const linkId of [link1Id, link2Id]) {
        await request(app.getHttpServer())
          .put(`/api/v1/traceability-links/${linkId}/review-decision`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ decision: 'ACCEPTED', note: 'Approved for report generation' })
          .expect(200);
      }
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .expect(201);

      const documentJob = await prisma.documentJob.findFirstOrThrow({
        where: { analysisId, documentType: 'IMPACT_REPORT' },
      });
      const delayedWorker = runDocumentJob.execute({
        documentJobId: documentJob.id,
        attemptNumber: 1,
        maxAttempts: 1,
      }).then(
        () => ({ error: null as unknown }),
        (error: unknown) => ({ error }),
      );
      await withDeadline(firstWorkerEnteredContext.promise, 'first document worker context');

      await expect(runDocumentJob.execute({
        documentJobId: documentJob.id,
        attemptNumber: 2,
        maxAttempts: 3,
      })).resolves.toMatchObject({ success: true });
      releaseFirstWorker.resolve();
      const delayedOutcome = await withDeadline(delayedWorker, 'delayed document worker failure');
      expect(delayedOutcome.error).toBeInstanceOf(Error);

      const persisted = await prisma.documentJob.findUniqueOrThrow({ where: { id: documentJob.id } });
      const snapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: documentJob.snapshotId },
      });
      expect(persisted.status).toBe('COMPLETED');
      expect(persisted.generatedDocumentId).toBe(snapshot.approvedDocumentId);
      expect(snapshot.markdown).toContain('Confirmed');
      expect(await prisma.generatedDocument.count({
        where: { reviewedReportSnapshotId: snapshot.id, status: 'APPROVED' },
      })).toBe(1);
    } finally {
      releaseFirstWorker.resolve();
      contextSpy.mockRestore();
      enqueue.mockRestore();
    }
  }, 30_000);

  it('does not reopen a completed job when a stale startup read resumes', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(RunDocumentJobUseCase);
    const contextAdapter = app.get(ReviewedSnapshotReportContextAdapter);
    const enqueue = jest.spyOn(app.get(QueueService), 'enqueueDocumentJob')
      .mockResolvedValue(undefined);
    let resumeStaleRead: ReturnType<typeof createDeferred> | undefined;
    let restoreDatabaseSpies: (() => void) | undefined;
    let staleWorker: Promise<unknown> | undefined;

    try {
      for (const linkId of [link1Id, link2Id]) {
        await request(app.getHttpServer())
          .put(`/api/v1/traceability-links/${linkId}/review-decision`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ decision: 'ACCEPTED', note: 'Approved for report generation' })
          .expect(200);
      }
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .expect(201);

      const documentJob = await prisma.documentJob.findFirstOrThrow({
        where: { analysisId, documentType: 'IMPACT_REPORT' },
      });
      const readReturnedStaleState = createDeferred();
      const resumeStaleReadGate = createDeferred();
      resumeStaleRead = resumeStaleReadGate;
      const documentJobDelegate = prisma.documentJob as unknown as {
        findUnique: (args: { where: { id: string } }) => Promise<unknown>;
      };
      const findUnique = documentJobDelegate.findUnique.bind(documentJobDelegate);
      let pauseFirstRead = true;
      const findUniqueSpy = jest.spyOn(documentJobDelegate, 'findUnique')
        .mockImplementation(async (args) => {
          const result = await findUnique(args);
          if (args.where.id === documentJob.id && pauseFirstRead) {
            pauseFirstRead = false;
            readReturnedStaleState.resolve();
            await resumeStaleReadGate.promise;
          }
          return result;
        });

      let failTheStaleWorker = false;
      const buildContext = contextAdapter.buildContext.bind(contextAdapter);
      const contextSpy = jest.spyOn(contextAdapter, 'buildContext')
        .mockImplementation(async (...args) => {
          if (failTheStaleWorker) throw new Error('stale worker must not run after publication');
          return buildContext(...args);
        });
      restoreDatabaseSpies = () => {
        findUniqueSpy.mockRestore();
        contextSpy.mockRestore();
      };

      staleWorker = runDocumentJob.execute({
        documentJobId: documentJob.id,
        attemptNumber: 1,
        maxAttempts: 1,
      });
      await withDeadline(readReturnedStaleState.promise, 'stale document-job startup read');

      const published = await runDocumentJob.execute({
        documentJobId: documentJob.id,
        attemptNumber: 2,
        maxAttempts: 3,
      });
      failTheStaleWorker = true;
      resumeStaleReadGate.resolve();

      await expect(staleWorker).resolves.toMatchObject({
        success: true,
        generatedDocumentId: published.generatedDocumentId,
      });
      const finalJob = await prisma.documentJob.findUniqueOrThrow({ where: { id: documentJob.id } });
      expect(finalJob.status).toBe('COMPLETED');
      expect(finalJob.generatedDocumentId).toBe(published.generatedDocumentId);
      expect(contextSpy).toHaveBeenCalledTimes(1);
    } finally {
      resumeStaleRead?.resolve();
      restoreDatabaseSpies?.();
      await staleWorker?.catch(() => undefined);
      enqueue.mockRestore();
    }
  }, 30_000);

  it('does not let an older successful worker replace a published report snapshot', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(RunDocumentJobUseCase);
    const contextAdapter = app.get(ReviewedSnapshotReportContextAdapter);
    const enqueue = jest.spyOn(app.get(QueueService), 'enqueueDocumentJob')
      .mockResolvedValue(undefined);
    const firstWorkerEnteredContext = createDeferred();
    const releaseFirstWorker = createDeferred();
    const buildContext = contextAdapter.buildContext.bind(contextAdapter);
    const contextSpy = jest.spyOn(contextAdapter, 'buildContext').mockImplementationOnce(async (snapshot, analysis, locale) => {
      const staleContext = await buildContext(snapshot, analysis, locale);
      if (!staleContext.metadata) {
        throw new Error('Expected report context provenance metadata.');
      }
      staleContext.metadata.generatedAt = '2000-01-02T00:00:00.000Z';
      firstWorkerEnteredContext.resolve();
      await releaseFirstWorker.promise;
      return staleContext;
    });

    try {
      for (const linkId of [link1Id, link2Id]) {
        await request(app.getHttpServer())
          .put(`/api/v1/traceability-links/${linkId}/review-decision`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ decision: 'ACCEPTED', note: 'Approved for report generation' })
          .expect(200);
      }
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .expect(201);

      const documentJob = await prisma.documentJob.findFirstOrThrow({
        where: { analysisId, documentType: 'IMPACT_REPORT' },
      });
      const olderWorker = runDocumentJob.execute({ documentJobId: documentJob.id }).then(
        (result) => ({ result, error: null as unknown }),
        (error: unknown) => ({ result: null, error }),
      );
      await withDeadline(firstWorkerEnteredContext.promise, 'older document worker report context');

      await expect(runDocumentJob.execute({ documentJobId: documentJob.id }))
        .resolves.toMatchObject({ success: true });
      const firstPublishedSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: documentJob.snapshotId },
      });
      const firstPublishedMarkdown = firstPublishedSnapshot.markdown;
      expect(firstPublishedMarkdown).not.toContain('2000-01-02');

      releaseFirstWorker.resolve();
      const olderOutcome = await withDeadline(olderWorker, 'older document worker completion');
      expect(olderOutcome.error).toBeNull();

      const finalSnapshot = await prisma.reviewedReportSnapshot.findUniqueOrThrow({
        where: { id: documentJob.snapshotId },
      });
      const finalJob = await prisma.documentJob.findUniqueOrThrow({ where: { id: documentJob.id } });
      const finalDocument = await prisma.generatedDocument.findUniqueOrThrow({
        where: { id: firstPublishedSnapshot.approvedDocumentId! },
      });
      expect(finalJob.status).toBe('COMPLETED');
      expect(finalSnapshot.markdown).toBe(firstPublishedMarkdown);
      expect(finalDocument.content).toBe(firstPublishedMarkdown);
    } finally {
      releaseFirstWorker.resolve();
      contextSpy.mockRestore();
      enqueue.mockRestore();
    }
  }, 30_000);

  it('does not expose Redis enqueue details after finalization commits', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'Looks good' })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'Looks good' })
      .expect(200);

    const secretMarker = 'redis://queue-user:queue-password@redis.invalid:6379';
    const enqueue = jest.spyOn(app.get(QueueService), 'enqueueDocumentJob')
      .mockRejectedValueOnce(new Error(secretMarker));
    try {
      await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .expect(201);

      const job = await prisma.documentJob.findFirst({ where: { analysisId } });
      expect(job).toMatchObject({ status: 'QUEUED', error: null });

      const pendingReport = await request(app.getHttpServer())
        .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);
      expect(pendingReport.body.code).toBe('DOCUMENT_JOB_NOT_READY');
      expect(JSON.stringify(pendingReport.body)).not.toContain('queue-password');
    } finally {
      enqueue.mockRestore();
    }
  });

  it('does not expose raw errors persisted by a failed document worker', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Looks good' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ acknowledgeUnreviewed: false })
      .expect(201);

    const job = await prisma.documentJob.findFirst({ where: { analysisId } });
    expect(job).not.toBeNull();
    const secretMarker = 'redis://document-user:document-password@redis.invalid:6379';
    await prisma.documentJob.update({
      where: { id: job!.id },
      data: {
        status: 'FAILED',
        error: { message: secretMarker, stack: `connect ${secretMarker}` },
        failedAt: new Date(),
      },
    });

    const reportResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(reportResponse.body.code).toBe('DOCUMENT_JOB_NOT_READY');
    expect(reportResponse.body.details.error).toEqual({ code: 'DOCUMENT_GENERATION_FAILED' });
    expect(JSON.stringify(reportResponse.body)).not.toContain('document-password');

    const jobResponse = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/document-jobs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    expect(jobResponse.body.status).toBe('FAILED');
    expect(jobResponse.body.error).toEqual({ code: 'DOCUMENT_GENERATION_FAILED' });
    expect(JSON.stringify(jobResponse.body)).not.toContain('document-password');
  });

  it('rejects mixed-generation report reads and exports when a mutable document is shared across snapshots', async () => {
    const { analysisId, link1Id, link2Id, docId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED' })
        .expect(200);
    }
    await markAnalysisCompleted(analysisId);

    const now = Date.now();
    const olderSnapshotId = crypto.randomUUID();
    const latestSnapshotId = crypto.randomUUID();
    for (const [id, createdAt] of [
      [olderSnapshotId, new Date(now - 1_000)],
      [latestSnapshotId, new Date(now + 1_000)],
    ] as const) {
      await prisma.reviewedReportSnapshot.create({
        data: {
          id,
          analysisId,
          approvedDocumentId: docId,
          approvedDocumentAnalysisId: analysisId,
          markdown: null,
          reviewDecisionsSnapshot: [],
          evidenceQualitySummarySnapshot: {
            missingEvidence: 0,
            reviewRequired: 0,
            evidenced: 0,
            inferred: 0,
            weakEvidence: 0,
          },
          createdAt,
        },
      });
      await prisma.documentJob.create({
        data: {
          analysisId,
          snapshotId: id,
          documentType: 'IMPACT_REPORT',
          status: 'COMPLETED',
          progress: 100,
          attemptCount: 1,
          generatedDocumentId: docId,
          generatedDocumentAnalysisId: analysisId,
          completedAt: createdAt,
        },
      });
    }

    const finalResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(finalResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');

    const approvedResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(approvedResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');

    const exportResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report/export.md`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect(exportResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');
  });

  it('allows only one concurrent finalize to create a reviewed snapshot', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }
    const finalizer = app.get(FinalizeImpactAnalysisUseCase);
    const finalizerWithPreflight = finalizer as unknown as {
      assertFinalizableState: (analysisId: string, acknowledgeUnreviewed: boolean) => Promise<unknown>;
    };
    const originalPreflight = finalizerWithPreflight.assertFinalizableState.bind(finalizer);
    // Pause both requests before preflight reads so the database row lock selects the winner.
    const bothPreflightReads = createDeferred();
    const releaseTransactions = createDeferred();
    const snapshotBuildStarted = createDeferred();
    const releaseSnapshotBuild = createDeferred();
    let preflightReads = 0;
    let delayedSnapshotBuild = false;
    const snapshotBuilder = app.get(CreateReviewedReportSnapshotUseCase);
    const originalSnapshotBuild = snapshotBuilder.buildSnapshotCreateData.bind(snapshotBuilder);
    const preflightSpy = jest.spyOn(finalizer as any, 'assertFinalizableState')
      .mockImplementation(async (...args: unknown[]) => {
        const [analysisId, acknowledgeUnreviewed] = args as [string, boolean];
        if (preflightReads < 2) {
          preflightReads += 1;
          if (preflightReads === 2) bothPreflightReads.resolve();
          await releaseTransactions.promise;
        }
        return originalPreflight(analysisId, acknowledgeUnreviewed);
      });
    const snapshotBuildSpy = jest.spyOn(snapshotBuilder, 'buildSnapshotCreateData')
      .mockImplementation(async (params) => {
        if (!delayedSnapshotBuild) {
          delayedSnapshotBuild = true;
          snapshotBuildStarted.resolve();
          await releaseSnapshotBuild.promise;
        }
        return originalSnapshotBuild(params);
      });

    let responsesPromise: Promise<unknown> | undefined;
    try {
      const finalizeRequest = () => request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });
      const concurrentResponses = Promise.all([finalizeRequest(), finalizeRequest()]);
      responsesPromise = concurrentResponses;

      await withDeadline(Promise.race([
        bothPreflightReads.promise,
        concurrentResponses.then((responses) => {
          throw new Error(`Finalize requests ended before the preflight barrier: ${responses.map((response) => response.status).join(',')}`);
        }),
      ]), 'both finalize requests to read review state before locking');
      releaseTransactions.resolve();
      await withDeadline(snapshotBuildStarted.promise, 'winning finalize to acquire the row lock');
      // Hold the first transaction beyond Prisma's 5-second default. The second
      // request must wait, then return the state conflict after the winner commits.
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      releaseSnapshotBuild.resolve();
      const responses = await withDeadline(concurrentResponses, 'concurrent finalize responses', 20_000);
      const snapshots = await prisma.reviewedReportSnapshot.findMany({
        where: { analysisId },
        select: { id: true },
      });
      const rejectedResponse = responses.find((response) => response.status === 409);
      const documentJobCount = await prisma.documentJob.count({
        where: { analysisId, documentType: 'IMPACT_REPORT' },
      });
      const finalStatus = (await prisma.impactAnalysis.findUniqueOrThrow({
        where: { id: analysisId },
      })).status;
      const auditEventCount = snapshots.length === 1
        ? await prisma.domainEvent.count({
            where: { idempotencyKey: `reviewed-report-snapshot:${snapshots[0].id}:created` },
          })
        : 0;
      expect({
        statuses: responses.map((response) => response.status).sort(),
        responseErrors: responses.map((response) => response.body.message ?? response.body.error).filter(Boolean),
        rejectedCode: rejectedResponse?.body.code,
        snapshotCount: snapshots.length,
        documentJobCount,
        finalStatus,
        auditEventCount,
      }).toEqual({
        statuses: [201, 409],
        responseErrors: ['Impact analysis is no longer waiting for review.'],
        rejectedCode: 'INVALID_STATE_TRANSITION',
        snapshotCount: 1,
        documentJobCount: 1,
        finalStatus: 'COMPLETED',
        auditEventCount: 1,
      });
    } finally {
      releaseTransactions.resolve();
      releaseSnapshotBuild.resolve();
      preflightSpy.mockRestore();
      snapshotBuildSpy.mockRestore();
      if (responsesPromise) {
        await withDeadline(
          Promise.allSettled([responsesPromise]),
          'both finalize requests to settle after releasing the barrier',
        );
      }
    }
  }, 30_000);

  it('rolls back finalization when the reviewed-snapshot audit event cannot be recorded', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }

    const finalizer = app.get(FinalizeImpactAnalysisUseCase);
    const snapshotBuilder = (finalizer as unknown as {
      createSnapshot: CreateReviewedReportSnapshotUseCase;
    }).createSnapshot;
    const eventSpy = jest.spyOn(snapshotBuilder, 'recordCreatedEvent')
      .mockRejectedValueOnce(new Error('event storage unavailable'));

    try {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });

      expect(response.status).toBe(500);
      const persistedAnalysis = await prisma.impactAnalysis.findUnique({
        where: { id: analysisId },
        select: { status: true },
      });
      expect(persistedAnalysis?.status).toBe('WAITING_FOR_REVIEW');
      expect(await prisma.reviewedReportSnapshot.count({ where: { analysisId } })).toBe(0);
      expect(await prisma.documentJob.count({ where: { analysisId } })).toBe(0);
    } finally {
      eventSpy.mockRestore();
    }
  });

  it('serializes target observation after finalization once the finalizer holds the target lock', async () => {
    const { analysisId, link1Id, link2Id, targetId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }

    const finalizer = app.get(FinalizeImpactAnalysisUseCase);
    const snapshotBuilder = (finalizer as unknown as {
      createSnapshot: CreateReviewedReportSnapshotUseCase;
    }).createSnapshot;
    const originalRecordEvent = snapshotBuilder.recordCreatedEvent.bind(snapshotBuilder);
    const finalizationReachedCommit = createDeferred();
    const releaseFinalization = createDeferred();
    const eventSpy = jest.spyOn(snapshotBuilder, 'recordCreatedEvent').mockImplementation(async (...args) => {
      finalizationReachedCommit.resolve();
      await releaseFinalization.promise;
      return originalRecordEvent(...args);
    });
    let targetUpdateResolved = false;

    try {
      const finalizePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .then((response) => response);
      await withDeadline(finalizationReachedCommit.promise, 'finalization to reach its in-transaction audit write');

      const targetUpdatePromise = prisma.repositoryTarget.update({
        where: { id: targetId },
        data: { latestObservedCommitSha: 'newer-after-finalize-sha' },
      }).then((target) => {
        targetUpdateResolved = true;
        return target;
      });
      await waitForRepositoryTargetUpdateLock(prisma);
      expect(targetUpdateResolved).toBe(false);

      releaseFinalization.resolve();
      const [finalizeResponse] = await Promise.all([
        withDeadline(finalizePromise, 'finalization response'),
        withDeadline(targetUpdatePromise, 'target update after finalization'),
      ]);
      const persistedAnalysis = await prisma.impactAnalysis.findUnique({
        where: { id: analysisId },
        select: { status: true, snapshot: { select: { commitSha: true } } },
      });

      expect({
        responseStatus: finalizeResponse.status,
        persistedStatus: persistedAnalysis?.status,
        snapshotCommitSha: persistedAnalysis?.snapshot.commitSha,
        latestObservedCommitSha: (await prisma.repositoryTarget.findUnique({
          where: { id: targetId },
          select: { latestObservedCommitSha: true },
        }))?.latestObservedCommitSha,
      }).toEqual({
        responseStatus: 201,
        persistedStatus: 'COMPLETED',
        snapshotCommitSha: 'abc',
        latestObservedCommitSha: 'newer-after-finalize-sha',
      });
    } finally {
      releaseFinalization.resolve();
      eventSpy.mockRestore();
    }
  }, 30_000);

  it('finalizes a pinned snapshot without comparing it to moving-ref observations', async () => {
    const { analysisId, link1Id, link2Id, targetId } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }
    await prisma.repositoryTarget.update({
      where: { id: targetId },
      data: {
        resolvedRefType: 'COMMIT',
        latestObservedCommitSha: 'later-moving-ref-observation',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ acknowledgeUnreviewed: false });

    expect(response.status).toBe(201);
    expect(await prisma.impactAnalysis.findUnique({
      where: { id: analysisId },
      select: { status: true },
    })).toEqual({ status: 'COMPLETED' });
    expect(await prisma.reviewedReportSnapshot.count({ where: { analysisId } })).toBe(1);
  }, 30_000);

  it('rejects a review decision whose stale status read resumes after finalization', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }

    const submitDecision = app.get(SubmitReviewItemDecisionUseCase);
    const traceabilityRepo = (submitDecision as unknown as {
      traceabilityRepo: { findById: (...args: any[]) => Promise<any> };
    }).traceabilityRepo;
    const originalFindById = traceabilityRepo.findById.bind(traceabilityRepo);
    const statusReadCompleted = createDeferred();
    const releaseStatusRead = createDeferred();
    let blockedStatusRead = false;
    const decisionSpy = jest.spyOn(traceabilityRepo, 'findById').mockImplementation(async (itemId, transaction) => {
      const link = await originalFindById(itemId, transaction);
      if (!transaction && !blockedStatusRead) {
        blockedStatusRead = true;
        statusReadCompleted.resolve();
        await releaseStatusRead.promise;
      }
      return link;
    });

    try {
      const decisionResponsePromise = request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${link2Id}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'impact', action: 'reject', rationale: 'Changed after review', requestKey: crypto.randomUUID() })
        .then((response) => response);

      await withDeadline(Promise.race([
        statusReadCompleted.promise,
        decisionResponsePromise.then((response) => {
          throw new Error(`Review decision request ended before its status read: ${response.status}`);
        }),
      ]), 'review decision preflight read');

      const finalizeResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });
      releaseStatusRead.resolve();
      const decisionResponse = await withDeadline(decisionResponsePromise, 'review decision response');
      const persistedDecision = await prisma.traceabilityReviewDecision.findUnique({
        where: { traceabilityLinkId: link2Id },
      });

      expect({
        finalizeStatus: finalizeResponse.status,
        decisionStatus: decisionResponse.status,
        decisionCode: decisionResponse.body.code,
        persistedDecision: persistedDecision?.decision,
      }).toEqual({
        finalizeStatus: 201,
        decisionStatus: 409,
        decisionCode: 'INVALID_STATE_TRANSITION',
        persistedDecision: 'ACCEPTED',
      });
    } finally {
      releaseStatusRead.resolve();
      decisionSpy.mockRestore();
    }
  }, 30_000);

  it('finalizes from the latest decision when it commits during finalization preflight', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }

    const finalizer = app.get(FinalizeImpactAnalysisUseCase);
    const traceabilityRepo = (finalizer as unknown as {
      traceabilityRepo: { listByAnalysis: (...args: any[]) => Promise<any[]> };
    }).traceabilityRepo;
    const originalListByAnalysis = traceabilityRepo.listByAnalysis.bind(traceabilityRepo);
    const preflightReadReached = createDeferred();
    const releaseFinalization = createDeferred();
    let paused = false;
    const preflightSpy = jest.spyOn(traceabilityRepo, 'listByAnalysis').mockImplementation(async (analysisId) => {
      const links = await originalListByAnalysis(analysisId);
      if (!paused) {
        paused = true;
        preflightReadReached.resolve();
        await releaseFinalization.promise;
      }
      return links;
    });

    try {
      const finalizePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .then((response) => response);
      await withDeadline(preflightReadReached.promise, 'finalizer to read review state during preflight');

      const decisionResponse = await request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${link2Id}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'impact', action: 'reject', rationale: 'Changed before finalization', requestKey: crypto.randomUUID() });

      releaseFinalization.resolve();
      const finalizeResponse = await withDeadline(finalizePromise, 'finalize after the decision commits');
      const persistedSnapshot = await prisma.reviewedReportSnapshot.findFirst({
        where: { analysisId },
        orderBy: { createdAt: 'desc' },
      });
      const decisions = persistedSnapshot?.reviewDecisionsSnapshot as any[];
      const snapshotDecision = decisions.find((decision) => decision.linkId === link2Id)?.reviewDecision?.decision;
      const liveDecision = await prisma.traceabilityReviewDecision.findUnique({
        where: { traceabilityLinkId: link2Id },
      });

      expect({
        decisionStatus: decisionResponse.status,
        finalizeStatus: finalizeResponse.status,
        snapshotDecision,
        liveDecision: liveDecision?.decision,
      }).toEqual({
        decisionStatus: 200,
        finalizeStatus: 201,
        snapshotDecision: 'REJECTED',
        liveDecision: 'REJECTED',
      });
    } finally {
      releaseFinalization.resolve();
      preflightSpy.mockRestore();
    }
  }, 30_000);

  it('rejects an insight decision whose stale status read resumes after finalization', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }
    const insightId = crypto.randomUUID();
    await prisma.baInsight.create({
      data: {
        id: insightId,
        impactAnalysisId: analysisId,
        insightKey: `audit-race:${insightId}`,
        insightType: 'QA_SCENARIO',
        certainty: 'INFERRED',
        reviewStatus: 'CONFIRMED',
        title: 'Reviewed QA scenario',
        description: 'Given a paid booking, when cancelled, then a refund is issued.',
      },
    });

    const submitDecision = app.get(SubmitReviewItemDecisionUseCase);
    const insightRepo = (submitDecision as unknown as {
      insightRepo: { findById: (...args: any[]) => Promise<any> };
    }).insightRepo;
    const originalFindById = insightRepo.findById.bind(insightRepo);
    const statusReadCompleted = createDeferred();
    const releaseStatusRead = createDeferred();
    let blockedStatusRead = false;
    const decisionSpy = jest.spyOn(insightRepo, 'findById').mockImplementation(async (itemId, transaction) => {
      const insight = await originalFindById(itemId, transaction);
      if (!transaction && !blockedStatusRead) {
        blockedStatusRead = true;
        statusReadCompleted.resolve();
        await releaseStatusRead.promise;
      }
      return insight;
    });

    try {
      const decisionResponsePromise = request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${insightId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'insight', action: 'reject', requestKey: crypto.randomUUID() })
        .then((response) => response);

      await withDeadline(Promise.race([
        statusReadCompleted.promise,
        decisionResponsePromise.then((response) => {
          throw new Error(`Insight decision request ended before its status read: ${response.status}`);
        }),
      ]), 'insight decision preflight read');

      const finalizeResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });
      releaseStatusRead.resolve();
      const decisionResponse = await withDeadline(decisionResponsePromise, 'insight decision response');
      const persistedInsight = await prisma.baInsight.findUnique({ where: { id: insightId } });

      expect({
        finalizeStatus: finalizeResponse.status,
        decisionStatus: decisionResponse.status,
        decisionCode: decisionResponse.body.code,
        persistedStatus: persistedInsight?.reviewStatus,
      }).toEqual({
        finalizeStatus: 201,
        decisionStatus: 409,
        decisionCode: 'INVALID_STATE_TRANSITION',
        persistedStatus: 'CONFIRMED',
      });
    } finally {
      releaseStatusRead.resolve();
      decisionSpy.mockRestore();
    }
  }, 30_000);

  it('rejects a review note whose stale status read resumes after finalization', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ traceabilityLinkId: link1Id, body: 'Saved before finalization.' })
      .expect(200);
    const saveNoteUseCase = app.get(SaveReviewNoteUseCase);
    const reviewNoteRepository = (saveNoteUseCase as unknown as {
      reviewNoteRepo: ReviewNoteRepository;
    }).reviewNoteRepo;
    const originalUpsert = reviewNoteRepository.upsert.bind(reviewNoteRepository);
    const noteReachedPersistence = createDeferred();
    const releaseNoteWrite = createDeferred();
    let blockedNoteWrite = false;
    const noteSpy = jest.spyOn(reviewNoteRepository, 'upsert').mockImplementation(async (data) => {
      if (!blockedNoteWrite) {
        blockedNoteWrite = true;
        noteReachedPersistence.resolve();
        await releaseNoteWrite.promise;
      }
      return originalUpsert(data);
    });

    try {
      const noteResponsePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ traceabilityLinkId: link1Id, body: 'Must be part of the finalized review.' })
        .then((response) => response);

      await withDeadline(Promise.race([
        noteReachedPersistence.promise,
        noteResponsePromise.then((response) => {
          throw new Error(`Review note request ended before persistence: ${response.status}`);
        }),
      ]), 'review note to reach persistence after its status check');
      const finalizeResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });

      expect(finalizeResponse.status).toBe(201);
      releaseNoteWrite.resolve();
      const noteResponse = await withDeadline(noteResponsePromise, 'review note response');
      const clearResult = await reviewNoteRepository.clear({
        impactAnalysisId: analysisId,
        traceabilityLinkId: link1Id,
      });
      const noteCount = await prisma.reviewNote.count({ where: { impactAnalysisId: analysisId } });
      const persistedNote = await prisma.reviewNote.findFirst({
        where: { impactAnalysisId: analysisId, traceabilityLinkId: link1Id },
      });
      expect({
        status: noteResponse.status,
        code: noteResponse.body.code,
        clearResult,
        noteCount,
        persistedBody: persistedNote?.body,
      }).toEqual({
        status: 409,
        code: 'INVALID_STATE_TRANSITION',
        clearResult: null,
        noteCount: 1,
        persistedBody: 'Saved before finalization.',
      });
    } finally {
      releaseNoteWrite.resolve();
      noteSpy.mockRestore();
    }
  }, 30_000);

  it('serializes a PostgreSQL review-note write behind finalization before snapshot commit', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    for (const linkId of [link1Id, link2Id]) {
      await request(app.getHttpServer())
        .put(`/api/v1/traceability-links/${linkId}/review-decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ decision: 'ACCEPTED', note: 'Ready to finalize' })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ traceabilityLinkId: link1Id, body: 'Persisted before finalization.' })
      .expect(200);

    const finalize = app.get(FinalizeImpactAnalysisUseCase);
    const createSnapshot = (finalize as unknown as {
      createSnapshot: CreateReviewedReportSnapshotUseCase;
    }).createSnapshot;
    const originalBuildSnapshotData = createSnapshot.buildSnapshotCreateData.bind(createSnapshot);
    const snapshotDataReady = createDeferred();
    const releaseFinalization = createDeferred();
    const snapshotSpy = jest.spyOn(createSnapshot, 'buildSnapshotCreateData').mockImplementation(async (params) => {
      const data = await originalBuildSnapshotData(params);
      snapshotDataReady.resolve();
      await releaseFinalization.promise;
      return data;
    });
    let noteResponseResolved = false;

    try {
      const finalizeResponsePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false })
        .then((response) => response);
      await withDeadline(snapshotDataReady.promise, 'finalizer to build its frozen snapshot data under the row lock');

      const noteResponsePromise = request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/review-notes`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ traceabilityLinkId: link1Id, body: 'Must not be saved after snapshot creation.' })
        .then((response) => {
          noteResponseResolved = true;
          return response;
        });

      await withDeadline(Promise.race([
        waitForReviewNoteAnalysisLock(prisma),
        noteResponsePromise.then((response) => {
          throw new Error(`Review note returned ${response.status} before PostgreSQL reported its row-lock wait.`);
        }),
      ]), 'PostgreSQL to show the review-note row-lock wait');
      expect(noteResponseResolved).toBe(false);

      releaseFinalization.resolve();
      const [finalizeResponse, noteResponse] = await Promise.all([
        withDeadline(finalizeResponsePromise, 'finalize response'),
        withDeadline(noteResponsePromise, 'review-note response after finalization commits'),
      ]);
      const persistedNote = await prisma.reviewNote.findUnique({ where: { traceabilityLinkId: link1Id } });
      const snapshotCount = await prisma.reviewedReportSnapshot.count({ where: { analysisId } });

      expect({
        finalizeStatus: finalizeResponse.status,
        noteStatus: noteResponse.status,
        noteCode: noteResponse.body.code,
        noteBody: persistedNote?.body,
        snapshotCount,
      }).toEqual({
        finalizeStatus: 201,
        noteStatus: 409,
        noteCode: 'INVALID_STATE_TRANSITION',
        noteBody: 'Persisted before finalization.',
        snapshotCount: 1,
      });
    } finally {
      releaseFinalization.resolve();
      snapshotSpy.mockRestore();
    }
  }, 30_000);
});
