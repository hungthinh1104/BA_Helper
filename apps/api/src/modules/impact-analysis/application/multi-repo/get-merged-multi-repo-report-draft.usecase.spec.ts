import { GetMergedMultiRepoReportDraftUseCase } from './get-merged-multi-repo-report-draft.usecase';

describe('GetMergedMultiRepoReportDraftUseCase', () => {
  it('bounds child insight and traceability reads when a run has many repositories', async () => {
    const analyses = Array.from({ length: 20 }, (_, index) => ({
      id: `analysis-${index}`,
      status: 'COMPLETED',
      reviewDecisions: [{ id: `decision-${index}`, decision: 'ACCEPTED' }],
      snapshot: {
        id: `snapshot-${index}`,
        commitSha: `commit-${index}`,
        repositoryId: `repository-${index}`,
        repository: { canonicalUrl: `https://example.test/repository-${index}` },
        diagnostics: [],
      },
      sourceTarget: {
        requestedRef: 'main',
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: `commit-${index}`,
      },
    }));
    let activeReads = 0;
    let maximumConcurrentReads = 0;
    const read = async () => {
      activeReads += 1;
      maximumConcurrentReads = Math.max(maximumConcurrentReads, activeReads);
      await new Promise<void>((resolve) => setImmediate(resolve));
      activeReads -= 1;
      return [];
    };
    const insights = { listByAnalysis: jest.fn(read) };
    const traceability = { listByAnalysis: jest.fn(read) };
    const useCase = new GetMergedMultiRepoReportDraftUseCase(
      { findById: jest.fn().mockResolvedValue({
        id: 'run-1',
        projectId: 'project-1',
        requirementRevisionId: 'revision-1',
        requirementRevision: { title: 'Requirement', rawText: 'Change request' },
        analyses,
      }) } as never,
      insights as never,
      traceability as never,
      { build: jest.fn().mockReturnValue('draft') } as never,
      { execute: jest.fn().mockResolvedValue({}) } as never,
      { execute: jest.fn().mockResolvedValue({}) } as never,
    );

    await useCase.execute('run-1', { id: 'reviewer-1' } as never);

    expect(insights.listByAnalysis).toHaveBeenCalledTimes(20);
    expect(traceability.listByAnalysis).toHaveBeenCalledTimes(20);
    expect(maximumConcurrentReads).toBeLessThanOrEqual(8);
  });
});
