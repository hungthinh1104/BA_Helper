import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { multiRepoImpactAnalysisCreateResponseSchema } from '@ba-helper/contracts';

describe('Multi-repo analysis fan-out (e2e)', () => {
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
        name: 'Multi Repo Project',
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
        title: 'Refund paid bookings across services',
        rawText:
          'Allow users to cancel paid bookings and receive refund across booking and payment services.',
        normalizedText:
          'Allow users to cancel paid bookings and receive refund across booking and payment services.',
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

    return { repositoryId, snapshotId, targetId };
  }

  it('creates one normal analysis per selected repository in the same project', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const booking = await seedRepository(projectId, 'booking-service');
    const payment = await seedRepository(projectId, 'payment-service');

    const response = await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [booking.repositoryId, payment.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(201);

    const result = multiRepoImpactAnalysisCreateResponseSchema.parse(
      response.body,
    );

    expect(result.items).toHaveLength(2);
    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          repositoryId: booking.repositoryId,
          snapshotId: booking.snapshotId,
          sourceTargetId: booking.targetId,
          status: 'QUEUED',
        }),
        expect.objectContaining({
          repositoryId: payment.repositoryId,
          snapshotId: payment.snapshotId,
          sourceTargetId: payment.targetId,
          status: 'QUEUED',
        }),
      ]),
    );

    const persisted = await prisma.impactAnalysis.findMany({
      where: {
        requirementRevisionId: revisionId,
      },
      orderBy: { createdAt: 'asc' },
    });

    expect(persisted).toHaveLength(2);
    expect(new Set(persisted.map((item) => item.snapshotId))).toEqual(
      new Set([booking.snapshotId, payment.snapshotId]),
    );
  });

  it('returns 404 when any selected repository is outside the project', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const inProject = await seedRepository(projectId, 'booking-service');

    const outsiderProjectId = crypto.randomUUID();
    await prisma.project.create({
      data: {
        id: outsiderProjectId,
        name: 'Other Project',
      },
    });
    const outsider = await seedRepository(outsiderProjectId, 'other-service');

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [inProject.repositoryId, outsider.repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(404);
  });

  it('returns 409 when a repository has no analyzable observed snapshot', async () => {
    const { projectId, revisionId } = await seedProjectWithReadyRequirement();
    const readyRepository = await seedRepository(projectId, 'booking-service');
    const repositoryId = crypto.randomUUID();

    await prisma.repository.create({
      data: {
        id: repositoryId,
        projectId,
        canonicalUrl: 'https://github.com/example/no-target-service',
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${projectId}/multi-repo-analyses`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requirementRevisionId: revisionId,
        repositoryIds: [readyRepository.repositoryId, repositoryId],
        allowPartialSnapshot: false,
        requestKey: crypto.randomUUID(),
      })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('REPOSITORY_NOT_ANALYZABLE');
      });
  });
});
