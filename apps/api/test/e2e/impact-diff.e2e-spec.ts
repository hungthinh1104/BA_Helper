import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import * as crypto from 'crypto';
import { seedImpactAnalysisCompletion } from './helpers/seed-fixture';
import { impactAnalysisDiffResponseSchema } from '@ba-helper/contracts';
import { grantProjectMembership } from './helpers/grant-project-membership';

describe('Impact Diff Endpoint (e2e)', () => {
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

  it('GET /api/v1/impact-analyses/:id/diff returns diff between analyses', async () => {
    // 1. Setup base project, repo, requirements
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

    const rev1Id = crypto.randomUUID();
    await prisma.requirementRevision.create({
      data: { id: rev1Id, requirementId: reqId, title: 'R1', rawText: 'text', normalizedText: 'text', readinessStatus: 'READY_FOR_ANALYSIS' },
    });

    const rev2Id = crypto.randomUUID();
    await prisma.requirementRevision.create({
      data: { id: rev2Id, requirementId: reqId, title: 'R2', rawText: 'text2', normalizedText: 'text2', readinessStatus: 'READY_FOR_ANALYSIS' },
    });

    // 2. Create base analysis
    const baseAnalysisId = crypto.randomUUID();
    await prisma.impactAnalysis.create({
      data: {
        id: baseAnalysisId,
        requirementRevisionId: rev1Id,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });

    const art1Id = crypto.randomUUID();
    await prisma.codeArtifact.create({
      data: { id: art1Id, snapshotId, artifactKey: 'file1', name: 'File1', artifactType: 'FILE', filePath: 'f1' },
    });

    await prisma.traceabilityLink.create({
      data: { impactAnalysisId: baseAnalysisId, artifactId: art1Id, linkType: 'AFFECTED', linkBasis: 'INFERRED', reviewStatus: 'CONFIRMED' },
    });

    const u1Id = crypto.randomUUID();
    await prisma.baInsight.create({
      data: { id: u1Id, impactAnalysisId: baseAnalysisId, insightKey: 'u1-key', insightType: 'UNKNOWN', certainty: 'UNKNOWN', reviewStatus: 'CONFIRMED', title: 'Q1', description: 'desc' },
    });

    const clarId = crypto.randomUUID();
    await prisma.clarificationItem.create({
      data: {
        id: clarId,
        impactAnalysisId: baseAnalysisId,
        sourceInsightId: u1Id,
        status: 'CONVERTED_TO_REVISION',
        question: 'Q1',
        convertedRequirementRevisionId: rev2Id,
      },
    });

    // 3. Create current analysis
    const currentAnalysisId = crypto.randomUUID();
    await prisma.impactAnalysis.create({
      data: {
        id: currentAnalysisId,
        requirementRevisionId: rev2Id,
        snapshotId,
        sourceTargetId: targetId,
        requestKey: crypto.randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
        derivedFromAnalysisId: baseAnalysisId,
        sourceClarificationId: clarId,
      },
    });

    const art2Id = crypto.randomUUID();
    await prisma.codeArtifact.create({
      data: { id: art2Id, snapshotId, artifactKey: 'file2', name: 'File2', artifactType: 'FILE', filePath: 'f2' },
    });

    await prisma.traceabilityLink.create({
      data: { impactAnalysisId: currentAnalysisId, artifactId: art2Id, linkType: 'AFFECTED', linkBasis: 'INFERRED', reviewStatus: 'CONFIRMED' },
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${currentAnalysisId}/diff`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const parsed = impactAnalysisDiffResponseSchema.parse(res.body);
    expect(parsed.baseAnalysisId).toBe(baseAnalysisId);
    expect(parsed.currentAnalysisId).toBe(currentAnalysisId);
    expect(parsed.comparisonContext.requirementChanged).toBe(true);
    expect(parsed.comparisonContext.snapshotChanged).toBe(false);

    // base had 1 impact, current has 0 -> 1 removed
    expect(parsed.summary.removedImpacts).toBe(1);
    expect(parsed.removedArtifacts[0].artifactKey).toBe('file1');

    // base had 1 unknown, current has 0 -> resolved!
    expect(parsed.summary.resolvedUnknowns).toBe(1);
    expect(parsed.resolvedUnknowns[0].insightKey).toBe('u1-key');
  });
});
