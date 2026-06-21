import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { grantProjectMembership } from './helpers/grant-project-membership';

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

    return { analysisId, link1Id, link2Id };
  }

  it('complete reviewed flow returns final report', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();

    // 1. Assign ACCEPTED to both links
    const putRes = await request(app.getHttpServer())
      .put(`/api/v1/traceability-links/${link1Id}/review-decision`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'ACCEPTED', note: 'ok' });
      
    if (putRes.status !== 200) {
      console.log(putRes.body);
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
      
    if (snapRes.status !== 201) {
      console.log(snapRes.body);
    }
    expect(snapRes.status).toBe(201);

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

    if (res.body.code !== 'REVIEW_COMPLETION_REQUIRED') {
      console.log('UNEXPECTED RES BODY:', res.body);
    }
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

    if (res.body.code !== 'REVIEW_COMPLETION_REQUIRED') {
      console.log('UNEXPECTED RES BODY:', res.body);
    }
    expect(res.body.code).toBe('REVIEW_COMPLETION_REQUIRED');
    expect(res.body.details?.blockingReasons || res.body.metadata?.blockingReasons).toContain('REVIEWED_SNAPSHOT_MISSING');
  });

  it('snapshot remains immutable after review decision changes', async () => {
    const { analysisId, link1Id, link2Id } = await setupBasicAnalysisWithLinks();

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
    await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysisId}/reviewed-report-snapshot`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send()
      .expect(201);

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
});
