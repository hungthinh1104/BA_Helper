import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { PrismaService } from "@ba-helper/backend-runtime";

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

    return { analysisId, link1Id, link2Id, docId };
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
    expect(finalRes.body.snapshotId).toBeDefined();
    expect(finalRes.body.reviewCompletion.isComplete).toBe(true);
  });

  it('unreviewed link blocks final report', async () => {
    const { analysisId, link1Id } = await setupBasicAnalysisWithLinks();

    // Assign decision to only ONE link
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED' })
      .expect(200);

    // Force create snapshot (API might allow snapshotting even if incomplete? E15C allows it, UI gate is in E16)
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

  it('snapshot remains immutable after review decision changes', async () => {
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

    // 3. Mutate one link to REJECTED after snapshot
    await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link2Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'REJECTED' })
      .expect(200);

    // Note: Mutating the decision does not clear the snapshot, and because all links still have a decision, isComplete remains true.
    const finalRes = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysisId}/final-reviewed-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 4. Assert the snapshot data still shows the old ACCEPTED state
    const decisionsSnapshot = finalRes.body.reviewDecisionsSnapshot;
    expect(decisionsSnapshot).toBeDefined();
    
    // We expect both to be ACCEPTED in the snapshot, even though one is now REJECTED in live db.
    const decisionsArray = decisionsSnapshot as any[];
    expect(decisionsArray).toHaveLength(2);
    expect(decisionsArray.every(d => d.reviewDecision?.decision === 'ACCEPTED')).toBe(true);
  });

  it('GeneratedDocument markdown reflects the snapshot payload, not the live mutated state', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();
    const runDocumentJob = app.get(require('../../src/modules/document/application/jobs/run-document-job.usecase').RunDocumentJobUseCase);

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

    // The markdown should contain the original ACCEPTED decisions from the snapshot
    expect(markdown).toContain('Confirmed'); // Corresponds to ACCEPTED in traceability section
    expect(markdown).not.toContain('REJECTED'); // Should not reflect the live mutation
    expect(markdown).not.toContain('Actually no'); // Should not reflect the live mutated note
  });
});
