import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { approvedImpactReportResponseSchema } from '@ba-helper/contracts';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { EventLogService, PrismaService } from '@ba-helper/backend-runtime';
import type { ReviewNoteRepository } from '@ba-helper/backend-runtime';
import { RunDocumentJobUseCase } from '@ba-helper/application';
import { ApprovedReportContextReader } from '../../src/modules/document/application/queries/approved-report-context.reader';
import type { CreateReviewedReportSnapshotUseCase } from '../../src/modules/document/application/commands/create-reviewed-report-snapshot.usecase';
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

function withDeadline<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 10_000);
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
          artifactId: artifact1Id,
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          reviewStatus: 'NEEDS_REVIEW',
          confidence: 0.9,
        },
        {
          id: link2Id,
          impactAnalysisId: analysisId,
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
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapRes.body.id },
      data: { approvedDocumentId: docId },
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

    expect(finalRes.body.markdown).toBe('# Live Generated Report');
    expect(finalRes.body.locale).toBe('en');
    expect(finalRes.body.snapshotId).toBeDefined();
    expect(finalRes.body.reviewCompletion.isComplete).toBe(true);

    const approvedRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/approved-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const repositorySnapshotId = (await prisma.impactAnalysis.findUniqueOrThrow({
      where: { id: analysisId },
      select: { snapshotId: true },
    })).snapshotId;
    expect(finalRes.body.snapshotId).toBe(snapRes.body.id);
    expect(approvedImpactReportResponseSchema.parse(approvedRes.body)).toMatchObject({
      id: docId,
      impactAnalysisId: analysisId,
      snapshotId: repositorySnapshotId,
      markdown: '# Live Generated Report',
      status: 'APPROVED',
      provenance: { snapshotId: repositorySnapshotId },
    });

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
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();

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
      data: { approvedDocumentId: docId },
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
    await prisma.reviewedReportSnapshot.update({
      where: { id: snapshotResponse.body.id },
      data: { approvedDocumentId: otherDocument.id },
    });

    const reportResponse = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(reportResponse.status).toBe(409);
    expect(reportResponse.body.code).toBe('REPORT_PROVENANCE_MISMATCH');
    const contextReader = app.get(ApprovedReportContextReader);
    await expect(contextReader.readContext(analysisId, snapshotResponse.body.id)).rejects.toMatchObject({
      code: 'REPORT_PROVENANCE_MISMATCH',
    });
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
      data: { approvedDocumentId: docId },
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
    let preflightReads = 0;
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
      const responses = await withDeadline(concurrentResponses, 'concurrent finalize responses');
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
      preflightSpy.mockRestore();
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
      traceabilityRepo: { upsertReviewDecision: (...args: any[]) => Promise<any> };
    }).traceabilityRepo;
    const originalUpsert = traceabilityRepo.upsertReviewDecision.bind(traceabilityRepo);
    const decisionReachedPersistence = createDeferred();
    const releaseDecisionWrite = createDeferred();
    let blockedDecisionWrite = false;
    const decisionSpy = jest.spyOn(traceabilityRepo, 'upsertReviewDecision').mockImplementation(async (params) => {
      if (!blockedDecisionWrite) {
        blockedDecisionWrite = true;
        decisionReachedPersistence.resolve();
        await releaseDecisionWrite.promise;
      }
      return originalUpsert(params);
    });

    try {
      const decisionResponsePromise = request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${link2Id}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'impact', action: 'reject', rationale: 'Changed after review' })
        .then((response) => response);

      await withDeadline(Promise.race([
        decisionReachedPersistence.promise,
        decisionResponsePromise.then((response) => {
          throw new Error(`Review decision request ended before persistence: ${response.status}`);
        }),
      ]), 'review decision to reach persistence after its status check');

      const finalizeResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });
      releaseDecisionWrite.resolve();
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
      releaseDecisionWrite.resolve();
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
        .send({ target: 'impact', action: 'reject', rationale: 'Changed before finalization' });

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
      insightRepo: { updateReviewStatusIfCurrent: (...args: any[]) => Promise<any> };
    }).insightRepo;
    const originalUpdate = insightRepo.updateReviewStatusIfCurrent.bind(insightRepo);
    const decisionReachedPersistence = createDeferred();
    const releaseDecisionWrite = createDeferred();
    let blockedDecisionWrite = false;
    const decisionSpy = jest.spyOn(insightRepo, 'updateReviewStatusIfCurrent').mockImplementation(async (params) => {
      if (!blockedDecisionWrite) {
        blockedDecisionWrite = true;
        decisionReachedPersistence.resolve();
        await releaseDecisionWrite.promise;
      }
      return originalUpdate(params);
    });

    try {
      const decisionResponsePromise = request(app.getHttpServer())
        .put(`/api/v1/impact-analyses/${analysisId}/review-items/${insightId}/decision`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ target: 'insight', action: 'reject' })
        .then((response) => response);

      await withDeadline(Promise.race([
        decisionReachedPersistence.promise,
        decisionResponsePromise.then((response) => {
          throw new Error(`Insight decision request ended before persistence: ${response.status}`);
        }),
      ]), 'insight decision to reach persistence after its status check');

      const finalizeResponse = await request(app.getHttpServer())
        .post(`/api/v1/impact-analyses/${analysisId}/finalize`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ acknowledgeUnreviewed: false });
      releaseDecisionWrite.resolve();
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
      releaseDecisionWrite.resolve();
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
