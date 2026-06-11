import type {
  ApprovedImpactReportResponse,
  CurrentWorkspaceResponse,
  ImpactAnalysisResponse,
  InsightListResponse,
  RepositoryDetailResponse,
  ScanJobResponse,
  SystemHealthResponse,
} from '@ba-helper/contracts';
import { publicGitHubSmokeManifest } from './public-github-smoke.manifest';
import {
  assertApprovedReport,
  assertCompletedScan,
  assertPreflight,
  assertReviewableAnalysis,
  assertTempWorkspaceCleanup,
  buildSmokeSummary,
  countBlockerSecurityDiagnostics,
  normalizeApiBaseUrl,
} from './public-github-smoke.helpers';

describe('public GitHub smoke helpers', () => {
  const workspace: CurrentWorkspaceResponse = {
    createdAt: new Date().toISOString(),
    membershipRole: null,
    mode: 'dev-single-user',
    name: 'Default Project',
    projectId: '11111111-1111-4111-8111-111111111111',
  };

  const health: SystemHealthResponse = {
    apiVersion: '0.1.0',
    dependencies: {
      database: 'up',
      pgvector: 'up',
      queue: 'up',
      redis: 'up',
    },
    serverTime: new Date().toISOString(),
    status: 'ok',
    workspaceMode: 'dev-single-user',
  };

  const scanJob: ScanJobResponse = {
    capabilities: { canCancel: false, canRerun: true },
    createdAt: new Date().toISOString(),
    diagnostics: [],
    error: null,
    id: '22222222-2222-4222-8222-222222222222',
    progress: 100,
    result: {
      snapshotCoverageStatus: 'READY',
      snapshotId: '33333333-3333-4333-8333-333333333333',
      sourceTargetId: '44444444-4444-4444-8444-444444444444',
    },
    stage: 'DONE',
    status: 'COMPLETED',
    updatedAt: new Date().toISOString(),
  };

  const repositoryDetail: RepositoryDetailResponse = {
    artifactStats: { controllers: 1, entities: 1, services: 1, tests: 1 },
    canonicalUrl: publicGitHubSmokeManifest.repositoryUrl,
    displayName: 'booking',
    createdAt: new Date().toISOString(),
    id: '55555555-5555-4555-8555-555555555555',
    latestScanJob: undefined,
    latestSnapshot: {
      analyzerVersion: '0.1.0',
      commitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
      coverageStatus: 'READY',
      diagnostics: [],
      id: '33333333-3333-4333-8333-333333333333',
      indexStatus: 'VECTOR_READY',
    },
    latestTarget: {
      id: '44444444-4444-4444-8444-444444444444',
      requestedRef: 'main',
      resolvedCommitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
    },
  };

  const analysis: ImpactAnalysisResponse = {
    capabilities: {
      canCancel: false,
      canExport: false,
      canFinalize: true,
      canReview: true,
      canRerun: true,
    },
    coverageWarning: null,
    freshness: {
      basis: 'LATEST_OBSERVED_SOURCE_TARGET',
      isAnalyzerOutdated: false,
      isStale: false,
    },
    id: '66666666-6666-4666-8666-666666666666',
    progress: 100,
    requirement: {
      id: '77777777-7777-4777-8777-777777777777',
      rawText: publicGitHubSmokeManifest.changeRequestRawText,
      revisionId: '88888888-8888-4888-8888-888888888888',
      revisionTitle: publicGitHubSmokeManifest.changeRequestTitle,
    },
    snapshot: {
      analyzerVersion: '0.1.0',
      commitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
      coverageStatus: 'READY',
      id: '33333333-3333-4333-8333-333333333333',
      repositoryId: repositoryDetail.id,
      indexStatus: 'VECTOR_READY',
    },
    sourceTarget: {
      id: '44444444-4444-4444-8444-444444444444',
      latestObservedCommitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
      requestedRef: 'main',
      resolvedRefType: 'BRANCH',
    },
    stage: 'DONE',
    status: 'WAITING_FOR_REVIEW',
  };

  const insights: InsightListResponse = {
    items: [
      {
        category: 'UNKNOWN',
        certainty: 'UNKNOWN',
        confidence: 0.3,
        evidence: [],
        id: '99999999-9999-4999-8999-999999999999',
        reviewStatus: 'NEEDS_REVIEW',
        statement: 'Refund behavior is not directly evidenced in this repository.',
      },
    ],
  };

  const report: ApprovedImpactReportResponse = {
    format: 'MARKDOWN',
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    impactAnalysisId: analysis.id,
    isStale: false,
    markdown: '# Approved report',
    provenance: {
      analysisId: analysis.id,
      projectId: workspace.projectId,
      repositoryId: repositoryDetail.id,
      targetRef: analysis.sourceTarget.requestedRef,
      analyzerVersion: '0.1.0',
      commitSha: analysis.snapshot.commitSha,
      snapshotId: analysis.snapshot.id,
      generatedDocumentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      generatedAt: new Date().toISOString(),
      staleStatusAtReadTime: false,
    },
    requirementRevisionId: analysis.requirement.revisionId,
    snapshotId: analysis.snapshot.id,
    sourceTargetId: analysis.sourceTarget.id,
    staleReason: undefined,
    status: 'APPROVED',
    title: 'Approved Report',
    type: 'IMPACT_REPORT',
  };

  it('validates the pinned public smoke scenario manifest', () => {
    expect(publicGitHubSmokeManifest.repositoryUrl).toBe(
      'https://github.com/ndmen/booking',
    );
    expect(publicGitHubSmokeManifest.requestedRef).toBe('main');
  });

  it('accepts healthy preflight and completed scan/report lifecycle data', () => {
    expect(assertPreflight(health, workspace)).toMatchObject({ health, workspace });
    expect(assertCompletedScan(publicGitHubSmokeManifest, scanJob, repositoryDetail)).toEqual({
      commitSha: repositoryDetail.latestSnapshot!.commitSha,
      coverageStatus: 'READY',
      snapshotId: repositoryDetail.latestSnapshot!.id,
      sourceTargetId: scanJob.result.sourceTargetId,
    });

    expect(() =>
      assertReviewableAnalysis(publicGitHubSmokeManifest, analysis, insights),
    ).not.toThrow();
    expect(() =>
      assertApprovedReport(report, analysis, analysis.snapshot.commitSha),
    ).not.toThrow();
  });

  it('builds a machine-readable success summary and detects temp-dir leaks', () => {
    const summary = buildSmokeSummary({
      afterTempDirCount: 2,
      analysis,
      beforeTempDirCount: 2,
      insights,
      manifest: publicGitHubSmokeManifest,
      report,
      repository: { id: repositoryDetail.id },
      repositoryDetail,
      scanJob,
      workspace,
      scanDurationMs: 1000,
      analysisDurationMs: 1000,
    });

    expect(summary.scan.snapshotId).toBe(scanJob.result.snapshotId);
    expect(summary.diagnostics.blockerSecurityCount).toBe(0);
    expect(() => assertTempWorkspaceCleanup(summary)).not.toThrow();
  });

  it('counts blocker-level security diagnostics only', () => {
    expect(
      countBlockerSecurityDiagnostics([
        { category: 'LIMIT', code: 'REPO_LIMIT_EXCEEDED', message: 'x', severity: 'BLOCKER' },
        { category: 'SECURITY', code: 'SECRET_REDACTED', message: 'x', severity: 'WARN' },
        { category: 'SECURITY', code: 'SECURITY_RISK_BLOCKED', message: 'x', severity: 'BLOCKER' },
      ]),
    ).toBe(1);
  });

  it('normalizes API URLs for the smoke client', () => {
    expect(normalizeApiBaseUrl('http://localhost:3001/')).toBe(
      'http://localhost:3001',
    );
  });
});
