import {
  deriveMergedReportBlockedReasons,
  deriveMergedReportCapabilities,
  deriveMergedReportStaleness,
} from './multi-repo-merged-report-state';

describe('multi-repo merged report state', () => {
  it('marks a matching approved report as current and exportable', () => {
    const staleness = deriveMergedReportStaleness({
      storedChildProvenance: [
        {
          analysisId: 'analysis-1',
          latestReviewDecisionId: 'decision-1',
          snapshotId: 'snapshot-1',
          commitSha: 'abc123',
        },
      ],
      currentChildProvenance: [
        {
          analysisId: 'analysis-1',
          latestReviewDecisionId: 'decision-1',
          snapshotId: 'snapshot-1',
          commitSha: 'abc123',
          status: 'COMPLETED',
          isStale: false,
        },
      ],
    });
    const state = deriveMergedReportCapabilities({
      hasApprovedReport: true,
      isApprovedReportStale: staleness.isStale,
      canStartMergedReport: true,
      blockedReasons: [],
    });

    expect(staleness).toEqual({ isStale: false });
    expect(state).toEqual({
      mergedReportStatus: 'CURRENT',
      capabilities: {
        canFinalizeMergedReport: false,
        canRefreshMergedReport: false,
        canExportMergedReport: true,
        canReviewMergedReport: true,
        canOpenApprovedReport: true,
        blockedReasons: ['MERGED_REPORT_CURRENT'],
      },
    });
  });

  it('marks child staleness as stale and blocks refresh until readiness is restored', () => {
    const staleness = deriveMergedReportStaleness({
      storedChildProvenance: [
        {
          analysisId: 'analysis-1',
          latestReviewDecisionId: 'decision-1',
          snapshotId: 'snapshot-1',
          commitSha: 'abc123',
        },
      ],
      currentChildProvenance: [
        {
          analysisId: 'analysis-1',
          latestReviewDecisionId: 'decision-1',
          snapshotId: 'snapshot-1',
          commitSha: 'abc123',
          status: 'COMPLETED',
          isStale: true,
        },
      ],
    });
    const blockers = deriveMergedReportBlockedReasons([
      {
        status: 'COMPLETED',
        isStale: true,
        latestReviewDecision: 'ACCEPTED',
      },
    ]);
    const state = deriveMergedReportCapabilities({
      hasApprovedReport: true,
      isApprovedReportStale: staleness.isStale,
      canStartMergedReport: false,
      blockedReasons: blockers,
    });

    expect(staleness).toMatchObject({
      isStale: true,
      staleReason:
        'A child analysis became stale after the approved merged report snapshot was generated.',
    });
    expect(state).toMatchObject({
      mergedReportStatus: 'STALE',
      capabilities: {
        canRefreshMergedReport: false,
        canExportMergedReport: false,
        canReviewMergedReport: false,
        canOpenApprovedReport: true,
        blockedReasons: ['CHILD_ANALYSIS_STALE'],
      },
    });
  });
});
