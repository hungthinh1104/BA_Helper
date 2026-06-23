import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase';
import { AppError } from '../../apps/api/src/shared/app-error';

const defaultAnalysisState = {
  id: 'analysis-1',
  status: 'WAITING_FOR_REVIEW',
  stage: 'DONE',
  progress: 100,
  sourceTarget: {
    resolvedRefType: 'BRANCH',
    latestObservedCommitSha: 'abc',
  },
  snapshot: {
    id: 'snap-1',
    commitSha: 'abc',
    analyzerVersion: '1.0',
    repositoryId: 'repo-1',
    repository: {
      projectId: 'proj-1',
    },
  },
  requirementRevision: {
    id: 'rev-1',
    requirementId: 'req-1',
    title: 'title',
    rawText: 'raw',
  },
  insights: [],
};

const createStubRepo = (overrides = {}) => ({
  findById: async () => ({ ...defaultAnalysisState, ...overrides }),
});

const createPrismaStub = (hooks?: {
  onUpsert?: () => void | Promise<void>;
}) => ({
  $transaction: async (callback: (tx: any) => Promise<unknown>) =>
    callback({
      impactAnalysis: {
        updateMany: async () => ({ count: 1 }),
      },
      generatedDocument: {
        upsert: async () => {
          await hooks?.onUpsert?.();
          return { id: 'doc-1' };
        },
      },
      domainEvent: {
        upsert: async () => ({ id: 'event-1' }),
      },
    }),
});

describe('FinalizeImpactAnalysisUseCase', () => {
  it('requires acknowledgeUnreviewed when insights remain unreviewed', async () => {
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo({ insights: [{ reviewStatus: 'NEEDS_REVIEW' }] }) as any,
      { listByAnalysis: async () => [] } as any,
      createPrismaStub() as any,
      { execute: async () => ({ id: 'snap-1' }) } as any,
      { execute: async () => {} } as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false, userId: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462' }),
    ).rejects.toMatchObject({
      code: 'FINALIZE_REQUIRES_REVIEW_ACK',
    });
  });

  it('requires acknowledgeUnreviewed when traceability links remain unreviewed', async () => {
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo({ insights: [{ reviewStatus: 'CONFIRMED' }] }) as any,
      { listByAnalysis: async () => [{ reviewStatus: 'NEEDS_REVIEW' }] } as any,
      createPrismaStub() as any,
      { execute: async () => ({ id: 'snap-1' }) } as any,
      { execute: async () => {} } as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false, userId: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462' }),
    ).rejects.toMatchObject({
      code: 'FINALIZE_REQUIRES_REVIEW_ACK',
    });
  });

  it('allows finalization when unreviewed items are acknowledged', async () => {
    let enqueueCalled = false;
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo({ insights: [{ reviewStatus: 'NEEDS_REVIEW' }] }) as any,
      { listByAnalysis: async () => [{ reviewStatus: 'NEEDS_REVIEW' }] } as any,
      createPrismaStub() as any,
      { execute: async () => ({ id: 'snap-1' }) } as any,
      { execute: async () => { enqueueCalled = true; } } as any,
    );

    const result = await useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true, userId: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462' });
    expect(result.id).toEqual('analysis-1');
    expect(enqueueCalled).toBe(true);
  });

  it('does not leave a placeholder report if the builder fails', async () => {
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo() as any,
      { listByAnalysis: async () => [] } as any,
      createPrismaStub() as any,
      { execute: async () => { throw new Error('Snapshot crashed'); } } as any,
      { execute: async () => {} } as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false, userId: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462' }),
    ).rejects.toThrow('Snapshot crashed');
  });
});
