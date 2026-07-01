import { InsightRepository } from "@ba-helper/backend-runtime";

describe('InsightRepository', () => {
  it('uses createMany with skipDuplicates for upsertMany', async () => {
    const calls: Array<{ data: unknown; skipDuplicates?: boolean }> = [];
    const prisma = {
      baInsight: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
        findMany: async () => [{ id: 'i-1', insightKey: 'claim:cancel' }],
      },
      insightEvidence: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
    };

    const repo = new InsightRepository(prisma as any);

    await repo.upsertMany([
      {
        impactAnalysisId: 'analysis-1',
        insightKey: 'claim:cancel',
        insightType: 'CLAIM',
        certainty: 'EVIDENCED',
        reviewStatus: 'NEEDS_REVIEW',
        confidence: 1,
        title: 'Cancel route exists',
        description: 'The system exposes an API route for cancelling a booking.',
        reasoning: null,
      },
    ]);

    expect(calls).toEqual([
      {
        data: [
          {
            impactAnalysisId: 'analysis-1',
            insightKey: 'claim:cancel',
            insightType: 'CLAIM',
            certainty: 'EVIDENCED',
            reviewStatus: 'NEEDS_REVIEW',
            confidence: 1,
            title: 'Cancel route exists',
            description: 'The system exposes an API route for cancelling a booking.',
            reasoning: null,
          },
        ],
        skipDuplicates: true,
      },
    ]);
  });

  it('uses createMany with skipDuplicates for linkEvidence', async () => {
    const calls: Array<{ data: unknown; skipDuplicates?: boolean }> = [];
    const prisma = {
      baInsight: {
        createMany: async () => ({ count: 0 }),
        findMany: async () => [],
      },
      insightEvidence: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
        findMany: async () => [],
      },
    };

    const repo = new InsightRepository(prisma as any);

    await repo.linkEvidence({
      insightId: 'ins-1',
      evidenceIds: ['ev-1'],
    });

    expect(calls).toEqual([
      {
        data: [{ insightId: 'ins-1', evidenceId: 'ev-1' }],
        skipDuplicates: true,
      },
    ]);
  });
});
