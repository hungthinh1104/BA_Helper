import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';

describe('Project membership object authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let ownerUserId: string;
  let reviewerUserId: string;
  let viewerUserId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let viewerToken: string;
  let protectedProjectId: string;

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

    const [owner, reviewer, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'membership-owner@ba-helper.local',
          role: 'ADMIN',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'membership-outsider@ba-helper.local',
          role: 'REVIEWER',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'membership-viewer@ba-helper.local',
          role: 'VIEWER',
        },
      }),
    ]);

    ownerUserId = owner.id;
    reviewerUserId = reviewer.id;
    viewerUserId = viewer.id;
    ownerToken = jwtService.sign({ sub: owner.id, email: owner.email, role: owner.role });
    reviewerToken = jwtService.sign({ sub: reviewer.id, email: reviewer.email, role: reviewer.role });
    viewerToken = jwtService.sign({ sub: viewer.id, email: viewer.email, role: viewer.role });

    const ownProject = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Outsider owner project' },
    });
    const protectedProject = await prisma.project.create({
      data: { id: crypto.randomUUID(), name: 'Protected membership project' },
    });
    protectedProjectId = protectedProject.id;

    await Promise.all([
      grantProjectMembership(prisma, {
        projectId: ownProject.id,
        userId: reviewerUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId: protectedProjectId,
        userId: ownerUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId: protectedProjectId,
        userId: viewerUserId,
        role: 'VIEWER',
      }),
    ]);

    await prisma.user.update({
      where: { id: viewerUserId },
      data: { selectedProjectId: protectedProjectId },
    });
  });

  it('denies outsider and viewer membership writes without leaking or changing project state', async () => {
    const membersPath = `/api/v1/projects/${protectedProjectId}/members`;

    const outsiderRead = await request(app.getHttpServer())
      .get(membersPath)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(404);
    expect(JSON.stringify(outsiderRead.body)).not.toContain('membership-viewer@ba-helper.local');

    await request(app.getHttpServer())
      .post(membersPath)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({
        email: 'must-not-be-created@ba-helper.local',
        initialPassword: 'initial-password-123',
        role: 'ANALYST',
      })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${membersPath}/${viewerUserId}`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ role: 'ANALYST' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${membersPath}/${viewerUserId}`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(404);

    const viewerRead = await request(app.getHttpServer())
      .get(membersPath)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);
    expect(viewerRead.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: ownerUserId, role: 'OWNER' }),
        expect.objectContaining({ userId: viewerUserId, role: 'VIEWER' }),
      ]),
    );

    await request(app.getHttpServer())
      .post(membersPath)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        email: 'viewer-must-not-create@ba-helper.local',
        initialPassword: 'initial-password-123',
        role: 'VIEWER',
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`${membersPath}/${ownerUserId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ role: 'MAINTAINER' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`${membersPath}/${ownerUserId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(403);

    const unknownUserId = crypto.randomUUID();
    await request(app.getHttpServer())
      .patch(`${membersPath}/${unknownUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'ANALYST' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${membersPath}/${unknownUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);

    // The project owner cannot use a valid user ID from another project as a nested member ID.
    await request(app.getHttpServer())
      .patch(`${membersPath}/${reviewerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ role: 'ANALYST' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`${membersPath}/${reviewerUserId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);

    await expect(
      prisma.user.findUnique({ where: { email: 'must-not-be-created@ba-helper.local' } }),
    ).resolves.toBeNull();
    await expect(
      prisma.user.findUnique({ where: { email: 'viewer-must-not-create@ba-helper.local' } }),
    ).resolves.toBeNull();
    await expect(
      prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: protectedProjectId,
            userId: viewerUserId,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'VIEWER' });
    await expect(
      prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: protectedProjectId,
            userId: ownerUserId,
          },
        },
      }),
    ).resolves.toMatchObject({ role: 'OWNER' });
    await expect(
      prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: protectedProjectId,
            userId: reviewerUserId,
          },
        },
      }),
    ).resolves.toBeNull();
    await expect(
      prisma.user.findUnique({ where: { id: viewerUserId } }),
    ).resolves.toMatchObject({ selectedProjectId: protectedProjectId });
  });
});
