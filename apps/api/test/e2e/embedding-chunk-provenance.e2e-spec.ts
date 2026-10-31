import type { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@ba-helper/backend-runtime/prisma';
import { EmbeddingChunkRepository } from '@ba-helper/backend-runtime/embedding';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

describe('Embedding chunk persisted provenance (PostgreSQL integration)', () => {
  let api: INestApplication;
  let prisma: PrismaService;
  let chunkRepository: EmbeddingChunkRepository;
  let projectAId: string;
  let projectBId: string;
  let repositoryAId: string;
  let repositoryBId: string;
  let snapshotA: { id: string; commitSha: string };
  let artifactAId: string;
  let artifactBId: string;

  beforeAll(async () => {
    api = await createTestApp();
    prisma = api.get(PrismaService);
    chunkRepository = new EmbeddingChunkRepository(prisma);
  }, 120_000);

  afterAll(async () => {
    await api?.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const [projectA, projectB] = await Promise.all([
      prisma.project.create({ data: { id: randomUUID(), name: 'Embedding Scope A' } }),
      prisma.project.create({ data: { id: randomUUID(), name: 'Embedding Scope B' } }),
    ]);
    projectAId = projectA.id;
    projectBId = projectB.id;

    const [repositoryA, repositoryB] = await Promise.all([
      prisma.repository.create({
        data: { id: randomUUID(), projectId: projectAId, canonicalUrl: `https://github.com/mock/chunk-a-${randomUUID()}` },
      }),
      prisma.repository.create({
        data: { id: randomUUID(), projectId: projectBId, canonicalUrl: `https://github.com/mock/chunk-b-${randomUUID()}` },
      }),
    ]);
    repositoryAId = repositoryA.id;
    repositoryBId = repositoryB.id;

    const [createdSnapshotA, snapshotB] = await Promise.all([
      prisma.repositorySnapshot.create({
        data: {
          id: randomUUID(),
          repositoryId: repositoryAId,
          commitSha: randomUUID(),
          analyzerVersion: 'embedding-provenance-e2e',
          coverageStatus: 'READY',
        },
      }),
      prisma.repositorySnapshot.create({
        data: {
          id: randomUUID(),
          repositoryId: repositoryBId,
          commitSha: randomUUID(),
          analyzerVersion: 'embedding-provenance-e2e',
          coverageStatus: 'READY',
        },
      }),
    ]);
    snapshotA = { id: createdSnapshotA.id, commitSha: createdSnapshotA.commitSha };

    const [artifactA, artifactB] = await Promise.all([
      prisma.codeArtifact.create({
        data: {
          id: randomUUID(),
          snapshotId: createdSnapshotA.id,
          artifactKey: 'src/booking-a.ts:BookingA',
          name: 'BookingA',
          artifactType: 'CLASS',
          filePath: 'src/booking-a.ts',
        },
      }),
      prisma.codeArtifact.create({
        data: {
          id: randomUUID(),
          snapshotId: snapshotB.id,
          artifactKey: 'src/booking-b.ts:BookingB',
          name: 'BookingB',
          artifactType: 'CLASS',
          filePath: 'src/booking-b.ts',
        },
      }),
    ]);
    artifactAId = artifactA.id;
    artifactBId = artifactB.id;
  });

  afterEach(async () => {
    await resetDatabase(prisma);
  });

  it('accepts a chunk whose project, repository, snapshot, artifact, and commit agree', async () => {
    await chunkRepository.insertMany([createChunk()]);
    await expect(prisma.embeddingChunk.count()).resolves.toBe(1);
  });

  it('rejects tenant and project scope that disagree', async () => {
    await expectRejected(createChunk({ tenantId: projectBId }));
  });

  it('rejects a project that does not own the repository', async () => {
    await expectRejected(createChunk({ tenantId: projectBId, projectId: projectBId }));
  });

  it('rejects a repository that does not own the snapshot', async () => {
    await expectRejected(createChunk({
      tenantId: projectBId,
      projectId: projectBId,
      repositoryId: repositoryBId,
      artifactId: null,
    }));
  });

  it('rejects an artifact that belongs to a different snapshot', async () => {
    await expectRejected(createChunk({ artifactId: artifactBId }));
  });

  it('rejects a commit SHA that differs from the selected snapshot', async () => {
    await expectRejected(createChunk({ commitSha: randomUUID() }));
  });

  function createChunk(
    overrides: Partial<Parameters<EmbeddingChunkRepository['insertMany']>[0][number]> = {},
  ) {
    return {
      tenantId: projectAId,
      projectId: projectAId,
      repositoryId: repositoryAId,
      snapshotId: snapshotA.id,
      artifactId: artifactAId,
      stableChunkId: `artifact:${randomUUID()}`,
      commitSha: snapshotA.commitSha,
      filePath: 'src/booking-a.ts',
      symbolName: 'BookingA',
      artifactType: 'CLASS_CONTEXT',
      content: 'synthetic test content',
      contentHash: randomUUID(),
      tokenCount: 4,
      chunkerVersion: 'artifact-chunker@0.2.0',
      embeddingModel: 'fake-embedding',
      embedding: [1, ...new Array(1535).fill(0)],
      ...overrides,
    };
  }

  async function expectRejected(
    chunk: Parameters<EmbeddingChunkRepository['insertMany']>[0][number],
  ) {
    await expect(chunkRepository.insertMany([chunk])).rejects.toBeDefined();
    await expect(prisma.embeddingChunk.count()).resolves.toBe(0);
  }
});
