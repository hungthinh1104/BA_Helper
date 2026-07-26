import { HybridRetrievalService } from './hybrid-retrieval.service';
import { DomainPackRegistry } from '../../domain-pack/application/domain-pack.registry';

describe('HybridRetrievalService', () => {
  describe('security', () => {
    it('uses parameterized raw SQL for lexical retrieval and ignores injected SQL text', async () => {
      const prisma = {
        repositorySnapshot: {
          findUnique: jest.fn().mockResolvedValue({ indexStatus: 'NOT_INDEXED' }),
        },
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: 'artifact-1',
            artifactKey: 'artifact-key',
            filePath: 'src/booking.service.ts',
            symbolName: 'BookingService',
            artifactType: 'SERVICE',
            universalKind: 'DOMAIN_SERVICE',
            name: 'BookingService',
          },
        ]),
        $queryRawUnsafe: jest.fn(),
        codeArtifact: {
          findMany: jest.fn(),
        },
      } as any;

      const service = new HybridRetrievalService(
        { searchSimilar: jest.fn() } as any,
        { embed: jest.fn() } as any,
	        { findById: jest.fn() } as any,
	        { expandFromSeeds: jest.fn() } as any,
	        prisma,
	        new DomainPackRegistry(),
	      );

      const maliciousInput = `Update booking flow; DROP TABLE "CodeArtifact"; --`;
      const result = await service.retrieve({
        projectId: '11111111-1111-1111-1111-111111111111',
        repositoryId: '22222222-2222-2222-2222-222222222222',
        snapshotId: '33333333-3333-3333-3333-333333333333',
        changeRequest: maliciousInput,
        domain: 'BOOKING',
        maxResults: 5,
      });

      expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);

      const rawQuery = (prisma.$queryRaw as jest.Mock).mock.calls[0][0] as {
        strings?: string[];
        values?: unknown[];
      };

      expect(JSON.stringify(rawQuery.strings ?? [])).not.toContain('DROP TABLE');
      expect(JSON.stringify(rawQuery.strings ?? [])).toContain('ILIKE ANY');
      expect(result).toHaveLength(1);
      expect(result[0].artifactId).toBe('artifact-1');
    });
  });

  describe('configurable tuning', () => {
    // A vector-only paraphrase hit whose real cosine similarity (0.6) falls below
    // the default 0.72 floor — the exact shape of the tracked semantic-recall gap
    // (e.g. `releaseReservation` for "abort a purchase").
    const buildService = () => {
      const prisma = {
        repositorySnapshot: {
          findUnique: jest
            .fn()
            .mockResolvedValue({ indexStatus: 'VECTOR_READY', profile: null }),
        },
        $queryRaw: jest.fn().mockResolvedValue([]), // no lexical hits → vector-only
        $queryRawUnsafe: jest.fn(),
        codeArtifact: { findMany: jest.fn() },
      } as any;
      return new HybridRetrievalService(
        {
          searchSimilar: jest
            .fn()
            .mockResolvedValue([{ artifactId: 'weak-1', similarity: 0.6 }]),
        } as any,
        { embed: jest.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]] }) } as any,
        {
          findById: jest.fn().mockResolvedValue({
            id: 'weak-1',
            artifactKey: 'service-method:inventory.service.releaseReservation',
            filePath: 'src/inventory/inventory.service.ts',
            name: 'releaseReservation',
            artifactType: 'SERVICE_METHOD',
            universalKind: 'DOMAIN_SERVICE',
          }),
        } as any,
        { expandFromSeeds: jest.fn() } as any,
        prisma,
        new DomainPackRegistry(),
      );
    };

    const request = {
      projectId: '11111111-1111-1111-1111-111111111111',
      repositoryId: '22222222-2222-2222-2222-222222222222',
      snapshotId: '33333333-3333-3333-3333-333333333333',
      changeRequest: 'abort a purchase before fulfilment and restore reserved stock',
      maxResults: 10,
    };

    it('drops a weak vector-only hit below the default floor', async () => {
      const result = await buildService().retrieve(request);
      expect(result.find((r) => r.artifactId === 'weak-1')).toBeUndefined();
    });

    it('keeps the weak vector-only hit when keepWeakVectorOnly is enabled', async () => {
      const result = await buildService().retrieve({
        ...request,
        tuning: { keepWeakVectorOnly: true },
      });
      const weak = result.find((r) => r.artifactId === 'weak-1');
      expect(weak).toBeDefined();
      expect(weak?.retrievalSignals).toContain('VECTOR');
    });

    it('keeps the hit when the minVectorSimilarity floor is lowered', async () => {
      const result = await buildService().retrieve({
        ...request,
        tuning: { minVectorSimilarity: 0.5 },
      });
      expect(result.find((r) => r.artifactId === 'weak-1')).toBeDefined();
    });

    it('retains a close-scored tail candidate with a positive adaptiveTailGap', async () => {
      const twoEqualHits = () => {
        const prisma = {
          repositorySnapshot: {
            findUnique: jest
              .fn()
              .mockResolvedValue({ indexStatus: 'NOT_INDEXED', profile: null }),
          },
          $queryRaw: jest.fn().mockResolvedValue([
            { id: 'a', artifactKey: 'k-a', filePath: 'src/a.ts', symbolName: 'BookingService', artifactType: 'SERVICE', universalKind: 'DOMAIN_SERVICE', name: 'BookingService' },
            { id: 'b', artifactKey: 'k-b', filePath: 'src/b.ts', symbolName: 'BookingService', artifactType: 'SERVICE', universalKind: 'DOMAIN_SERVICE', name: 'BookingService' },
          ]),
          $queryRawUnsafe: jest.fn(),
          codeArtifact: { findMany: jest.fn() },
        } as any;
        return new HybridRetrievalService(
          { searchSimilar: jest.fn() } as any,
          { embed: jest.fn() } as any,
          { findById: jest.fn() } as any,
          { expandFromSeeds: jest.fn() } as any,
          prisma,
          new DomainPackRegistry(),
        );
      };
      const req = {
        projectId: '11111111-1111-1111-1111-111111111111',
        repositoryId: '22222222-2222-2222-2222-222222222222',
        snapshotId: '33333333-3333-3333-3333-333333333333',
        changeRequest: 'Update BookingService cancel flow',
        maxResults: 1,
      };

      expect(await twoEqualHits().retrieve(req)).toHaveLength(1);
      const adaptive = await twoEqualHits().retrieve({ ...req, tuning: { adaptiveTailGap: 0.1 } });
      expect(adaptive.length).toBeGreaterThan(1);
    });
  });

  describe('profile-aware retrieval hints (Phase 20C)', () => {
    it('loads profile domain and applies multi-label intent detection to boost order', async () => {
      const prisma = {
        repositorySnapshot: {
          findUnique: jest.fn().mockResolvedValue({ 
            indexStatus: 'NOT_INDEXED',
            profile: { domain: 'BOOKING' }
          }),
        },
        $queryRaw: jest.fn().mockResolvedValue([
          {
            id: 'art-unrelated',
            artifactKey: 'unrelated',
            filePath: 'src/booking.util.ts',
            symbolName: 'BookingUtil',
            artifactType: 'CLASS',
            universalKind: 'UNKNOWN',
            name: 'BookingUtil',
          },
          {
            id: 'art-api',
            artifactKey: 'api',
            filePath: 'src/booking.controller.ts',
            symbolName: 'BookingController',
            artifactType: 'CONTROLLER',
            universalKind: 'API_ENDPOINT',
            name: 'BookingController',
          },
          {
            id: 'art-service',
            artifactKey: 'service',
            filePath: 'src/booking.service.ts',
            symbolName: 'BookingService',
            artifactType: 'SERVICE',
            universalKind: 'DOMAIN_SERVICE',
            name: 'BookingService',
          },
        ]),
      } as any;

      const service = new HybridRetrievalService(
        { searchSimilar: jest.fn() } as any,
        { embed: jest.fn() } as any,
	        { findById: jest.fn() } as any,
	        { expandFromSeeds: jest.fn() } as any,
	        prisma,
	        new DomainPackRegistry(),
	      );

      const requestText = 'Fix booking API logic'; 
      // Contains 'booking' (from BOOKING domain)
      // Contains 'API' (intent: API_ENDPOINT)
      // Contains 'logic' (intent: DOMAIN_SERVICE)

      const results = await service.retrieve({
        projectId: '11',
        repositoryId: '22',
        snapshotId: '33',
        changeRequest: requestText,
        maxResults: 5,
      });

      // Assert profile loading
      expect(prisma.repositorySnapshot.findUnique).toHaveBeenCalledWith({
        where: { id: '33' },
        include: { profile: true },
      });

      // No hard filtering: all 3 lexical hits returned
      expect(results).toHaveLength(3);

      // Verify kindBoost and intent detection
      const apiResult = results.find(r => r.artifactId === 'art-api');
      const serviceResult = results.find(r => r.artifactId === 'art-service');
      const unrelatedResult = results.find(r => r.artifactId === 'art-unrelated');

      expect(apiResult?.kindBoost).toBe(1.0);
      expect(serviceResult?.kindBoost).toBe(1.0);
      expect(unrelatedResult?.kindBoost).toBe(0);

      // Weights calculation verification
      // lexicalScore = 1.0 * 0.45 = 0.45
      // kindBoost = 1.0 * 0.05 = 0.05
      // Expect boosted to be strictly higher than unrelated
      expect(apiResult!.score).toBeGreaterThan(unrelatedResult!.score);
      expect(serviceResult!.score).toBeGreaterThan(unrelatedResult!.score);

      // Verify retrievalDiagnostics
      expect(apiResult!.retrievalDiagnostics).toBeDefined();
      expect(apiResult!.retrievalDiagnostics?.version).toBe('retrieval-diagnostics@0.1.0');
      expect(apiResult!.retrievalDiagnostics?.matchedIntentLabels).toContain('API');
      expect(apiResult!.retrievalDiagnostics?.matchedIntentLabels).toContain('SERVICE');
      expect(apiResult!.retrievalDiagnostics?.kindBoostNorm).toBe(1.0);
      expect(apiResult!.retrievalDiagnostics?.universalKind).toBe('API_ENDPOINT');
      expect(apiResult!.retrievalDiagnostics?.repositoryProfile?.domain).toBe('BOOKING');

      // Verify unrelated has no kindBoost
      expect(unrelatedResult!.retrievalDiagnostics?.kindBoostNorm).toBe(0);
      expect(unrelatedResult!.retrievalDiagnostics?.universalKind).toBe('UNKNOWN');
    });

    it('falls back when profile is missing', async () => {
      const prisma = {
        repositorySnapshot: {
          findUnique: jest.fn().mockResolvedValue({ 
            indexStatus: 'NOT_INDEXED',
            profile: null
          }),
        },
        $queryRaw: jest.fn().mockResolvedValue([]),
      } as any;

      const service = new HybridRetrievalService(
        { searchSimilar: jest.fn() } as any,
        { embed: jest.fn() } as any,
	        { findById: jest.fn() } as any,
	        { expandFromSeeds: jest.fn() } as any,
	        prisma,
	        new DomainPackRegistry(),
	      );

      await service.retrieve({
        projectId: '11',
        repositoryId: '22',
        snapshotId: '33',
        changeRequest: 'booking',
        domain: 'BOOKING',
      });

      // Used fallback domain 'BOOKING' via parameter
      // If it works, it won't throw. The test ensures it handles null profiles gracefully.
      expect(prisma.repositorySnapshot.findUnique).toHaveBeenCalled();
    });
  });
});
