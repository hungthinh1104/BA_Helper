import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { grantProjectMembership } from './helpers/grant-project-membership';

describe('Project switching and membership (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminUserId: string;
  let reviewerUserId: string;
  let viewerUserId: string;
  let adminToken: string;
  let reviewerToken: string;
  let viewerToken: string;
  let originalWorkspaceMode: string | undefined;

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
    originalWorkspaceMode = process.env.WORKSPACE_MODE;
    process.env.WORKSPACE_MODE = 'dev-single-user';

    const [admin, reviewer, viewer] = await Promise.all([
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'admin@ba-helper.local',
          name: 'Admin',
          role: 'ADMIN',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'reviewer@ba-helper.local',
          name: 'Reviewer',
          role: 'REVIEWER',
        },
      }),
      prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'viewer@ba-helper.local',
          name: 'Viewer',
          role: 'VIEWER',
        },
      }),
    ]);

    adminUserId = admin.id;
    reviewerUserId = reviewer.id;
    viewerUserId = viewer.id;

    adminToken = jwtService.sign({ sub: admin.id, email: admin.email, role: admin.role, name: admin.name });
    reviewerToken = jwtService.sign({ sub: reviewer.id, email: reviewer.email, role: reviewer.role, name: reviewer.name });
    viewerToken = jwtService.sign({ sub: viewer.id, email: viewer.email, role: viewer.role, name: viewer.name });
  });

  afterEach(() => {
    if (originalWorkspaceMode === undefined) {
      delete process.env.WORKSPACE_MODE;
    } else {
      process.env.WORKSPACE_MODE = originalWorkspaceMode;
    }
  });

  async function seedProjects() {
    const firstProjectId = crypto.randomUUID();
    const secondProjectId = crypto.randomUUID();

    await prisma.project.create({
      data: {
        id: firstProjectId,
        name: 'Alpha Project',
      },
    });
    await prisma.project.create({
      data: {
        id: secondProjectId,
        name: 'Beta Project',
      },
    });

    await Promise.all([
      grantProjectMembership(prisma, {
        projectId: firstProjectId,
        userId: adminUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId: firstProjectId,
        userId: reviewerUserId,
        role: 'REVIEWER',
      }),
      grantProjectMembership(prisma, {
        projectId: firstProjectId,
        userId: viewerUserId,
        role: 'VIEWER',
      }),
      grantProjectMembership(prisma, {
        projectId: secondProjectId,
        userId: adminUserId,
        role: 'OWNER',
      }),
      grantProjectMembership(prisma, {
        projectId: secondProjectId,
        userId: reviewerUserId,
        role: 'REVIEWER',
      }),
    ]);

    return { firstProjectId, secondProjectId };
  }

  it('returns the persisted selected project and falls back when it becomes stale', async () => {
    const { firstProjectId, secondProjectId } = await seedProjects();
    await prisma.user.update({
      where: { id: adminUserId },
      data: { selectedProjectId: secondProjectId },
    });

    const selectedResponse = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(selectedResponse.body.projectId).toBe(secondProjectId);
    expect(selectedResponse.body.membershipRole).toBe('OWNER');

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: secondProjectId,
          userId: adminUserId,
        },
      },
    });

    const fallbackResponse = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(fallbackResponse.body.projectId).toBe(firstProjectId);

    const user = await prisma.user.findUnique({ where: { id: adminUserId } });
    expect(user?.selectedProjectId).toBe(firstProjectId);
  });

  it('lists accessible projects and marks the selected one', async () => {
    const { firstProjectId, secondProjectId } = await seedProjects();
    await prisma.user.update({
      where: { id: reviewerUserId },
      data: { selectedProjectId: secondProjectId },
    });

    const response = await request(app.getHttpServer())
      .get('/api/v1/projects')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .expect(200);

    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          projectId: firstProjectId,
          membershipRole: 'REVIEWER',
          isSelected: false,
        }),
        expect.objectContaining({
          projectId: secondProjectId,
          membershipRole: 'REVIEWER',
          isSelected: true,
        }),
      ]),
    );
  });

  it('switches project for a member and returns 404 outside membership', async () => {
    const { firstProjectId, secondProjectId } = await seedProjects();

    const switchResponse = await request(app.getHttpServer())
      .post('/api/v1/workspace/select-project')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ projectId: secondProjectId })
      .expect(201);

    expect(switchResponse.body.projectId).toBe(secondProjectId);

    const outsiderProjectId = crypto.randomUUID();
    await prisma.project.create({
      data: { id: outsiderProjectId, name: 'Gamma Project' },
    });

    await request(app.getHttpServer())
      .post('/api/v1/workspace/select-project')
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ projectId: outsiderProjectId })
      .expect(404);

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerUserId } });
    expect(reviewer?.selectedProjectId).toBe(secondProjectId);
    expect(firstProjectId).toBeDefined();
  });

  it('allows OWNER to add members by existing email and rejects unknown email', async () => {
    const { firstProjectId } = await seedProjects();
    const newUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'analyst@ba-helper.local',
        name: 'Analyst',
        role: 'REVIEWER',
      },
    });

    const addResponse = await request(app.getHttpServer())
      .post(`/api/v1/projects/${firstProjectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: newUser.email, role: 'ANALYST' })
      .expect(201);

    expect(addResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: newUser.email,
          role: 'ANALYST',
        }),
      ]),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/projects/${firstProjectId}/members`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'missing@ba-helper.local', role: 'VIEWER' })
      .expect(404)
      .expect(({ body }) => {
        expect(body.code).toBe('PROJECT_MEMBER_USER_NOT_FOUND');
      });
  });

  it('blocks non-owner membership mutation and protects the last owner', async () => {
    const { firstProjectId } = await seedProjects();

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${firstProjectId}/members/${viewerUserId}`)
      .set('Authorization', `Bearer ${reviewerToken}`)
      .send({ role: 'ANALYST' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/projects/${firstProjectId}/members/${adminUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MAINTAINER' })
      .expect(409)
      .expect(({ body }) => {
        expect(body.code).toBe('LAST_PROJECT_OWNER_REQUIRED');
      });
  });

  it('clears selectedProjectId when a removed member had that project selected', async () => {
    const { firstProjectId } = await seedProjects();

    await prisma.user.update({
      where: { id: reviewerUserId },
      data: { selectedProjectId: firstProjectId },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/projects/${firstProjectId}/members/${reviewerUserId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const reviewer = await prisma.user.findUnique({ where: { id: reviewerUserId } });
    expect(reviewer?.selectedProjectId).toBeNull();
  });
});
