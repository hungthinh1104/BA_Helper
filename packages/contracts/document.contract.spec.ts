import {
  approvedImpactReportResponseSchema,
  multiRepoApprovedReportResponseSchema,
} from './src';

describe('report domain pack provenance contracts', () => {
  it('accepts legacy single approved report domain provenance without digest fields', () => {
    const payload = {
      id: '00000000-0000-4000-8000-000000000001',
      impactAnalysisId: '00000000-0000-4000-8000-000000000002',
      requirementRevisionId: '00000000-0000-4000-8000-000000000003',
      snapshotId: '00000000-0000-4000-8000-000000000004',
      sourceTargetId: '00000000-0000-4000-8000-000000000005',
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      format: 'MARKDOWN',
      title: 'Refund report',
      markdown: '# Refund report',
      isStale: false,
      provenance: {
        analysisId: '00000000-0000-4000-8000-000000000002',
        projectId: '00000000-0000-4000-8000-000000000006',
        repositoryId: '00000000-0000-4000-8000-000000000007',
        targetRef: 'main',
        commitSha: 'abc123',
        snapshotId: '00000000-0000-4000-8000-000000000004',
        analyzerVersion: 'nestjs-ts/0.1.0',
        generatedDocumentId: '00000000-0000-4000-8000-000000000001',
        generatedAt: '2026-06-27T00:00:00.000Z',
        staleStatusAtReadTime: false,
        domainPack: {
          domainPackId: 'booking',
          domainPackVersion: '0.1.0',
          domainPackStatus: 'STABLE',
          selectedBy: 'EXPLICIT',
        },
      },
    };

    expect(approvedImpactReportResponseSchema.parse(payload)).toEqual(payload);
  });

  it('accepts legacy merged report domain provenance without digest fields', () => {
    const payload = {
      id: '00000000-0000-4000-8000-000000000011',
      runId: '00000000-0000-4000-8000-000000000012',
      projectId: '00000000-0000-4000-8000-000000000013',
      requirementRevisionId: '00000000-0000-4000-8000-000000000014',
      requirementTitle: 'Refund report',
      markdown: '# Merged report',
      approvedAt: '2026-06-27T00:00:00.000Z',
      mergedReportStatus: 'CURRENT',
      capabilities: {
        canFinalizeMergedReport: false,
        canRefreshMergedReport: false,
        canExportMergedReport: true,
        canReviewMergedReport: true,
        canOpenApprovedReport: true,
        blockedReasons: [],
      },
      isStale: false,
      provenance: {
        domainPack: {
          domainPackId: 'healthcare',
          domainPackVersion: '0.1.0',
          domainPackStatus: 'PARTIAL',
          selectedBy: 'EXPLICIT',
        },
        childAnalyses: [
          {
            analysisId: '00000000-0000-4000-8000-000000000015',
            latestReviewDecisionId: '00000000-0000-4000-8000-000000000016',
            snapshotId: '00000000-0000-4000-8000-000000000017',
            commitSha: 'abc123',
          },
        ],
      },
    };

    expect(multiRepoApprovedReportResponseSchema.parse(payload)).toEqual(payload);
  });
});
