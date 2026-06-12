import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase';

class StubImpactRepo {
  findById = async () => ({
    id: 'analysis-2',
    status: 'WAITING_FOR_REVIEW',
    stage: 'DONE',
    progress: 100,
    sourceTarget: {
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'def',
    },
    snapshot: {
      commitSha: 'abc',
    },
    insights: [],
  });

  updateStatus = async () => ({
    id: 'analysis-2',
    status: 'COMPLETED',
    stage: 'DONE',
    progress: 100,
    sourceTarget: {
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'def',
    },
    snapshot: {
      commitSha: 'abc',
    },
    requirementRevision: {
      id: 'rev-1',
      requirementId: 'req-1',
      title: 'title',
      rawText: 'raw',
    },
  });
}

class StubDocumentRepo {
  upsertApproved = async () => undefined;
}

class StubEventLog {
  recordEvent = async () => undefined;
}

describe('FinalizeImpactAnalysisUseCase stale guard', () => {
  it('rejects when analysis is stale', async () => {
    const useCase = new FinalizeImpactAnalysisUseCase(
      new StubImpactRepo() as any,
      { listByAnalysis: async () => [] } as any,
      { listByAnalysis: async () => [] } as any,
      { listBySnapshot: async () => [] } as any,
      { findByAnalysisId: () => Promise.resolve([]) } as any,
      { listByAnalysisId: () => Promise.resolve([]) } as any,
      { upsertApproved: () => Promise.resolve() } as any,
      new StubEventLog() as any,
      { build: () => 'markdown' } as any,
      { listByAnalysisId: async () => [] } as any,
      { computeForAnalysis: async () => ({ computable: true, diff: {} }) } as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-2', acknowledgeUnreviewed: true }),
    ).rejects.toMatchObject({ code: 'ANALYSIS_STALE' });
  });
});
