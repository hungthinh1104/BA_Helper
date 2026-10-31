import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
} from '@ba-helper/contracts';
import { EmbeddingProviderPort } from '@ba-helper/application';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { HybridRetrievalService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Retrieval provider redaction (API + PostgreSQL E2E)', () => {
  let api: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let adminToken: string;

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
        email: `retrieval-redaction-${randomUUID()}@ba-helper.local`,
        role: 'ADMIN',
      },
    });
    adminToken = jwt.sign({ sub: user.id, email: user.email, role: user.role });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await resetDatabase(prisma);
  });

  it('redacts requirement text before sending a vector search query to the embedding provider', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Query Redaction Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);
    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: `https://github.com/mock/embedding-query-redaction-${randomUUID()}` })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-query-redaction-e2e',
        coverageStatus: 'READY',
        indexStatus: 'VECTOR_READY',
      },
    });

    const secret = 'sk-proj-retrieval-boundary-secret-0123456789abcdef';
    const changeRequest = `Allow paid booking cancellation. OPENAI_API_KEY=${secret}`;
    const provider = api.get(EmbeddingProviderPort, { strict: false });
    const embed = jest.spyOn(provider, 'embed');
    const retrieval = api.get(HybridRetrievalService, { strict: false });

    await retrieval.retrieve({
      projectId: project.projectId,
      repositoryId: repository.repositoryId,
      snapshotId: snapshot.id,
      changeRequest,
      expandGraph: false,
      maxResults: 10,
    });

    expect(embed).toHaveBeenCalledTimes(1);
    const providerText = embed.mock.calls[0][0].texts[0];
    expect(providerText).not.toContain(secret);
    expect(providerText).toContain('[REDACTED]');
  }, 30_000);
});
