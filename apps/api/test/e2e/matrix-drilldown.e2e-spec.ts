import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import {
  multiRepoImpactAnalysisCreateResponseSchema,
  matrixRowDetailResponseSchema,
} from '@ba-helper/contracts';

describe('Matrix Drilldown (e2e)', () => {
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
        name: 'Drilldown Project',
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
        title: 'Requirement 1',
        rawText: 'Raw req text',
        normalizedText: 'Normalized req text',
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
    
    await prisma.repositoryProfile.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId,
        domain: 'PAYMENT',
        language: 'TYPESCRIPT',
        framework: 'NESTJS',
        architectureStyle: 'MODULAR_MONOLITH',
        sourceRoots: [],
        testRoots: [],
        profileVersion: 'v1',
      }
    });

    return { repositoryId, snapshotId, targetId, commitSha };
  }

  it('drills down successfully, ensuring analysis belongs to run and grouping correctly', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const repo1 = await seedRepository(projectId, 'repo1');
    const repo2 = await seedRepository(projectId, 'repo2');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [repo1.repositoryId, repo2.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);
    const analysisId = result.items[0].analysisId;

    // Seed artifacts and evidence
    const artifact1 = await prisma.codeArtifact.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId: result.items[0].snapshotId,
        artifactKey: 'artifact-1',
        name: 'Artifact 1',
        artifactType: 'CLASS',
        universalKind: 'DOMAIN_SERVICE',
        filePath: 'src/artifact1.ts',
        startLine: 1,
        endLine: 10,
      }
    });

    const evidence1 = await prisma.evidence.create({
      data: {
        id: crypto.randomUUID(),
        provenanceKey: 'ev-1',
        sourceType: 'CODE',
        snapshotId: result.items[0].snapshotId,
        artifactId: artifact1.id,
        sourcePath: 'src/artifact1.ts',
        startLine: 1,
        endLine: 5,
        excerpt: 'Some code excerpt',
        contentHash: 'hash',
        isRedacted: false,
        redactionMetadata: {},
      }
    });

    const tLink1 = await prisma.traceabilityLink.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        artifactId: artifact1.id,
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        retrievalMetadata: {
          diagnostics: { method: 'VECTOR' },
        },
      }
    });

    await prisma.traceabilityEvidence.create({
      data: {
        id: crypto.randomUUID(),
        traceabilityLinkId: tLink1.id,
        evidenceId: evidence1.id,
      }
    });

    const insight1 = await prisma.baInsight.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        insightKey: 'risk-1',
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'Unknown risk 1',
        description: 'Risk desc',
      }
    });

    await prisma.insightEvidence.create({
      data: {
        id: crypto.randomUUID(),
        insightId: insight1.id,
        evidenceId: evidence1.id,
      }
    });

    const qaInsight = await prisma.baInsight.create({
      data: {
        id: crypto.randomUUID(),
        impactAnalysisId: analysisId,
        insightKey: 'qa-1',
        insightType: 'QA_SCENARIO',
        certainty: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        title: 'QA scenario 1',
        description: 'QA desc',
      }
    });

    await prisma.insightEvidence.create({
      data: {
        id: crypto.randomUUID(),
        insightId: qaInsight.id,
        evidenceId: evidence1.id,
      }
    });

    // Test successful drilldown
    const response = await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${result.runId}/impact-matrix/analyses/${analysisId}/details`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const details = matrixRowDetailResponseSchema.parse(response.body);
    expect(details.runId).toBe(result.runId);
    expect(details.analysisId).toBe(analysisId);
    expect(details.domain).toBe('PAYMENT');
    expect(details.impactedArtifacts).toHaveLength(1);
    expect(details.impactedArtifacts[0].artifactId).toBe(artifact1.id);
    expect(details.impactedArtifacts[0].relatedRisks).toContain(insight1.id);
    expect(details.impactedArtifacts[0].relatedQaScenarios).toContain(qaInsight.id);
    expect(details.impactedArtifacts[0].evidenceItems).toHaveLength(1);
    expect(details.impactedArtifacts[0].evidenceItems[0].evidenceId).toBe(evidence1.id);
    expect(details.impactedArtifacts[0].retrievalDiagnostics).toEqual({ method: 'VECTOR' });
    expect(details.evidenceSummary.totalEvidenceItems).toBe(1);
    expect(details.evidenceSummary.coveredArtifacts).toBe(1);
    expect(details.evidenceSummary.uncoveredArtifacts).toBe(0);
    expect(details.risks).toHaveLength(1);
    expect(details.qaScenarios).toHaveLength(1);
  });

  it('blocks drilldown if runId does not match analysisId', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const repo1 = await seedRepository(projectId, 'repo1');
    const repo2 = await seedRepository(projectId, 'repo2');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [repo1.repositoryId, repo2.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);
    const analysisId = result.items[0].analysisId;
    
    // Some random runId
    const randomRunId = crypto.randomUUID();

    await request(app.getHttpServer())
      .get(`/api/v1/multi-repo-runs/${randomRunId}/impact-matrix/analyses/${analysisId}/details`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('blocks drilldown for outsider', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const repo1 = await seedRepository(projectId, 'repo1');
    const repo2 = await seedRepository(projectId, 'repo2');

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [repo1.repositoryId, repo2.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(createResponse.body);
    const analysisId = result.items[0].analysisId;

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
      .get(`/api/v1/multi-repo-runs/${result.runId}/impact-matrix/analyses/${analysisId}/details`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });
});
