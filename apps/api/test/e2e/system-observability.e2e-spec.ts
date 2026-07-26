import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';

describe('System observability (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a safe caller-provided request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/system/live')
      .set('x-request-id', 'beta-check-12345')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('beta-check-12345');
  });

  it('replaces an invalid request id', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/system/live')
      .set('x-request-id', 'unsafe value with spaces')
      .expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[a-f0-9-]{36}$/,
    );
  });
});
