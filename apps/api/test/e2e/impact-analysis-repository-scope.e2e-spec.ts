import type { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Impact analysis repository scope (PostgreSQL E2E)', () => {
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

  it('rejects an analysis whose selected target belongs to another snapshot repository', async () => {
    const projectA = await prisma.project.create({ data: { name: 'Analysis scope A' } });
    const projectB = await prisma.project.create({ data: { name: 'Analysis scope B' } });
    const repositoryA = await prisma.repository.create({
      data: { projectId: projectA.id, canonicalUrl: `https://github.com/test/analysis-a-${crypto.randomUUID()}` },
    });
    const repositoryB = await prisma.repository.create({
      data: { projectId: projectB.id, canonicalUrl: `https://github.com/test/analysis-b-${crypto.randomUUID()}` },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repositoryA.id,
        commitSha: 'analysis-scope-commit-a',
        analyzerVersion: 'analysis-scope-test',
        coverageStatus: 'READY',
      },
    });
    const foreignTarget = await prisma.repositoryTarget.create({
      data: {
        repositoryId: repositoryB.id,
        targetKey: 'branch:main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'analysis-scope-commit-b',
        lastObservedAt: new Date(),
      },
    });
    const requirement = await prisma.requirement.create({
      data: { projectId: projectA.id, requestKey: crypto.randomUUID(), requestPayloadHash: 'scope-test' },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        requirementId: requirement.id,
        title: 'Refund a paid booking',
        rawText: 'Refund a paid booking after cancellation.',
        normalizedText: 'Refund a paid booking after cancellation.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const requestKey = crypto.randomUUID();

    try {
      await expect(prisma.impactAnalysis.create({
        data: {
          requirementRevisionId: revision.id,
          requirementId: requirement.id,
          projectId: projectA.id,
          repositoryId: snapshot.repositoryId,
          snapshotId: snapshot.id,
          sourceTargetId: foreignTarget.id,
          requestKey,
          status: 'COMPLETED',
          stage: 'DONE',
        },
      })).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      await prisma.impactAnalysis.deleteMany({ where: { requestKey } });
    }
  });

  it('rejects an analysis whose requirement project differs from its repository project', async () => {
    const projectA = await prisma.project.create({ data: { name: 'Analysis project scope A' } });
    const projectB = await prisma.project.create({ data: { name: 'Analysis project scope B' } });
    const repositoryB = await prisma.repository.create({
      data: { projectId: projectB.id, canonicalUrl: `https://github.com/test/analysis-project-b-${crypto.randomUUID()}` },
    });
    const snapshotB = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repositoryB.id,
        commitSha: 'analysis-project-scope-commit-b',
        analyzerVersion: 'analysis-project-scope-test',
        coverageStatus: 'READY',
      },
    });
    const targetB = await prisma.repositoryTarget.create({
      data: {
        repositoryId: repositoryB.id,
        targetKey: 'branch:main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'analysis-project-scope-commit-b',
        lastObservedAt: new Date(),
      },
    });
    const requirementA = await prisma.requirement.create({
      data: { projectId: projectA.id, requestKey: crypto.randomUUID(), requestPayloadHash: 'scope-test' },
    });
    const revisionA = await prisma.requirementRevision.create({
      data: {
        requirementId: requirementA.id,
        title: 'Refund a paid booking',
        rawText: 'Refund a paid booking after cancellation.',
        normalizedText: 'Refund a paid booking after cancellation.',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    const requestKey = crypto.randomUUID();

    try {
      await expect(prisma.impactAnalysis.create({
        data: {
          requirementRevisionId: revisionA.id,
          requirementId: requirementA.id,
          projectId: projectB.id,
          repositoryId: repositoryB.id,
          snapshotId: snapshotB.id,
          sourceTargetId: targetB.id,
          requestKey,
          status: 'COMPLETED',
          stage: 'DONE',
        },
      })).rejects.toMatchObject({ code: 'P2003' });
    } finally {
      await prisma.impactAnalysis.deleteMany({ where: { requestKey } });
    }
  });
});
