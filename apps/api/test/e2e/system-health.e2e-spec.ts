import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { systemHealthResponseSchema } from '@ba-helper/contracts';
import { createTestApp } from './helpers/test-app';

describe('System Health (E2E)', () => {
  let app: INestApplication;
  const originalWorkspaceMode = process.env.WORKSPACE_MODE;
  const originalAppVersion = process.env.APP_VERSION;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    process.env.WORKSPACE_MODE = originalWorkspaceMode;
    process.env.APP_VERSION = originalAppVersion;
    await app.close();
  });

  it('returns a stable deploy/debug health contract', async () => {
    process.env.WORKSPACE_MODE = 'dev-single-user';
    process.env.APP_VERSION = '0.1.0-test';

    const response = await request(app.getHttpServer())
      .get('/api/v1/system/health')
      .expect(200);

    const health = systemHealthResponseSchema.parse(response.body);
    expect(health).toMatchObject({
      apiVersion: '0.1.0-test',
      workspaceMode: 'dev-single-user',
    });
    expect(['ok', 'degraded']).toContain(health.status);
    expect(health.dependencies).toMatchObject({
      database: expect.stringMatching(/up|down/),
      pgvector: expect.stringMatching(/up|down/),
      queue: expect.stringMatching(/up|down/),
      redis: expect.stringMatching(/up|down/),
    });
    expect(Date.parse(health.serverTime)).not.toBeNaN();
  });
});
