import { EvidenceRepository } from "@ba-helper/backend-runtime";

describe('EvidenceRepository', () => {
  it('uses createMany with skipDuplicates for upsertMany', async () => {
    const calls: Array<{ data: unknown; skipDuplicates?: boolean }> = [];
    const prisma = {
      evidence: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
        findMany: async () => [{ id: 'e-1', artifactId: 'a-1' }],
      },
    };

    const repo = new EvidenceRepository(prisma as any);

    await repo.upsertMany([
      {
        provenanceKey: 'snapshot:s1:artifact:a1',
        sourceType: 'CODE',
        snapshotId: 's1',
        artifactId: 'a1',
        sourcePath: 'src/file.ts',
        startLine: 1,
        endLine: 2,
        excerpt: 'excerpt',
        contentHash: 'hash',
        isRedacted: false,
        redactionMetadata: null,
      },
    ]);

    expect(calls).toEqual([
      {
        data: [
          {
            provenanceKey: 'snapshot:s1:artifact:a1',
            sourceType: 'CODE',
            snapshotId: 's1',
            artifactId: 'a1',
            requirementRevisionId: null,
            sourcePath: 'src/file.ts',
            startLine: 1,
            endLine: 2,
            excerpt: 'excerpt',
            contentHash: 'hash',
            isRedacted: false,
            redactionMetadata: null,
          },
        ],
        skipDuplicates: true,
      },
    ]);
  });
});
