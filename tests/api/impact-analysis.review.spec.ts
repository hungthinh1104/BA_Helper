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
      { listByAnalysis: async () => [] } as any,
      { listBySnapshot: async () => [] } as any,
      { findByAnalysisId: () => Promise.resolve([]) } as any,
      { listByAnalysisId: () => Promise.resolve([]) } as any,
      { findApprovedReportByAnalysisId: async () => null, upsertApproved: () => Promise.resolve() } as any,
      { build: () => 'markdown' } as any,
      { listByAnalysisId: async () => [] } as any,
      { computeForAnalysis: async () => ({ computable: true, diff: {} }) } as any,
      createPrismaStub() as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false }),
    ).rejects.toMatchObject({
      code: 'FINALIZE_REQUIRES_REVIEW_ACK',
    });
  });

  it('requires acknowledgeUnreviewed when traceability links remain unreviewed', async () => {
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo({ insights: [{ reviewStatus: 'CONFIRMED' }] }) as any,
      { listByAnalysis: async () => [] } as any,
      { listByAnalysis: async () => [{ reviewStatus: 'NEEDS_REVIEW' }] } as any,
      { listBySnapshot: async () => [] } as any,
      { findByAnalysisId: () => Promise.resolve([]) } as any,
      { listByAnalysisId: () => Promise.resolve([]) } as any,
      { findApprovedReportByAnalysisId: async () => null, upsertApproved: () => Promise.resolve() } as any,
      { build: () => 'markdown' } as any,
      { listByAnalysisId: async () => [] } as any,
      { computeForAnalysis: async () => ({ computable: true, diff: {} }) } as any,
      createPrismaStub() as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false }),
    ).rejects.toMatchObject({
      code: 'FINALIZE_REQUIRES_REVIEW_ACK',
    });
  });

  it('allows finalization when unreviewed items are acknowledged', async () => {
    let upsertCalled = false;
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo({ insights: [{ reviewStatus: 'NEEDS_REVIEW' }] }) as any,
      { listByAnalysis: async () => [] } as any,
      { listByAnalysis: async () => [{ reviewStatus: 'NEEDS_REVIEW' }] } as any,
      { listBySnapshot: async () => [] } as any,
      { findByAnalysisId: () => Promise.resolve([]) } as any,
      { listByAnalysisId: () => Promise.resolve([]) } as any,
      { 
        findApprovedReportByAnalysisId: async () => null,
        upsertApproved: async () => { upsertCalled = true; return { id: 'some-id', createdAt: new Date(), updatedAt: new Date() }; } 
      } as any,
      { build: () => 'markdown' } as any,
      { listByAnalysisId: async () => [] } as any,
      { computeForAnalysis: async () => ({ computable: true, diff: {} }) } as any,
      createPrismaStub({ onUpsert: async () => { upsertCalled = true; } }) as any,
    );

    const result = await useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true });
    expect(result.id).toEqual('analysis-1');
    expect(upsertCalled).toBe(true);
  });

  it('does not leave a placeholder report if the builder fails', async () => {
    let upsertCalls = 0;
    const useCase = new FinalizeImpactAnalysisUseCase(
      createStubRepo() as any,
      { listByAnalysis: async () => [] } as any,
      { listByAnalysis: async () => [] } as any,
      { listBySnapshot: async () => [] } as any,
      { findByAnalysisId: () => Promise.resolve([]) } as any,
      { listByAnalysisId: () => Promise.resolve([]) } as any,
      { 
        findApprovedReportByAnalysisId: async () => null,
        upsertApproved: async () => { upsertCalls++; } 
      } as any,
      { build: () => { throw new Error('Builder crashed'); } } as any,
      { listByAnalysisId: async () => [] } as any,
      { computeForAnalysis: async () => ({ computable: true, diff: {} }) } as any,
      createPrismaStub({ onUpsert: async () => { upsertCalls++; } }) as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false }),
    ).rejects.toThrow('Builder crashed');
    
    expect(upsertCalls).toBe(0); // Upsert should not be called at all since builder throws before
  });
});
