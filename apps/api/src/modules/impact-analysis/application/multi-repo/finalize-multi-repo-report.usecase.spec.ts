import { AppError } from '@ba-helper/shared';
import { FinalizeMultiRepoReportUseCase } from './finalize-multi-repo-report.usecase';

describe('FinalizeMultiRepoReportUseCase', () => {
  const actor = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    role: 'ADMIN' as const,
  };

  const readyRun = {
    id: 'run-1',
    approvedMergedReport: null,
    analyses: [
      buildAnalysis('analysis-1', 'decision-1'),
      buildAnalysis('analysis-2', 'decision-2'),
    ],
  };

  it('rejects and skips upsert when child provenance changes during finalization', async () => {
    const runs = {
      findById: jest
        .fn()
        .mockResolvedValueOnce(readyRun)
        .mockResolvedValueOnce({
          ...readyRun,
          analyses: [
            buildAnalysis('analysis-1', 'decision-after-draft'),
            buildAnalysis('analysis-2', 'decision-2'),
          ],
        }),
    };
    const draft = {
      execute: jest.fn().mockResolvedValue({ markdown: '# merged report' }),
    };
    const reports = {
      upsertApproved: jest.fn(),
    };
    const getApproved = {
      execute: jest
        .fn()
        .mockRejectedValue(
          new AppError(
            'MERGED_MULTI_REPO_REPORT_NOT_FOUND',
            'Merged multi-repo report not found.',
          ),
        ),
    };
    const useCase = new FinalizeMultiRepoReportUseCase(
      runs as any,
      draft as any,
      reports as any,
      getApproved as any,
    );

    await expect(useCase.execute('run-1', actor)).rejects.toMatchObject({
      code: 'MULTI_REPO_RUN_NOT_READY',
      message:
        'Multi-repo analysis run changed during merged report finalization. Refresh and retry.',
    });
    expect(draft.execute).toHaveBeenCalledWith('run-1', actor);
    expect(reports.upsertApproved).not.toHaveBeenCalled();
  });
});

function buildAnalysis(analysisId: string, decisionId: string) {
  return {
    id: analysisId,
    status: 'COMPLETED',
    reviewDecisions: [
      {
        id: decisionId,
        decision: 'ACCEPTED',
      },
    ],
    snapshot: {
      id: `snapshot-${analysisId}`,
      commitSha: `commit-${analysisId}`,
    },
    sourceTarget: {
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: `commit-${analysisId}`,
    },
  };
}
