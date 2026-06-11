import { HybridRetrievalService } from './hybrid-retrieval.service';

describe('HybridRetrievalService security', () => {
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
