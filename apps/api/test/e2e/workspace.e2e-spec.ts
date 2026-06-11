import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as crypto from 'crypto';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import { currentWorkspaceResponseSchema } from '@ba-helper/contracts';

describe('Workspace Resolution (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  const originalWorkspaceMode = process.env.WORKSPACE_MODE;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    process.env.WORKSPACE_MODE = originalWorkspaceMode;
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: 'admin@ba-helper.local',
        name: 'John Doe',
        role: 'ADMIN',
      },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  });

  it('returns the same default workspace across repeated calls', async () => {
    const firstResponse = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const firstWorkspace = currentWorkspaceResponseSchema.parse(firstResponse.body);

    const secondResponse = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const secondWorkspace = currentWorkspaceResponseSchema.parse(secondResponse.body);

    expect(secondWorkspace).toMatchObject({
      projectId: firstWorkspace.projectId,
      name: 'Default Project',
      mode: 'dev-single-user',
    });

    const projects = await prisma.project.findMany();
    expect(projects).toHaveLength(1);
  });

  it('returns a typed error when workspace mode is unsupported', async () => {
    process.env.WORKSPACE_MODE = 'auth';

    const response = await request(app.getHttpServer())
      .get('/api/v1/workspace/current')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    expect(response.body).toMatchObject({
      code: 'WORKSPACE_MODE_UNSUPPORTED',
    });
  });
});
