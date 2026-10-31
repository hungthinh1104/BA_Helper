import type { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { createHash, randomUUID } from 'node:crypto';
import {
  projectCreateResponseSchema,
  repositoryCreateResponseSchema,
} from '@ba-helper/contracts';
import { EmbeddingProviderPort } from '@ba-helper/application';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { QueueService } from '@ba-helper/backend-runtime/queue';
import { EmbeddingChunkRepository } from '@ba-helper/backend-runtime/embedding';
import { HybridRetrievalService } from '@ba-helper/backend-runtime';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Embedding model identity (API + PostgreSQL + Redis E2E)', () => {
  let api: INestApplication;
  let worker: INestApplicationContext;
  let prisma: PrismaService;
  let jwt: JwtService;
  let queueService: QueueService;
  let embeddingQueue: Queue;
  let adminToken: string;
  const jobIds: string[] = [];

  beforeAll(async () => {
    api = await createTestApp();
    expect(usesConfiguredTestRedis()).toBe(true);
    prisma = api.get(PrismaService);
    jwt = api.get(JwtService);
    queueService = api.get(QueueService);
    embeddingQueue = api.get<Queue>('BullQueue_embedding');
    await resetDatabase(prisma);
    const { AppModule: WorkerAppModule } = await import('../../../worker/src/app.module');
    worker = await NestFactory.createApplicationContext(WorkerAppModule, { logger: false });
  }, 120_000);

  afterAll(async () => {
    await worker?.close();
    await api?.close();
  });

  beforeEach(async () => {
    if (!prisma) return;
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: {
        email: `embedding-${randomUUID()}@ba-helper.local`,
        name: 'Embedding Integrity Admin',
        role: 'ADMIN',
      },
    });
    adminToken = jwt.sign({ sub: user.id, email: user.email, role: user.role });
  });

  afterEach(async () => {
    if (!prisma) return;
    for (const jobId of jobIds.splice(0)) {
      const job = await embeddingQueue.getJob(jobId);
      if (job && await job.getState() !== 'active') await job.remove();
    }
    jest.restoreAllMocks();
    await resetDatabase(prisma);
  });

  it('does not regenerate chunks when the same snapshot is indexed again', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Identity Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);

    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/embedding-identity' })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);

    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-identity-e2e',
        coverageStatus: 'READY',
        indexStatus: 'LEXICAL_READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'src/booking.service.ts:BookingService',
        name: 'BookingService',
        artifactType: 'SERVICE',
        filePath: 'src/booking.service.ts',
        startLine: 1,
        endLine: 8,
        contentHash: 'booking-service-content-hash',
      },
    });

    const provider = worker.get(EmbeddingProviderPort);
    const embed = jest.spyOn(provider, 'embed');
    const firstJobId = `embed-${snapshot.id}`;
    jobIds.push(firstJobId);
    await queueService.enqueueSnapshotEmbedding(snapshot.id);
    await waitForEmbeddingJob(firstJobId, 'completed');

    const storedChunk = await prisma.embeddingChunk.findFirst({
      where: { snapshotId: snapshot.id },
      select: { embeddingModel: true },
    });
    expect(storedChunk?.embeddingModel).toBe('fake-embedding');

    const duplicateJobId = `duplicate-embed-${snapshot.id}`;
    jobIds.push(duplicateJobId);
    await embeddingQueue.add(
      'embed_snapshot',
      { snapshotId: snapshot.id },
      { jobId: duplicateJobId, attempts: 1, removeOnComplete: false, removeOnFail: false },
    );
    await waitForEmbeddingJob(duplicateJobId, 'completed');

    expect(embed).toHaveBeenCalledTimes(1);
    expect(await prisma.embeddingChunk.count({ where: { snapshotId: snapshot.id } })).toBe(1);
  }, 30_000);

  it('rebuilds same-snapshot chunks created by an older chunker version', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Chunker Refresh Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);

    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: `https://github.com/mock/embedding-chunker-refresh-${randomUUID()}` })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-chunker-refresh-e2e',
        coverageStatus: 'READY',
        indexStatus: 'LEXICAL_READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'src/booking.service.ts:BookingService',
        name: 'BookingService',
        artifactType: 'SERVICE',
        filePath: 'src/booking.service.ts',
        startLine: 1,
        endLine: 8,
        contentHash: 'booking-service-content-hash',
      },
    });

    const embed = jest.spyOn(worker.get(EmbeddingProviderPort), 'embed');
    const firstJobId = `embed-${snapshot.id}`;
    jobIds.push(firstJobId);
    await queueService.enqueueSnapshotEmbedding(snapshot.id);
    await waitForEmbeddingJob(firstJobId, 'completed');

    await prisma.embeddingChunk.updateMany({
      where: { snapshotId: snapshot.id },
      data: { chunkerVersion: 'artifact-chunker@0.1.0' },
    });
    const refreshJobId = `chunker-refresh-${snapshot.id}`;
    jobIds.push(refreshJobId);
    await embeddingQueue.add(
      'embed_snapshot',
      { snapshotId: snapshot.id },
      { jobId: refreshJobId, attempts: 1, removeOnComplete: false, removeOnFail: false },
    );
    await waitForEmbeddingJob(refreshJobId, 'completed');

    const refreshedChunk = await prisma.embeddingChunk.findFirstOrThrow({
      where: { snapshotId: snapshot.id },
      select: { chunkerVersion: true },
    });
    expect(refreshedChunk.chunkerVersion).toBe('artifact-chunker@0.2.0');
    expect(embed).toHaveBeenCalledTimes(2);
  }, 30_000);

  it('does not persist vectors when the provider returns a different model identity', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Model Mismatch Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);
    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: `https://github.com/mock/embedding-model-mismatch-${randomUUID()}` })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-model-mismatch-e2e',
        coverageStatus: 'READY',
        indexStatus: 'LEXICAL_READY',
      },
    });
    await prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'src/booking.service.ts:BookingService',
        name: 'BookingService',
        artifactType: 'SERVICE',
        filePath: 'src/booking.service.ts',
        startLine: 1,
        endLine: 8,
      },
    });

    jest.spyOn(worker.get(EmbeddingProviderPort), 'embed').mockResolvedValue({
      embeddings: [new Array(1536).fill(0.25)],
      model: 'fake-embedding-v2',
      dimensions: 1536,
    });
    const jobId = `embed-${snapshot.id}`;
    jobIds.push(jobId);
    await queueService.enqueueSnapshotEmbedding(snapshot.id);
    await waitForEmbeddingJob(jobId, 'failed');

    expect(await prisma.embeddingChunk.count({ where: { snapshotId: snapshot.id } })).toBe(0);
    const failedSnapshot = await prisma.repositorySnapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
      select: { indexStatus: true },
    });
    expect(failedSnapshot.indexStatus).toBe('VECTOR_FAILED');
  }, 30_000);

  it('redacts embedding input and hashes the persisted redacted content', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Redaction Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);
    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: `https://github.com/mock/embedding-redaction-${randomUUID()}` })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-redaction-e2e',
        coverageStatus: 'READY',
        indexStatus: 'LEXICAL_READY',
      },
    });
    const artifact = await prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'src/config.ts:loadConfig',
        name: 'loadConfig',
        artifactType: 'SERVICE_METHOD',
        filePath: 'src/config.ts',
        startLine: 1,
        endLine: 2,
      },
    });
    const secret = 'sk-proj-test-redaction-secret-0123456789abcdef';
    await prisma.evidence.create({
      data: {
        provenanceKey: `embedding-redaction-${randomUUID()}`,
        sourceType: 'CODE',
        snapshotId: snapshot.id,
        artifactId: artifact.id,
        excerpt: `apiKey = "${secret}"`,
        contentHash: createHash('sha256').update(secret).digest('hex'),
        isRedacted: false,
      },
    });

    const provider = worker.get(EmbeddingProviderPort);
    const embed = jest.spyOn(provider, 'embed');
    const jobId = `embed-${snapshot.id}`;
    jobIds.push(jobId);
    await queueService.enqueueSnapshotEmbedding(snapshot.id);
    await waitForEmbeddingJob(jobId, 'completed');

    expect(embed).toHaveBeenCalledTimes(1);
    const providerText = embed.mock.calls[0][0].texts[0];
    expect(providerText).not.toContain(secret);
    expect(providerText).toContain('[REDACTED]');
    const persistedChunk = await prisma.embeddingChunk.findFirstOrThrow({
      where: { snapshotId: snapshot.id },
      select: { content: true, contentHash: true },
    });
    expect(persistedChunk.content).not.toContain(secret);
    expect(persistedChunk.content).toContain('[REDACTED]');
    expect(persistedChunk.contentHash)
      .toBe(createHash('sha256').update(persistedChunk.content).digest('hex'));
  }, 30_000);

  it('does not return a candidate embedded by a different model', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Retrieval Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);
    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/embedding-retrieval-model' })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-model-retrieval-e2e',
        coverageStatus: 'READY',
        indexStatus: 'VECTOR_READY',
      },
    });
    const distractor = await prisma.codeArtifact.create({
      data: {
        snapshotId: snapshot.id,
        artifactKey: 'src/unrelated/SettlementBoundary.ts:Boundary',
        name: 'SettlementBoundary',
        artifactType: 'CLASS',
        filePath: 'src/unrelated/SettlementBoundary.ts',
        startLine: 1,
        endLine: 8,
      },
    });

    const queryText = 'qzxv unusual retrieval words';
    const provider = api.get(EmbeddingProviderPort, { strict: false });
    const query = await provider.embed({ texts: [queryText] });
    const chunkRepo = new EmbeddingChunkRepository(prisma);
    await chunkRepo.insertMany([{
      tenantId: project.projectId,
      projectId: project.projectId,
      repositoryId: repository.repositoryId,
      snapshotId: snapshot.id,
      artifactId: distractor.id,
      stableChunkId: `${snapshot.id}:foreign-model-chunk`,
      commitSha: snapshot.commitSha,
      filePath: distractor.filePath,
      symbolName: distractor.name,
      artifactType: 'CLASS_CONTEXT',
      content: 'This vector belongs to a different embedding model.',
      contentHash: 'foreign-model-content-hash',
      tokenCount: 12,
      chunkerVersion: 'artifact-chunker@0.2.0',
      embeddingModel: 'different-model-with-same-dimensions',
      embedding: query.embeddings[0],
    }]);

    const retrieval = api.get(HybridRetrievalService, { strict: false });
    const retrievalResult = await retrieval.retrieve({
      projectId: project.projectId,
      repositoryId: repository.repositoryId,
      snapshotId: snapshot.id,
      changeRequest: queryText,
      expandGraph: false,
      maxResults: 10,
    });

    expect(retrievalResult.diagnostics).toEqual({
      strategy: 'lexical_fallback',
      vectorStatus: 'NO_COMPATIBLE_CHUNKS',
    });
    expect(retrievalResult.artifacts.map((item) => item.artifactId)).not.toContain(distractor.id);
  }, 30_000);

  it('updates chunkerVersion when an upsert replaces chunk content from a newer chunker', async () => {
    const project = await prisma.project.create({
      data: { id: randomUUID(), name: 'Chunker Version Project' },
    });
    const repository = await prisma.repository.create({
      data: {
        id: randomUUID(),
        projectId: project.id,
        canonicalUrl: `https://github.com/mock/chunker-${randomUUID()}`,
      },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: {
        id: randomUUID(),
        repositoryId: repository.id,
        commitSha: randomUUID(),
        analyzerVersion: 'chunker-version-e2e',
        coverageStatus: 'READY',
      },
    });
    const chunkRepo = new EmbeddingChunkRepository(prisma);
    const originalChunk = {
      tenantId: project.id,
      projectId: project.id,
      repositoryId: repository.id,
      snapshotId: snapshot.id,
      artifactId: null,
      stableChunkId: 'artifact:booking-service:chunk:0',
      commitSha: snapshot.commitSha,
      filePath: 'src/booking.service.ts',
      symbolName: 'BookingService',
      artifactType: 'SERVICE_CONTEXT',
      content: 'BookingService cancellation flow v1',
      contentHash: 'chunk-content-v1',
      tokenCount: 7,
      chunkerVersion: 'artifact-chunker@0.2.0',
      embeddingModel: 'fake-embedding',
      embedding: new Array(1536).fill(0.1),
    };

    await chunkRepo.insertMany([originalChunk]);
    await chunkRepo.insertMany([{
      ...originalChunk,
      content: 'BookingService cancellation flow v2',
      contentHash: 'chunk-content-v2',
      tokenCount: 8,
      chunkerVersion: 'artifact-chunker@0.3.0',
      embedding: new Array(1536).fill(0.2),
    }]);

    const persisted = await prisma.embeddingChunk.findFirstOrThrow({
      where: { snapshotId: snapshot.id, stableChunkId: originalChunk.stableChunkId },
      select: { content: true, contentHash: true, chunkerVersion: true },
    });
    expect(persisted).toEqual({
      content: 'BookingService cancellation flow v2',
      contentHash: 'chunk-content-v2',
      chunkerVersion: 'artifact-chunker@0.3.0',
    });
    expect(await prisma.embeddingChunk.count({ where: { snapshotId: snapshot.id } })).toBe(1);

    const legacyArtifact = await prisma.codeArtifact.create({
      data: {
        id: randomUUID(),
        snapshotId: snapshot.id,
        artifactKey: 'src/legacy.service.ts:LegacyService',
        name: 'LegacyService',
        artifactType: 'SERVICE',
        filePath: 'src/legacy.service.ts',
      },
    });
    await chunkRepo.insertMany([{
      ...originalChunk,
      artifactId: legacyArtifact.id,
      stableChunkId: 'legacy:unknown-chunker',
      chunkerVersion: null,
    }]);
    const legacyChunks = await chunkRepo.listBySnapshot(snapshot.id, 'fake-embedding');
    expect(legacyChunks.find((chunk) => chunk.stableChunkId === 'legacy:unknown-chunker')?.chunkerVersion)
      .toBeNull();
    await expect(chunkRepo.listForReuseByArtifacts({
      snapshotId: snapshot.id,
      artifactIds: [legacyArtifact.id],
      embeddingModel: 'fake-embedding',
      chunkerVersion: 'artifact-chunker@0.3.0',
    })).resolves.toEqual([]);
  }, 30_000);

  it('ranks only same-dimension vectors from the requested project, snapshot, and model', async () => {
    const projectA = await prisma.project.create({
      data: { id: randomUUID(), name: 'Vector Scope Project A' },
    });
    const projectB = await prisma.project.create({
      data: { id: randomUUID(), name: 'Vector Scope Project B' },
    });
    const repositoryA = await prisma.repository.create({
      data: {
        id: randomUUID(),
        projectId: projectA.id,
        canonicalUrl: `https://github.com/mock/vector-a-${randomUUID()}`,
      },
    });
    const repositoryB = await prisma.repository.create({
      data: {
        id: randomUUID(),
        projectId: projectB.id,
        canonicalUrl: `https://github.com/mock/vector-b-${randomUUID()}`,
      },
    });
    const [snapshotA, snapshotA2, snapshotB] = await Promise.all([
      createSnapshot(repositoryA.id, 'vector-scope-a'),
      createSnapshot(repositoryA.id, 'vector-scope-a2'),
      createSnapshot(repositoryB.id, 'vector-scope-b'),
    ]);
    const chunkRepo = new EmbeddingChunkRepository(prisma);
    const sameModel = 'text-embedding-3-small';
    const otherModelSameProviderAndDimensions = 'text-embedding-3-large';
    const unitVector = (dimension: number) => {
      const vector = new Array(1536).fill(0);
      vector[dimension] = 1;
      return vector;
    };
    const toChunk = (params: {
      projectId: string;
      repositoryId: string;
      snapshotId: string;
      commitSha: string;
      stableChunkId: string;
      filePath: string;
      embeddingModel: string;
      embedding: number[];
    }) => ({
      tenantId: params.projectId,
      projectId: params.projectId,
      repositoryId: params.repositoryId,
      snapshotId: params.snapshotId,
      artifactId: null,
      stableChunkId: params.stableChunkId,
      commitSha: params.commitSha,
      filePath: params.filePath,
      symbolName: null,
      artifactType: 'SERVICE_CONTEXT',
      content: params.filePath,
      contentHash: params.stableChunkId,
      tokenCount: 1,
      chunkerVersion: 'artifact-chunker@0.3.0',
      embeddingModel: params.embeddingModel,
      embedding: params.embedding,
    });

    await chunkRepo.insertMany([
      toChunk({
        projectId: projectA.id,
        repositoryId: repositoryA.id,
        snapshotId: snapshotA.id,
        commitSha: snapshotA.commitSha,
        stableChunkId: `${snapshotA.id}:expected`,
        filePath: 'src/current/expected.ts',
        embeddingModel: sameModel,
        embedding: unitVector(0),
      }),
      toChunk({
        projectId: projectA.id,
        repositoryId: repositoryA.id,
        snapshotId: snapshotA.id,
        commitSha: snapshotA.commitSha,
        stableChunkId: `${snapshotA.id}:distractor`,
        filePath: 'src/current/distractor.ts',
        embeddingModel: sameModel,
        embedding: unitVector(1),
      }),
      toChunk({
        projectId: projectA.id,
        repositoryId: repositoryA.id,
        snapshotId: snapshotA.id,
        commitSha: snapshotA.commitSha,
        stableChunkId: `${snapshotA.id}:other-model`,
        filePath: 'src/current/other-model.ts',
        embeddingModel: otherModelSameProviderAndDimensions,
        embedding: unitVector(0),
      }),
      toChunk({
        projectId: projectA.id,
        repositoryId: repositoryA.id,
        snapshotId: snapshotA2.id,
        commitSha: snapshotA2.commitSha,
        stableChunkId: `${snapshotA2.id}:other-snapshot`,
        filePath: 'src/other-snapshot/private.ts',
        embeddingModel: sameModel,
        embedding: unitVector(0),
      }),
      toChunk({
        projectId: projectB.id,
        repositoryId: repositoryB.id,
        snapshotId: snapshotB.id,
        commitSha: snapshotB.commitSha,
        stableChunkId: `${snapshotB.id}:other-project`,
        filePath: 'src/other-project/private.ts',
        embeddingModel: sameModel,
        embedding: unitVector(0),
      }),
    ]);

    const results = await chunkRepo.searchSimilar({
      tenantId: projectA.id,
      projectId: projectA.id,
      repositoryId: repositoryA.id,
      snapshotId: snapshotA.id,
      embeddingModel: sameModel,
      queryEmbedding: unitVector(0),
      limit: 10,
    });

    expect(results.map((result) => result.filePath)).toEqual([
      'src/current/expected.ts',
      'src/current/distractor.ts',
    ]);
    expect(results[0].similarity).toBeCloseTo(1);
    expect(results[1].similarity).toBeCloseTo(0);
  }, 30_000);

  it('copies an unchanged prior-snapshot vector for the same model', async () => {
    const projectResponse = await request(api.getHttpServer())
      .post('/api/v1/projects')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Embedding Reuse Project' })
      .expect(201);
    const project = projectCreateResponseSchema.parse(projectResponse.body);
    const repositoryResponse = await request(api.getHttpServer())
      .post(`/api/v1/projects/${project.projectId}/repositories`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ url: 'https://github.com/mock/embedding-reuse' })
      .expect(201);
    const repository = repositoryCreateResponseSchema.parse(repositoryResponse.body);
    const baseSnapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-reuse-e2e',
        coverageStatus: 'READY',
        indexStatus: 'LEXICAL_READY',
      },
    });
    const baseArtifact = await prisma.codeArtifact.create({
      data: {
        snapshotId: baseSnapshot.id,
        artifactKey: 'src/booking.service.ts:BookingService',
        name: 'BookingService',
        artifactType: 'SERVICE',
        filePath: 'src/booking.service.ts',
        startLine: 1,
        endLine: 8,
        contentHash: 'same-booking-service-content',
      },
    });

    const provider = worker.get(EmbeddingProviderPort);
    const embed = jest.spyOn(provider, 'embed');
    const baseJobId = `embed-${baseSnapshot.id}`;
    jobIds.push(baseJobId);
    await queueService.enqueueSnapshotEmbedding(baseSnapshot.id);
    await waitForEmbeddingJob(baseJobId, 'completed');

    const targetSnapshotId = randomUUID();
    const targetSnapshot = await prisma.repositorySnapshot.create({
      data: {
        id: targetSnapshotId,
        repositoryId: repository.repositoryId,
        commitSha: randomUUID(),
        analyzerVersion: 'embedding-reuse-e2e',
        coverageStatus: 'READY',
        indexStatus: 'LEXICAL_READY',
        diagnostics: [{
          code: 'EMBEDDING_REUSE_PLAN',
          severity: 'INFO',
          message: 'Unchanged artifact is eligible for vector reuse.',
          category: 'SCANNER',
          payload: {
            baseSnapshotId: baseSnapshot.id,
            targetSnapshotId,
            reuseMode: 'PLAN_ONLY',
            reuseSafety: 'SAFE_FOR_FUTURE_REUSE',
            eligibleArtifactCount: 1,
            ineligibleArtifactCount: 0,
            eligibleRatio: 1,
            ineligibleReasons: {
              addedArtifactCount: 0,
              changedArtifactCount: 0,
              removedArtifactCount: 0,
              hashUnavailableArtifactCount: 0,
              versionChangedBlockedCount: 0,
            },
            sampleLimit: 20,
            samples: { eligible: [], ineligible: [] },
          },
        }],
      },
    });
    await prisma.codeArtifact.create({
      data: {
        snapshotId: targetSnapshot.id,
        artifactKey: baseArtifact.artifactKey,
        name: baseArtifact.name,
        artifactType: baseArtifact.artifactType,
        filePath: baseArtifact.filePath,
        startLine: baseArtifact.startLine,
        endLine: baseArtifact.endLine,
        contentHash: baseArtifact.contentHash,
      },
    });

    const targetJobId = `embed-${targetSnapshot.id}`;
    jobIds.push(targetJobId);
    await queueService.enqueueSnapshotEmbedding(targetSnapshot.id);
    await waitForEmbeddingJob(targetJobId, 'completed');

    const copiedChunk = await prisma.embeddingChunk.findFirst({
      where: { snapshotId: targetSnapshot.id },
      select: { embeddingModel: true, chunkerVersion: true },
    });
    expect(copiedChunk).toMatchObject({
      embeddingModel: 'fake-embedding',
      chunkerVersion: 'artifact-chunker@0.2.0',
    });
    const completedSnapshot = await prisma.repositorySnapshot.findUniqueOrThrow({
      where: { id: targetSnapshot.id },
      select: { diagnostics: true },
    });
    const summary = (completedSnapshot.diagnostics as Array<{ code: string; payload?: Record<string, unknown> }>)
      .find((item) => item.code === 'EMBEDDING_REUSE_EXECUTION_SUMMARY');
    expect(summary?.payload).toMatchObject({ copiedChunkCount: 1, generatedChunkCount: 0 });
    expect(embed).toHaveBeenCalledTimes(1);
  }, 30_000);

  async function waitForEmbeddingJob(jobId: string, expectedState: string): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const job = await embeddingQueue.getJob(jobId);
      const state = job ? await job.getState() : 'missing';
      if (state === expectedState) return;
      if (job && state === 'failed') {
        throw new Error(
          `Embedding job ${jobId} failed after ${job.attemptsMade} attempt(s): ${job.failedReason}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    const job = await embeddingQueue.getJob(jobId);
    throw new Error(`Embedding job ${jobId} did not reach ${expectedState}; state=${job ? await job.getState() : 'missing'}.`);
  }

  function usesConfiguredTestRedis(): boolean {
    const runtimeValue = process.env.REDIS_URL;
    const testValue = process.env.REDIS_URL_TEST;
    if (!runtimeValue || !testValue) return false;
    const identity = (value: string) => {
      const url = new URL(value);
      return [url.protocol, url.hostname.toLowerCase(), url.port || (url.protocol === 'rediss:' ? '6380' : '6379'), url.pathname || '/0'].join('|');
    };
    return identity(runtimeValue) === identity(testValue);
  }

  async function createSnapshot(repositoryId: string, analyzerVersion: string) {
    return prisma.repositorySnapshot.create({
      data: {
        id: randomUUID(),
        repositoryId,
        commitSha: randomUUID(),
        analyzerVersion,
        coverageStatus: 'READY',
      },
    });
  }
});
