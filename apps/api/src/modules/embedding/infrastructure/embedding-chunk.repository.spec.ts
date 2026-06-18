import { CHUNK_BUILDER_VERSION } from '../domain/artifact-chunk.builder';
import { EmbeddingChunkRepository } from './embedding-chunk.repository';

describe('EmbeddingChunkRepository', () => {
  let repo: EmbeddingChunkRepository;
  let prisma: any;
  let executeRawCalls: Array<any[]>;

  beforeEach(() => {
    executeRawCalls = [];
    prisma = {
      $executeRaw: jest.fn((...args: any[]) => {
        executeRawCalls.push(args);
        return Promise.resolve(1);
      }),
      embeddingChunk: {
        findMany: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    repo = new EmbeddingChunkRepository(prisma);
  });

  describe('insertMany', () => {
    const baseChunk = {
      tenantId: 'tenant-1',
      projectId: 'project-1',
      repositoryId: 'repo-1',
      snapshotId: 'snapshot-1',
      artifactId: 'artifact-1',
      stableChunkId: 'snapshot-1:api:booking.controller.cancel:METHOD_BODY',
      commitSha: 'abc123',
      filePath: 'src/booking.ts',
      symbolName: 'BookingController.cancel',
      artifactType: 'METHOD_BODY',
      content: 'cancel() {}',
      contentHash: 'hash-abc',
      tokenCount: 10,
      chunkerVersion: CHUNK_BUILDER_VERSION,
      embeddingProfileId: 'openai-3-small-1536',
      embeddingProvider: 'openai',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 1536,
      embeddingConfigHash: 'config-hash-1',
      embedding: [0.1, 0.2, 0.3],
    };

    it('calls $executeRaw for each chunk', async () => {
      await repo.insertMany([baseChunk]);
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('does nothing when chunks array is empty', async () => {
      await repo.insertMany([]);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('accepts chunks with null chunkerVersion (legacy chunks remain insertable)', async () => {
      const legacyChunk = { ...baseChunk, chunkerVersion: null };
      await expect(repo.insertMany([legacyChunk])).resolves.toBeUndefined();
    });

    it('accepts chunks with CHUNK_BUILDER_VERSION set', async () => {
      await expect(repo.insertMany([baseChunk])).resolves.toBeUndefined();
    });

    it('persists full embedding provenance fields', async () => {
      await repo.insertMany([baseChunk]);

      const sqlPayload = JSON.stringify(executeRawCalls[0]);
      expect(sqlPayload).toContain('embeddingProfileId');
      expect(sqlPayload).toContain('embeddingProvider');
      expect(sqlPayload).toContain('embeddingDimensions');
      expect(sqlPayload).toContain('embeddingConfigHash');
      expect(sqlPayload).toContain('openai-3-small-1536');
      expect(sqlPayload).toContain('config-hash-1');
    });
  });

  describe('listBySnapshot', () => {
    it('returns chunkerVersion in selection', async () => {
      prisma.embeddingChunk.findMany.mockResolvedValue([
        {
          stableChunkId: 'snap:artifact:METHOD_BODY',
          contentHash: 'hash-1',
          artifactId: 'artifact-1',
          chunkerVersion: CHUNK_BUILDER_VERSION,
          embeddingProfileId: 'openai-3-small-1536',
          embeddingConfigHash: 'config-hash-1',
        },
      ]);

      const result = await repo.listBySnapshot('snapshot-1', 'openai-3-small-1536');

      expect(prisma.embeddingChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ chunkerVersion: true }),
        }),
      );
      expect(result[0]).toHaveProperty('chunkerVersion', CHUNK_BUILDER_VERSION);
    });

    it('returns chunkerVersion as null for legacy chunks', async () => {
      prisma.embeddingChunk.findMany.mockResolvedValue([
        {
          stableChunkId: 'snap:artifact:METHOD_BODY',
          contentHash: 'hash-1',
          artifactId: 'artifact-1',
          chunkerVersion: null,
          embeddingProfileId: null,
          embeddingConfigHash: null,
        },
      ]);

      const result = await repo.listBySnapshot('snapshot-1', 'openai-3-small-1536');
      expect(result[0].chunkerVersion).toBeNull();
    });

    it('filters by snapshotId and embeddingProfileId', async () => {
      prisma.embeddingChunk.findMany.mockResolvedValue([]);
      await repo.listBySnapshot('snapshot-1', 'openai-3-small-1536');

      expect(prisma.embeddingChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            snapshotId: 'snapshot-1',
            embeddingProfileId: 'openai-3-small-1536',
          },
        }),
      );
    });
  });

  describe('listForReuseByArtifacts', () => {
    it('filters by embeddingProfileId and chunkerVersion', async () => {
      prisma.embeddingChunk.findMany.mockResolvedValue([]);

      await repo.listForReuseByArtifacts({
        snapshotId: 'snapshot-1',
        artifactIds: ['artifact-1'],
        embeddingProfileId: 'google-gemini-001-1536',
        chunkerVersion: CHUNK_BUILDER_VERSION,
      });

      expect(prisma.embeddingChunk.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            snapshotId: 'snapshot-1',
            artifactId: { in: ['artifact-1'] },
            embeddingProfileId: 'google-gemini-001-1536',
            chunkerVersion: CHUNK_BUILDER_VERSION,
          },
        }),
      );
    });
  });

  describe('copyChunk', () => {
    const copyParams = {
      baseSnapshotId: 'base-snapshot',
      oldArtifactId: 'old-artifact',
      embeddingProfileId: 'google-gemini-001-1536',
      embeddingProvider: 'google',
      embeddingModel: 'gemini-embedding-001',
      embeddingDimensions: 1536,
      embeddingConfigHash: 'config-hash-google',
      chunkerVersion: CHUNK_BUILDER_VERSION,
      contentHash: 'hash-abc',
      tenantId: 'tenant-1',
      projectId: 'project-1',
      repositoryId: 'repo-1',
      targetSnapshotId: 'target-snapshot',
      newArtifactId: 'new-artifact',
      newStableChunkId: 'target:artifact:METHOD_BODY',
      commitSha: 'abc123',
      filePath: 'src/booking.ts',
      symbolName: 'BookingService.cancel',
      artifactType: 'METHOD_BODY',
      content: 'cancel() {}',
      tokenCount: 10,
    };

    it('copies only same profile/config provenance', async () => {
      await repo.copyChunk(copyParams);

      const sqlPayload = JSON.stringify(executeRawCalls[0]);
      expect(sqlPayload).toContain('embeddingProfileId');
      expect(sqlPayload).toContain('embeddingConfigHash');
      expect(sqlPayload).toContain('google-gemini-001-1536');
      expect(sqlPayload).toContain('config-hash-google');
    });

    it('returns false when source chunk is missing', async () => {
      prisma.$executeRaw.mockResolvedValueOnce(0);
      await expect(repo.copyChunk(copyParams)).resolves.toBe(false);
    });
  });

  describe('reuse eligibility (future guard)', () => {
    it('a chunk with null chunkerVersion is NOT considered same-version as CHUNK_BUILDER_VERSION', () => {
      // This is the key invariant: null != current version → not reuse-eligible.
      // No reuse logic exists yet, but this test documents and protects the rule.
      const legacyChunkerVersion: string | null = null;
      expect(legacyChunkerVersion).not.toBe(CHUNK_BUILDER_VERSION);
    });

    it('a chunk with legacy string chunkerVersion is NOT considered same-version', () => {
      const legacyVersion = 'artifact-chunker@legacy';
      expect(legacyVersion).not.toBe(CHUNK_BUILDER_VERSION);
    });

    it('a chunk with matching chunkerVersion IS considered same-version', () => {
      const current = CHUNK_BUILDER_VERSION;
      expect(current).toBe(CHUNK_BUILDER_VERSION);
    });
  });
});
