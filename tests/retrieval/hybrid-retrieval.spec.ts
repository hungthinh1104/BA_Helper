import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { FakeEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/fake-embedding.provider';

describe('HybridRetrievalService', () => {
  let service: HybridRetrievalService;
  let chunkRepoMock: any;
  let provider: FakeEmbeddingProvider;
  let artifactRepoMock: any;
  let graphRepoMock: any;
  let prismaMock: any;

  const BASE_REQUEST = {
    projectId: 'proj-1',
    repositoryId: 'repo-1',
    snapshotId: 'snap-1',
    changeRequest: 'cancel booking and issue refund',
    domain: 'BOOKING',
  };

  beforeEach(() => {
    chunkRepoMock = { searchSimilar: jest.fn() };
    provider = new FakeEmbeddingProvider();
    artifactRepoMock = { findById: jest.fn() };
    graphRepoMock = { expandFromSeeds: jest.fn() };
    prismaMock = {
      $queryRawUnsafe: jest.fn(),
      codeArtifact: { findMany: jest.fn() },
      repositorySnapshot: { findUnique: jest.fn() },
    };

    // Default to VECTOR_READY to enable full testing
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue({ indexStatus: 'VECTOR_READY' });

    service = new HybridRetrievalService(
      chunkRepoMock,
      provider,
      artifactRepoMock,
      graphRepoMock,
      prismaMock,
    );
  });

  describe('tenant isolation', () => {
    it('should pass tenantId=projectId to searchSimilar when tenantId not specified', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      await service.retrieve(BASE_REQUEST);

      expect(chunkRepoMock.searchSimilar as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'proj-1',
          projectId: 'proj-1',
          repositoryId: 'repo-1',
          snapshotId: 'snap-1',
        }),
      );
    });
  });

  describe('hybrid merging and score fusion', () => {
    it('should merge lexical and vector hits and calculate hybrid score', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', symbolName: 'func1', artifactType: 'FILE' },
      ]);
      chunkRepoMock.searchSimilar.mockResolvedValue([
        { artifactId: 'art-1', similarity: 0.95 },
        { artifactId: 'art-2', similarity: 0.85 }, // will be pure vector
      ]);
      artifactRepoMock.findById.mockResolvedValue({
        id: 'art-2', artifactKey: 'file2.ts', filePath: 'src/file2.ts', name: 'func2', artifactType: 'FILE',
      });
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve({ ...BASE_REQUEST, expandGraph: false });

      // art-1: lexical (0.4) + vector (0.95 * 0.2) = 0.4 + 0.19 = 0.59
      // it might also have domain boost if it matched domain rules, but 'cancel booking' should match domain
      const art1 = results.find(r => r.artifactId === 'art-1');
      expect(art1?.retrievalMethod).toBe('HYBRID');
      expect(art1?.retrievalSignals).toContain('LEXICAL');
      expect(art1?.retrievalSignals).toContain('VECTOR');
      expect(art1?.retrievalReason).toContain('lexical match');
      expect(art1?.retrievalReason).toContain('semantic match');

      const art2 = results.find(r => r.artifactId === 'art-2');
      expect(art2?.retrievalMethod).toBe('VECTOR');
      expect(art2?.retrievalSignals).toContain('VECTOR');
      expect(art2?.retrievalSignals).not.toContain('LEXICAL');
      // art-2 vector score = 0.85 * 0.20 = 0.17
      expect(art2?.score).toBeCloseTo(0.17, 2);
    });

    it('should assign GRAPH_EXPANSION method and correct depth score', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([
        { artifactId: 'art-1', similarity: 0.9 },
      ]);
      artifactRepoMock.findById.mockResolvedValue({
        id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', name: 'func1', artifactType: 'FILE',
      });
      graphRepoMock.expandFromSeeds.mockResolvedValue(['art-1', 'art-3']);
      prismaMock.codeArtifact.findMany.mockResolvedValue([
        { id: 'art-3', artifactKey: 'file3.ts', filePath: 'src/file3.ts', name: 'func3', artifactType: 'FILE' },
      ]);

      const results = await service.retrieve({ ...BASE_REQUEST, expandGraph: true });

      const art3 = results.find(r => r.artifactId === 'art-3');
      expect(art3?.retrievalMethod).toBe('GRAPH_EXPANSION');
      // graph depth 1 = 0.7 * 0.35 = 0.245
      expect(art3?.score).toBeCloseTo(0.245, 2);
    });

    it('should drop vector-only low similarity candidates', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([
        { artifactId: 'art-low', similarity: 0.60 }, // < 0.72 MIN_VECTOR_SIMILARITY
      ]);
      artifactRepoMock.findById.mockResolvedValue({
        id: 'art-low', artifactKey: 'low.ts', filePath: 'src/low.ts', name: 'low', artifactType: 'FILE',
      });
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve(BASE_REQUEST);
      expect(results.find(r => r.artifactId === 'art-low')).toBeUndefined();
    });

    it('should apply noise penalty for weak vector only test candidates', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([
        { artifactId: 'art-test', similarity: 0.73 }, // > 0.72 but < 0.75 (weak)
      ]);
      artifactRepoMock.findById.mockResolvedValue({
        id: 'art-test', artifactKey: 'test.ts', filePath: 'src/file.spec.ts', name: 'test', artifactType: 'TEST',
      });
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve({ ...BASE_REQUEST, changeRequest: 'normal change' });
      const artTest = results.find(r => r.artifactId === 'art-test');
      
      // score = vector(0.73 * 0.20 = 0.146) - penalty(0.05) = 0.096
      expect(artTest?.score).toBeCloseTo(0.096, 3);
    });

    it('should not penalize test artifact if reached via graph edge', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([
        { artifactId: 'art-1', similarity: 0.9 }, // seed
      ]);
      artifactRepoMock.findById.mockResolvedValue({
        id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', name: 'func1', artifactType: 'FILE',
      });
      graphRepoMock.expandFromSeeds.mockResolvedValue(['art-1', 'art-test']);
      prismaMock.codeArtifact.findMany.mockResolvedValue([
        { id: 'art-test', artifactKey: 'test.ts', filePath: 'src/file.spec.ts', name: 'test', artifactType: 'TEST' },
      ]);

      const results = await service.retrieve({ ...BASE_REQUEST, expandGraph: true });
      const artTest = results.find(r => r.artifactId === 'art-test');
      
      // score = graph(0.7 * 0.35 = 0.245) - 0 penalty = 0.245
      expect(artTest?.score).toBeCloseTo(0.245, 3);
    });
  });

  describe('snapshot status fallback', () => {
    it('should skip vector if VECTOR_INDEXING', async () => {
      prismaMock.repositorySnapshot.findUnique.mockResolvedValue({ indexStatus: 'VECTOR_INDEXING' });
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', symbolName: 'func1', artifactType: 'FILE' },
      ]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve(BASE_REQUEST);

      expect(chunkRepoMock.searchSimilar).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].retrievalMethod).toBe('LEXICAL');
    });

    it('should skip vector if LEXICAL_READY', async () => {
      prismaMock.repositorySnapshot.findUnique.mockResolvedValue({ indexStatus: 'LEXICAL_READY' });
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', symbolName: 'func1', artifactType: 'FILE' },
      ]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve(BASE_REQUEST);

      expect(chunkRepoMock.searchSimilar).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should fall back gracefully to lexical when vector search throws', async () => {
      prismaMock.repositorySnapshot.findUnique.mockResolvedValue({ indexStatus: 'VECTOR_READY' });
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', symbolName: 'func1', artifactType: 'FILE' },
      ]);
      chunkRepoMock.searchSimilar.mockRejectedValue(new Error('DB connection lost'));
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve({ ...BASE_REQUEST, expandGraph: false });

      expect(results).toHaveLength(1);
      expect(results[0].artifactId).toBe('art-1');
      expect(results[0].retrievalMethod).toBe('LEXICAL');
    });
  });
});
