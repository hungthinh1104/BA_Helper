import { HybridRetrievalService } from './hybrid-retrieval.service';

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
