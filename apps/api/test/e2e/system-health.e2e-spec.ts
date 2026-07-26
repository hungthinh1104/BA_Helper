import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  systemLivenessResponseSchema,
  systemOperationsResponseSchema,
  systemReadinessResponseSchema,
} from '@ba-helper/contracts';
import { PrismaService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('System Health (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  const originalWorkspaceMode = process.env.WORKSPACE_MODE;
  const originalAppVersion = process.env.APP_VERSION;

  beforeAll(async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';
    process.env.APP_VERSION = '0.1.0-test';
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await resetDatabase(prisma);
    const admin = await prisma.user.create({
      data: { email: 'ops-admin@example.com', name: 'Ops', role: 'ADMIN' },
    });
    const jwt = app.get(JwtService);
    adminToken = jwt.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      name: admin.name,
    });
  });

  afterAll(async () => {
    process.env.WORKSPACE_MODE = originalWorkspaceMode;
    process.env.APP_VERSION = originalAppVersion;
    await app.close();
  });

  it('exposes public liveness with no dependency or operational detail', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/system/live')
      .expect(200);
    const live = systemLivenessResponseSchema.parse(response.body);
    expect(live.status).toBe('ok');
    expect(response.body).not.toHaveProperty('dependencies');
    expect(response.body).not.toHaveProperty('operations');
    expect(response.body).not.toHaveProperty('workspaceMode');
  });

  it('exposes public readiness with dependency status but NO workspace/operations leak', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/system/ready')
      .expect(200);
    const ready = systemReadinessResponseSchema.parse(response.body);
    expect(['ok', 'degraded']).toContain(ready.status);
    expect(ready.dependencies).toMatchObject({
      database: expect.stringMatching(/up|down/),
      pgvector: expect.stringMatching(/up|down/),
      queue: expect.stringMatching(/up|down/),
      redis: expect.stringMatching(/up|down/),
    });
    // The public surface must not leak operational or configuration detail.
    expect(response.body).not.toHaveProperty('operations');
    expect(response.body).not.toHaveProperty('workspaceMode');
    expect(JSON.stringify(response.body)).not.toContain('dev-single-user');
  });

  it('refuses the operations endpoint without an admin token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/system/operations')
      .expect(401);
  });

  it('serves operations detail to an admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/system/operations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const ops = systemOperationsResponseSchema.parse(response.body);
    expect(ops).toMatchObject({
      apiVersion: '0.1.0-test',
      workspaceMode: 'dev-single-user',
    });
    expect(ops.operations.scanJobs).toHaveProperty('failed');
  });
});
