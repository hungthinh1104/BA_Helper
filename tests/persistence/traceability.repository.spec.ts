import { TraceabilityRepository } from "@ba-helper/backend-runtime";

describe('TraceabilityRepository', () => {
  it('uses createMany with skipDuplicates for upsertMany', async () => {
    const calls: Array<{ data: unknown; skipDuplicates?: boolean }> = [];
    const prisma = {
      traceabilityLink: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
        findMany: async () => [{ id: 't-1', artifactId: 'a-1' }],
      },
      traceabilityEvidence: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
    };

    const repo = new TraceabilityRepository(prisma as any);

    await repo.upsertMany([
      {
        impactAnalysisId: 'analysis-1',
        artifactId: 'a-1',
        linkType: 'AFFECTED',
        linkBasis: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 1,
      },
    ]);

    expect(calls).toEqual([
      {
        data: [
          {
            impactAnalysisId: 'analysis-1',
            artifactId: 'a-1',
            linkType: 'AFFECTED',
            linkBasis: 'EVIDENCED',
            reviewStatus: 'NEEDS_REVIEW',
            confidence: 1,
          },
        ],
        skipDuplicates: true,
      },
    ]);
  });

  it('uses createMany with skipDuplicates for linkEvidence', async () => {
    const calls: Array<{ data: unknown; skipDuplicates?: boolean }> = [];
    const prisma = {
      traceabilityLink: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      traceabilityEvidence: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
        findMany: async () => [],
      },
    };

    const repo = new TraceabilityRepository(prisma as any);

    await repo.linkEvidence({
      linkId: 'link-1',
      evidenceIds: ['ev-1'],
    });

    expect(calls).toEqual([
      {
        data: [{ traceabilityLinkId: 'link-1', evidenceId: 'ev-1' }],
        skipDuplicates: true,
      },
    ]);
  });
});
