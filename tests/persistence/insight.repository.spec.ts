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
    const transaction = {
      baInsight: {
        findMany: async () => [{
          id: 'ins-1',
          impactAnalysis: { snapshotId: 'snapshot-1', requirementRevisionId: 'revision-1' },
        }],
      },
      evidence: {
        findMany: async () => [{
          id: 'ev-1',
          snapshotId: 'snapshot-1',
          artifactId: null,
          requirementRevisionId: null,
          artifact: null,
        }],
      },
      insightEvidence: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction),
      insightEvidence: { findMany: async () => [] },
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

  it('bulk links insight evidence in one idempotent write', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const transaction = {
      baInsight: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({
          id,
          impactAnalysis: { snapshotId: 'snapshot-1', requirementRevisionId: 'revision-1' },
        })),
      },
      evidence: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.map((id) => ({
          id,
          snapshotId: 'snapshot-1',
          artifactId: null,
          requirementRevisionId: null,
          artifact: null,
        })),
      },
      insightEvidence: { createMany },
    };
    const prisma = {
      $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction),
    };
    const repo = new InsightRepository(prisma as any);

    await repo.linkEvidenceMany([
      { insightId: 'ins-1', evidenceIds: ['ev-1', 'ev-2'] },
      { insightId: 'ins-2', evidenceIds: ['ev-3'] },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { insightId: 'ins-1', evidenceId: 'ev-1' },
        { insightId: 'ins-1', evidenceId: 'ev-2' },
        { insightId: 'ins-2', evidenceId: 'ev-3' },
      ],
      skipDuplicates: true,
    });
  });
});
