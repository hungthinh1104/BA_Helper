import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { requirementDetailResponseSchema } from '@ba-helper/contracts';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';

describe('Project resource authorization (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let actorToken: string;
  let actorId: string;
  let ownProjectId: string;
  let foreignProjectId: string;
  let ownRequirementId: string;
  let foreignRequirementId: string;
  let foreignRevisionId: string;

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

    const actor = await prisma.user.create({
      data: {
        id: randomUUID(),
        email: 'project-resource-owner@ba-helper.local',
        role: 'ADMIN',
      },
    });
    actorId = actor.id;
    actorToken = jwtService.sign({ sub: actor.id, email: actor.email, role: actor.role });

    const ownProject = await prisma.project.create({
      data: { id: randomUUID(), name: 'Actor Project A' },
    });
    const foreignProject = await prisma.project.create({
      data: { id: randomUUID(), name: 'Protected Project B' },
    });
    ownProjectId = ownProject.id;
    foreignProjectId = foreignProject.id;
    await grantProjectMembership(prisma, {
      projectId: ownProject.id,
      userId: actor.id,
      role: 'OWNER',
    });

    const ownRequirement = await prisma.requirement.create({
      data: { id: randomUUID(), projectId: ownProject.id },
    });
    ownRequirementId = ownRequirement.id;
    await prisma.requirementRevision.create({
      data: {
        id: randomUUID(),
        requirementId: ownRequirement.id,
        title: 'Project A requirement',
        rawText: 'Allow users to cancel paid bookings and receive a refund.',
        normalizedText: 'Allow users to cancel paid bookings and receive a refund.',
        readinessStatus: 'DRAFT',
      },
    });

    const foreignRequirement = await prisma.requirement.create({
      data: { id: randomUUID(), projectId: foreignProject.id },
    });
    foreignRequirementId = foreignRequirement.id;
    const foreignRevision = await prisma.requirementRevision.create({
      data: {
        id: randomUUID(),
        requirementId: foreignRequirement.id,
        title: 'Project B confidential requirement',
        rawText: 'Allow paid booking cancellation and refund.',
        normalizedText: 'Allow paid booking cancellation and refund.',
        readinessStatus: 'DRAFT',
      },
    });
    foreignRevisionId = foreignRevision.id;

    await expect(
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: ownProjectId, userId: actorId } },
      }),
    ).resolves.toMatchObject({ role: 'OWNER' });
    await expect(
      prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId: foreignProjectId, userId: actorId } },
      }),
    ).resolves.toBeNull();
  });

  it('hides a foreign requirement ID when the actor is scoped to another project', async () => {
    const ownRead = await request(app.getHttpServer())
      .get(`/api/v1/projects/${ownProjectId}/requirements/${ownRequirementId}`)
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(200);
    expect(requirementDetailResponseSchema.parse(ownRead.body).id).toBe(ownRequirementId);

    const read = await request(app.getHttpServer())
      .get(`/api/v1/projects/${ownProjectId}/requirements/${foreignRequirementId}`)
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(404);
    expect(JSON.stringify(read.body)).not.toContain('Project B confidential requirement');
  });

  it('rejects foreign requirement revision writes and qualification without changing PostgreSQL state', async () => {
    const revisionsBefore = await prisma.requirementRevision.findMany({
      where: { requirementId: foreignRequirementId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, title: true, readinessStatus: true, createdAt: true },
    });
    const domainEventsBefore = await prisma.domainEvent.count();

    await request(app.getHttpServer())
      .post(`/api/v1/requirements/${foreignRequirementId}/revisions`)
      .set('Authorization', `Bearer ${actorToken}`)
      .send({
        title: 'Unauthorized revision',
        rawText: 'A valid proposed requirement change.',
        submitForReadinessCheck: false,
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`/api/v1/requirement-revisions/${foreignRevisionId}/qualify`)
      .set('Authorization', `Bearer ${actorToken}`)
      .expect(404);

    await expect(
      prisma.requirementRevision.findMany({
        where: { requirementId: foreignRequirementId },
        orderBy: { createdAt: 'asc' },
        select: { id: true, title: true, readinessStatus: true, createdAt: true },
      }),
    ).resolves.toEqual(revisionsBefore);
    await expect(prisma.domainEvent.count()).resolves.toBe(domainEventsBefore);
  });
});
