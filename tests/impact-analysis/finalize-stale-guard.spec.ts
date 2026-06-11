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

describe('FinalizeImpactAnalysisUseCase staleness guard', () => {
  it('fails when target observation changes during finalization', async () => {
    const useCase = new FinalizeImpactAnalysisUseCase(
      new StubImpactRepo() as any,
      new StubDocumentRepo() as any,
      new StubEventLog() as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true }),
    ).rejects.toMatchObject({
      code: 'ANALYSIS_STALE',
    });
  });
});
