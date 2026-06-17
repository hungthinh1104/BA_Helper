import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase';

class StubImpactRepo {
  findById = async () => ({
    id: 'analysis-1',
    status: 'WAITING_FOR_REVIEW',
    stage: 'DONE',
    progress: 100,
    sourceTarget: {
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'abc',
      requestedRef: 'main',
    },
    snapshot: {
      id: 'snapshot-1',
      commitSha: 'abc',
      analyzerVersion: '1.0.0',
      repositoryId: 'repo-1',
      repository: {
        projectId: 'proj-1',
      },
    },
    requirementRevision: {
      title: 'Requirement',
      rawText: 'raw requirement',
    },
    insights: [],
  });
}

class StubDocumentRepo {
  findApprovedReportByAnalysisId = async () => null;
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
      new StubDocumentRepo() as any,
      { build: () => 'markdown' } as any,
      { listByAnalysisId: async () => [] } as any,
      { computeForAnalysis: async () => ({ computable: true, diff: {} }) } as any,
      {
        $transaction: async (callback: (tx: any) => Promise<unknown>) =>
          callback({
            impactAnalysis: {
              updateMany: async () => ({ count: 0 }),
            },
            generatedDocument: {
              upsert: async () => ({ id: 'doc-1' }),
            },
            domainEvent: {
              upsert: async () => ({ id: 'event-1' }),
            },
          }),
      } as any,
    );

    await expect(
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true }),
    ).rejects.toMatchObject({
      code: 'ANALYSIS_STALE',
    });
  });
});
