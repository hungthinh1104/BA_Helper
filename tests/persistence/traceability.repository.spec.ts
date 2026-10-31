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
        snapshotId: 'snapshot-1',
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
            snapshotId: 'snapshot-1',
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
    const transaction = {
      traceabilityLink: {
        findMany: async () => [{
          id: 'link-1',
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
      traceabilityEvidence: {
        createMany: async (params: { data: unknown; skipDuplicates?: boolean }) => {
          calls.push(params);
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction),
      traceabilityEvidence: { findMany: async () => [] },
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

  it('bulk links evidence for traceability records in one idempotent write', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const transaction = {
      traceabilityLink: {
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
      traceabilityEvidence: { createMany },
    };
    const prisma = {
      $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction),
    };
    const repo = new TraceabilityRepository(prisma as any);

    await repo.linkEvidenceMany([
      { linkId: 'link-1', evidenceIds: ['ev-1', 'ev-2'] },
      { linkId: 'link-2', evidenceIds: ['ev-3'] },
    ]);

    expect(createMany).toHaveBeenCalledWith({
      data: [
        { traceabilityLinkId: 'link-1', evidenceId: 'ev-1' },
        { traceabilityLinkId: 'link-1', evidenceId: 'ev-2' },
        { traceabilityLinkId: 'link-2', evidenceId: 'ev-3' },
      ],
      skipDuplicates: true,
    });
  });
});
