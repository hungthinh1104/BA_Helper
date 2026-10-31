import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { errorCodeSchema, projectCreateResponseSchema, requirementCreateResponseSchema } from '@ba-helper/contracts';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Requirement secret input protection (API + PostgreSQL E2E)', () => {
  let api: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminToken: string;
  let projectId: string;
  let requirementId: string;

  beforeAll(async () => {
    api = await createTestApp();
    prisma = api.get(PrismaService);
    jwt = api.get(JwtService);
  }, 120_000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        email: `requirement-secret-${randomUUID()}@ba-helper.local`,
        role: 'ADMIN',
      },
    });
    adminToken = jwt.sign({ sub: user.id, email: user.email, role: user.role });

    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Requirement Secret Input Project' })
      .expect(201);
    projectId = projectCreateResponseSchema.parse(projectResponse.body).projectId;

    const requirementResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: randomUUID(),
        title: 'Baseline safe requirement',
        rawText: 'Allow users to cancel paid bookings and receive a refund.',
        submitForReadinessCheck: false,
      })
      .expect(201);
    requirementId = requirementCreateResponseSchema.parse(requirementResponse.body).requirementId;
  });

  afterEach(async () => {
    await resetDatabase(prisma);
  });

  it('rejects a provider token before either initial or revised requirement text is persisted', async () => {
    const secret = 'sk-proj-input-boundary-secret-0123456789abcdef';
    const rawText = `Allow users to cancel paid bookings. OPENAI_API_KEY=${secret}`;
    const before = await persistedCounts(secret);

    const initialResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${projectId}/requirements`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        requestKey: randomUUID(),
        title: 'Secret-bearing initial requirement',
        rawText,
        submitForReadinessCheck: true,
      });

    const revisionResponse = await request(api.getHttpServer())
      .post(`/api/v1/requirements/${requirementId}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Secret-bearing revision', rawText, submitForReadinessCheck: true });

    const after = await persistedCounts(secret);
    const errorCodes = [initialResponse.body.code, revisionResponse.body.code];
    const responseContainsSecret = [initialResponse, revisionResponse]
      .some((response) => JSON.stringify(response.body).includes(secret));

    expect({
      statuses: [initialResponse.status, revisionResponse.status],
      errorCodes,
      after,
      responseContainsSecret,
    }).toEqual({
      statuses: [400, 400],
      errorCodes: ['INVALID_REQUIREMENT_INPUT', 'INVALID_REQUIREMENT_INPUT'],
      after: before,
      responseContainsSecret: false,
    });
    expect(errorCodes.map((code) => errorCodeSchema.parse(code))).toEqual([
      'INVALID_REQUIREMENT_INPUT',
      'INVALID_REQUIREMENT_INPUT',
    ]);
  }, 30_000);

  async function persistedCounts(secret: string) {
    const [requirements, revisions, requirementEvents, revisionEvents, secretBearingRevisions] = await Promise.all([
      prisma.requirement.count({ where: { projectId } }),
      prisma.requirementRevision.count({ where: { requirement: { projectId } } }),
      prisma.domainEvent.count({ where: { eventType: 'REQUIREMENT_CREATED' } }),
      prisma.domainEvent.count({ where: { eventType: 'REQUIREMENT_REVISION_CREATED' } }),
      prisma.requirementRevision.count({ where: { rawText: { contains: secret } } }),
    ]);
    return { requirements, revisions, requirementEvents, revisionEvents, secretBearingRevisions };
  }
});
