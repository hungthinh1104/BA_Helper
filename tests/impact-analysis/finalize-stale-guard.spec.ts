import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/finalize-impact-analysis.usecase';

class StubImpactRepo {
  findById = async () => ({
    id: 'analysis-1',
    status: 'WAITING_FOR_REVIEW',
    stage: 'DONE',
    progress: 100,
    sourceTarget: {
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'abc',
    },
    snapshot: {
      commitSha: 'abc',
    },
    insights: [],
  });

  finalizeIfCurrent = async () => ({ count: 0 });
}

class StubDocumentRepo {
  upsertApproved = async () => undefined;
}

class StubEventLog {
  recordEvent = async () => undefined;
}

class StubReviewNoteRepo {
  findByAnalysisId = async () => [];
}

describe('FinalizeImpactAnalysisUseCase staleness guard', () => {
  it('fails when target observation changes during finalization', async () => {
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
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true }),
    ).rejects.toMatchObject({
      code: 'ANALYSIS_STALE',
    });
  });
});
