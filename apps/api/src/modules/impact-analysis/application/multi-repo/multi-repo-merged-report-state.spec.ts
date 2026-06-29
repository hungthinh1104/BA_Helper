import {
  deriveChildBlockingReason,
  deriveMergedReportBlockedReasons,
  deriveMergedReportCapabilities,
  deriveMergedReportState,
  deriveMergedReportStaleness,
} from './multi-repo-merged-report-state';

describe('multi-repo merged report state', () => {
  const analysisId = '11111111-1111-4111-8111-111111111111';
  const decisionId = '22222222-2222-4222-8222-222222222222';
  const decisionId2 = '33333333-3333-4333-8333-333333333333';
  const snapshotId = '44444444-4444-4444-8444-444444444444';

  it('marks a matching approved report as current and exportable', () => {
    const staleness = deriveMergedReportStaleness({
      storedChildProvenance: [
        {
          analysisId,
          latestReviewDecisionId: decisionId,
          snapshotId,
          commitSha: 'abc123',
        },
      ],
      currentChildProvenance: [
        {
          analysisId,
          latestReviewDecisionId: decisionId,
          snapshotId,
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
          analysisId,
          latestReviewDecisionId: decisionId,
          snapshotId,
          commitSha: 'abc123',
        },
      ],
      currentChildProvenance: [
        {
          analysisId,
          latestReviewDecisionId: decisionId,
          snapshotId,
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

  it('allows refresh when an approved report is stale but child readiness is restored', () => {
    const state = deriveMergedReportState({
      approvedReportProvenance: {
        childAnalyses: [
          {
            analysisId,
            latestReviewDecisionId: decisionId,
            snapshotId,
            commitSha: 'abc123',
          },
        ],
      },
      children: [
        {
          analysisId,
          latestReviewDecisionId: decisionId2,
          latestReviewDecision: 'ACCEPTED',
          snapshotId,
          commitSha: 'abc123',
          status: 'COMPLETED',
          sourceTarget: {
            resolvedRefType: 'BRANCH',
            latestObservedCommitSha: 'abc123',
          },
        },
      ],
    });

    expect(state.mergedReportStatus).toBe('STALE');
    expect(state.capabilities).toMatchObject({
      canFinalizeMergedReport: false,
      canRefreshMergedReport: true,
      canExportMergedReport: false,
      canReviewMergedReport: false,
      canOpenApprovedReport: true,
    });
  });

  it('marks invalid persisted provenance stale and blocks export/review', () => {
    const state = deriveMergedReportState({
      approvedReportProvenance: {
        childAnalyses: [{ analysisId: 'not-a-uuid' }],
      },
      children: [
        {
          analysisId,
          latestReviewDecisionId: decisionId,
          latestReviewDecision: 'ACCEPTED',
          snapshotId,
          commitSha: 'abc123',
          status: 'COMPLETED',
          sourceTarget: {
            resolvedRefType: 'BRANCH',
            latestObservedCommitSha: 'abc123',
          },
        },
      ],
    });

    expect(state.staleness).toEqual({
      isStale: true,
      staleReason:
        'Approved merged report provenance is invalid; refresh the snapshot before review or export.',
    });
    expect(state.mergedReportStatus).toBe('STALE');
    expect(state.storedChildProvenance).toEqual([]);
    expect(state.capabilities.canExportMergedReport).toBe(false);
    expect(state.capabilities.canReviewMergedReport).toBe(false);
  });

  it('uses stale as a row-level child blocking reason', () => {
    expect(
      deriveChildBlockingReason({
        status: 'COMPLETED',
        latestReviewDecision: 'ACCEPTED',
        isStale: true,
      }),
    ).toBe('STALE');
  });
});
