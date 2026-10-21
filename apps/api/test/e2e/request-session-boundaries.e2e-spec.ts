import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { grantProjectMembership } from './helpers/grant-project-membership';
import { resetDatabase } from './helpers/reset-db';

describe('request and session boundaries', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let userId: string;
  let projectId: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
  });
  afterAll(async () => { await app?.close(); });
  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({ data: { email: 'boundaries@test.local', role: 'ADMIN' } });
    userId = user.id;
    const project = await prisma.project.create({ data: { name: 'Boundary test' } });
    projectId = project.id;
    await grantProjectMembership(prisma, { projectId, userId, role: 'OWNER' });
    await prisma.user.update({ where: { id: userId }, data: { selectedProjectId: projectId } });
    token = jwt.sign({ sub: userId, credentialsVersion: 1 });
  });

  it.each([
    { name: 'disabled account', update: { disabledAt: new Date() } },
    { name: 'reset password or changed role', update: { credentialsVersion: 2 } },
  ])('rejects a previously valid workspace token after $name', async ({ update }) => {
    await request(app.getHttpServer()).get('/api/v1/workspace/current').set('Authorization', `Bearer ${token}`).expect(200);
    await prisma.user.update({ where: { id: userId }, data: update });
    for (const path of ['/api/v1/workspace/current', '/api/v1/auth/me']) {
      await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${token}`).expect(401);
    }
  });

  it.each([{}, { sub: '' }, { sub: 'invalid-uuid' }, { sub: 123 }, { sub: randomUUID(), credentialsVersion: '1' }])(
    'rejects malformed signed claims as 401: %j', async claims => {
      const malformed = jwt.sign(claims);
      for (const path of ['/api/v1/workspace/current', '/api/v1/auth/me']) {
        await request(app.getHttpServer()).get(path).set('Authorization', `Bearer ${malformed}`).expect(401);
      }
    },
  );

  it('keeps anonymous workspace bootstrap and valid legacy tokens working', async () => {
    await request(app.getHttpServer()).get('/api/v1/workspace/current').expect(200);
    const legacyToken = jwt.sign({ sub: userId, role: 'VIEWER' });
    const me = await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${legacyToken}`).expect(200);
    expect(me.body.role).toBe('ADMIN'); // persisted account role wins over token claims
    await request(app.getHttpServer()).get('/api/v1/workspace/current').set('Authorization', `Bearer ${legacyToken}`).expect(200);
  });

  it.each([
    ['post', '/api/v1/projects', {}],
    ['post', '/api/v1/workspace/select-project', { projectId: 'not-a-uuid' }],
    ['post', '/api/v1/auth/accounts', { email: 'invalid', password: 'not-a-secret-test-marker' }],
    ['post', '/api/v1/projects/PROJECT/requirements', { title: '', rawText: 'not-a-secret-test-marker' }],
    ['get', '/api/v1/projects/PROJECT/repositories?limit=101', undefined],
  ])('maps invalid %s %s input to a safe 400 without persistence', async (method, path, body) => {
    const endpoint = path.replace('PROJECT', projectId);
    const before = await prisma.user.count();
    const call = method === 'get' ? request(app.getHttpServer()).get(endpoint) : request(app.getHttpServer()).post(endpoint);
    const result = await call.set('Authorization', `Bearer ${token}`).send(body).expect(400);
    expect(result.body.statusCode).toBe(400);
    expect(JSON.stringify(result.body)).not.toContain('not-a-secret-test-marker');
    expect(await prisma.user.count()).toBe(before);
    expect(await prisma.requirement.count()).toBe(0);
    expect(await prisma.project.count()).toBe(1);
  });

  it('preserves permission-before-input ordering for hidden project resources', async () => {
    await request(app.getHttpServer()).post(`/api/v1/projects/${randomUUID()}/requirements`)
      .set('Authorization', `Bearer ${token}`).send({}).expect(404);
  });
});
