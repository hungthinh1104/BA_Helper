import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/finalize-impact-analysis.usecase';
import { AppError } from '../../apps/api/src/shared/app-error';

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
    insights: [
      { reviewStatus: 'NEEDS_REVIEW' },
      { reviewStatus: 'CONFIRMED' },
    ],
  });

  updateStatus = async () => ({
    id: 'analysis-1',
    status: 'COMPLETED',
    stage: 'DONE',
    progress: 100,
    sourceTarget: {
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'abc',
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

describe('FinalizeImpactAnalysisUseCase', () => {
  it('requires acknowledgeUnreviewed when insights remain unreviewed', async () => {
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
      useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: false }),
    ).rejects.toMatchObject({
      code: 'FINALIZE_REQUIRES_REVIEW_ACK',
    });
  });
});
