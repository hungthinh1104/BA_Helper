import type { INestApplication } from '@nestjs/common';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import * as crypto from 'crypto';

describe('Scan job repository scope (PostgreSQL E2E)', () => {
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

  it.each(['source target', 'repository snapshot'] as const)(
    'rejects a scan job whose %s belongs to another repository',
    async (foreignRelation) => {
      const projectA = await prisma.project.create({ data: { name: 'Scan scope A' } });
      const projectB = await prisma.project.create({ data: { name: 'Scan scope B' } });
      const repositoryA = await prisma.repository.create({
        data: { projectId: projectA.id, canonicalUrl: `https://github.com/test/scan-a-${crypto.randomUUID()}` },
      });
      const repositoryB = await prisma.repository.create({
        data: { projectId: projectB.id, canonicalUrl: `https://github.com/test/scan-b-${crypto.randomUUID()}` },
      });
      const foreignTarget = await prisma.repositoryTarget.create({
        data: {
          repositoryId: repositoryB.id,
          targetKey: 'main',
          requestedRef: 'main',
          resolvedRefType: 'BRANCH',
          latestObservedCommitSha: 'foreign-commit',
          lastObservedAt: new Date(),
        },
      });
      const foreignSnapshot = await prisma.repositorySnapshot.create({
        data: {
          repositoryId: repositoryB.id,
          commitSha: 'foreign-commit',
          analyzerVersion: 'scan-scope-test',
          coverageStatus: 'READY',
        },
      });
      const requestKey = crypto.randomUUID();
      const foreignReference = foreignRelation === 'source target'
        ? { sourceTargetId: foreignTarget.id }
        : { snapshotId: foreignSnapshot.id };

      try {
        await expect(prisma.scanJob.create({
          data: {
            repositoryId: repositoryA.id,
            requestKey,
            status: 'QUEUED',
            stage: 'WAITING',
            ...foreignReference,
          },
        })).rejects.toMatchObject({ code: 'P2003' });
      } finally {
        await prisma.scanJob.deleteMany({ where: { repositoryId: repositoryA.id, requestKey } });
      }
    },
  );
});
