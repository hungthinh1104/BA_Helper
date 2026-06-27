import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { grantProjectMembership } from './helpers/grant-project-membership';

describe('Error Mapping (E2E)', () => {
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
    await prisma.$disconnect();
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

  it('APPROVED_REPORT_NOT_FOUND maps to 404', async () => {
    const project = await prisma.project.create({ data: { name: 'P1' } });
    await grantProjectMembership(prisma, {
      projectId: project.id,
      userId: adminUserId,
      role: 'OWNER',
    });
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
        requestKey: crypto.randomUUID(),
        status: 'COMPLETED',
        stage: 'DONE',
      },
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/impact-analyses/${analysis.id}/approved-report`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(response.body).toMatchObject({
      code: 'APPROVED_REPORT_NOT_FOUND',
    });
  });

  it('INPUT_PROJECT_MISMATCH maps to 400', async () => {
    // We need a RequirementRevision in one project, and a Snapshot in another project
    const project1 = await prisma.project.create({ data: { name: 'P1' } });
    const project2 = await prisma.project.create({ data: { name: 'P2' } });
    await grantProjectMembership(prisma, {
      projectId: project1.id,
      userId: adminUserId,
      role: 'OWNER',
    });

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
      .set('Authorization', `Bearer ${adminToken}`)
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
    await grantProjectMembership(prisma, {
      projectId: project.id,
      userId: adminUserId,
      role: 'OWNER',
    });
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
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ acknowledgeUnreviewed: false })
      .expect(409);

    expect(response.body).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
  });
});
