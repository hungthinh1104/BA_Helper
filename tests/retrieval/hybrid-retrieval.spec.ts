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
    };

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

    it('should use explicit tenantId when provided', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      await service.retrieve({ ...BASE_REQUEST, tenantId: 'org-999' });

      expect(chunkRepoMock.searchSimilar as jest.Mock).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'org-999' }),
      );
    });
  });

  describe('domain-aware keyword extraction', () => {
    it('should match glossary terms appearing in change request', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      // "cancellation", "booking", and "refund" are in the BOOKING glossary
      await service.retrieve({ ...BASE_REQUEST, changeRequest: 'cancellation of booking to receive refund' });

      // $queryRawUnsafe called as (sql, snapshotId, keywordsArray)
      expect(prismaMock.$queryRawUnsafe as jest.Mock).toHaveBeenCalledTimes(1);
      const allArgs = (prismaMock.$queryRawUnsafe as jest.Mock).mock.calls[0];
      // Flatten all args to find the keywords wrapped as %...%
      const allStrings = allArgs.flat(Infinity) as string[];
      const keywordBlock = allStrings.filter((s: string) => s.startsWith('%'));
      expect(keywordBlock.some((k: string) => k.includes('cancellation'))).toBe(true);
      expect(keywordBlock.some((k: string) => k.includes('booking'))).toBe(true);
      expect(keywordBlock.some((k: string) => k.includes('refund'))).toBe(true);
    });

    it('should extract camelCase symbol names from change request', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      await service.retrieve({ ...BASE_REQUEST, changeRequest: 'Update cancelBooking to call RefundService' });

      const sqlCall = prismaMock.$queryRawUnsafe.mock.calls[0];
      const keywords = sqlCall[2] as string[];
      expect(keywords.some((k: string) => k.includes('cancelBooking'))).toBe(true);
      expect(keywords.some((k: string) => k.includes('RefundService'))).toBe(true);
    });

    it('should also search filePath and artifactKey, not just name', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([]);
      chunkRepoMock.searchSimilar.mockResolvedValue([]);
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      await service.retrieve(BASE_REQUEST);

      const sqlCall = prismaMock.$queryRawUnsafe.mock.calls[0];
      const sql = sqlCall[0] as string;
      expect(sql).toContain('"filePath"');
      expect(sql).toContain('"artifactKey"');
    });
  });

  describe('hybrid merging', () => {
    it('should merge lexical and vector hits and set HYBRID method', async () => {
      prismaMock.$queryRawUnsafe.mockResolvedValue([
        { id: 'art-1', artifactKey: 'file1.ts', filePath: 'src/file1.ts', symbolName: 'func1', artifactType: 'FILE' },
      ]);
      chunkRepoMock.searchSimilar.mockResolvedValue([
        { artifactId: 'art-1', similarity: 0.95 },
        { artifactId: 'art-2', similarity: 0.85 },
      ]);
      artifactRepoMock.findById.mockResolvedValue({
        id: 'art-2', artifactKey: 'file2.ts', filePath: 'src/file2.ts', name: 'func2', artifactType: 'FILE',
      });
      graphRepoMock.expandFromSeeds.mockResolvedValue([]);

      const results = await service.retrieve({ ...BASE_REQUEST, expandGraph: false });

      const art1 = results.find(r => r.artifactId === 'art-1');
      expect(art1?.retrievalMethod).toBe('HYBRID');
      expect(art1?.score).toBe(1.0);

      const art2 = results.find(r => r.artifactId === 'art-2');
      expect(art2?.retrievalMethod).toBe('VECTOR');
      expect(art2?.score).toBe(0.85);
    });

    it('should mark graph-expanded artifacts as GRAPH with score 0.5', async () => {
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
      expect(art3?.retrievalMethod).toBe('GRAPH');
      expect(art3?.score).toBe(0.5);
    });
  });

  describe('resilience', () => {
    it('should fall back gracefully to lexical when vector search throws', async () => {
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
