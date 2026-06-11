import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';

describe('Error Mapping (E2E)', () => {
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

  it('APPROVED_REPORT_NOT_FOUND maps to 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/impact-analyses/dummy-id/approved-report')
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'APPROVED_REPORT_NOT_FOUND',
    });
  });

  it('INPUT_PROJECT_MISMATCH maps to 400', async () => {
    // We need a RequirementRevision in one project, and a Snapshot in another project
    const project1 = await prisma.project.create({ data: { name: 'P1' } });
    const project2 = await prisma.project.create({ data: { name: 'P2' } });

    const requirement = await prisma.requirement.create({
      data: { projectId: project1.id },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        requirementId: requirement.id,
        title: 'Title',
        rawText: 'Raw',
        normalizedText: 'Norm',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    const repository = await prisma.repository.create({
      data: { projectId: project2.id, canonicalUrl: 'https://github.com/a/b' },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.id,
        commitSha: 'abc',
        analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
        coverageStatus: 'READY',
      },
    });
    const target = await prisma.repositoryTarget.create({
      data: {
        repositoryId: repository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc',
        lastObservedAt: new Date(),
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${revision.id}/impact-analyses`)
      .send({
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        allowPartialSnapshot: false,
        requestKey: '11111111-1111-1111-1111-111111111111',
      })
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'INPUT_PROJECT_MISMATCH',
    });
  });

  it('INVALID_STATE_TRANSITION maps to 409', async () => {
    const project = await prisma.project.create({ data: { name: 'P1' } });
    const requirement = await prisma.requirement.create({
      data: { projectId: project.id },
    });
    const revision = await prisma.requirementRevision.create({
      data: {
        requirementId: requirement.id,
        title: 'Title',
        rawText: 'Raw',
        normalizedText: 'Norm',
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });

    const repository = await prisma.repository.create({
      data: { projectId: project.id, canonicalUrl: 'https://github.com/a/b' },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.id,
        commitSha: 'abc',
        analyzerVersion: 'ts-nestjs-analyzer@0.1.0',
        coverageStatus: 'READY',
      },
    });
    const target = await prisma.repositoryTarget.create({
      data: {
        repositoryId: repository.id,
        targetKey: 'main',
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc',
        lastObservedAt: new Date(),
      },
    });

    const analysis = await prisma.impactAnalysis.create({
      data: {
        requirementRevisionId: revision.id,
        snapshotId: snapshot.id,
        sourceTargetId: target.id,
        requestKey: 'req-1',
        status: 'QUEUED', // Not WAITING_FOR_REVIEW
        stage: 'WAITING',
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/impact-analyses/${analysis.id}/finalize`)
      .send({ acknowledgeUnreviewed: false })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });
});
