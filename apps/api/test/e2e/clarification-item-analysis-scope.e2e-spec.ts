import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Clarification item analysis scope (PostgreSQL E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterEach(async () => {
    await resetDatabase(prisma);
  });

  it('rejects a clarification whose source insight belongs to another analysis', async () => {
    const local = await createAnalysisGraph('Local analysis');
    const foreign = await createAnalysisGraph('Foreign analysis');

    await expect(prisma.clarificationItem.create({
      data: {
        impactAnalysisId: local.analysisId,
        sourceInsightId: foreign.insightId,
        question: 'Question from a different analysis',
        status: 'OPEN',
      },
    })).rejects.toMatchObject({ code: 'P2003' });

    expect(await prisma.clarificationItem.count()).toBe(0);

    const valid = await prisma.clarificationItem.create({
      data: {
        impactAnalysisId: foreign.analysisId,
        sourceInsightId: foreign.insightId,
        question: 'Question owned by this analysis',
        status: 'OPEN',
      },
    });
    expect(valid).toMatchObject({
      impactAnalysisId: foreign.analysisId,
      sourceInsightId: foreign.insightId,
    });
  });

  it('rejects a review clarification whose decision belongs to another analysis', async () => {
    const local = await createAnalysisGraph('Review request analysis');
    const foreign = await createAnalysisGraph('Review decision analysis');
    const reviewer = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: `review-scope-${randomUUID()}@ba-helper.local`,
        name: 'Scope Test Reviewer',
      },
    });
    const decision = await prisma.analysisReviewDecision.create({
      data: {
        id: randomUUID(),
        analysisId: foreign.analysisId,
        decision: 'NEEDS_MORE_CLARIFICATION',
        reviewedByUserId: reviewer.id,
      },
    });

    await expect(prisma.reviewClarificationRequest.create({
      data: {
        id: randomUUID(),
        analysisId: local.analysisId,
        reviewDecisionId: decision.id,
        question: 'Question sourced from a different analysis',
        createdByUserId: reviewer.id,
      },
    })).rejects.toMatchObject({ code: 'P2003' });
    expect(await prisma.reviewClarificationRequest.count()).toBe(0);

    const valid = await prisma.reviewClarificationRequest.create({
      data: {
        id: randomUUID(),
        analysisId: foreign.analysisId,
        reviewDecisionId: decision.id,
        question: 'Question owned by the same analysis',
        createdByUserId: reviewer.id,
      },
    });
    expect(valid).toMatchObject({
      analysisId: foreign.analysisId,
      reviewDecisionId: decision.id,
    });
  });

  async function createAnalysisGraph(label: string) {
    const project = await prisma.project.create({
      data: { id: randomUUID(), name: label },
    });
    const repository = await prisma.repository.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        canonicalUrl: `https://github.com/ba-helper/${project.id}`,
      },
    });
    const target = await prisma.repositoryTarget.create({
      data: {
        id: randomUUID(),
        repositoryId: repository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: `commit-${project.id}`,
        lastObservedAt: new Date(),
      },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        id: randomUUID(),
        repositoryId: repository.id,
        commitSha: `commit-${project.id}`,
        analyzerVersion: 'clarification-scope-test',
        coverageStatus: 'READY',
      },
    });
    const requirement = await prisma.requirement.create({
      data: { id: randomUUID(), projectId: project.id },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        id: randomUUID(),
        requirementId: requirement.id,
        title: label,
        rawText: `${label} request`,
        normalizedText: `${label} request`,
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const analysis = await prisma.impactAnalysis.create({
      data: {
        id: randomUUID(),
        requirementRevisionId: revision.id,
        requirementId: requirement.id,
        projectId: project.id,
        repositoryId: repository.id,
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        requestKey: randomUUID(),
        status: 'WAITING_FOR_REVIEW',
        stage: 'DONE',
      },
    });
    const insight = await prisma.baInsight.create({
      data: {
        id: randomUUID(),
        impactAnalysisId: analysis.id,
        insightKey: `question-${analysis.id}`,
        insightType: 'QUESTION',
        certainty: 'UNKNOWN',
        reviewStatus: 'NEEDS_REVIEW',
        title: `${label} question`,
        description: `${label} unresolved policy`,
      },
    });

    return { analysisId: analysis.id, insightId: insight.id };
  }
});
