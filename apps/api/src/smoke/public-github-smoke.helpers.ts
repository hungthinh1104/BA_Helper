import { readdir } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  ApprovedImpactReportResponse,
  DiagnosticItem,
  ImpactAnalysisResponse,
  InsightListResponse,
  RepositoryDetailResponse,
  ScanJobResponse,
  SystemHealthResponse,
  CurrentWorkspaceResponse,
  ReviewQueueResponse,
} from '@ba-helper/contracts';
import type { PublicGitHubSmokeManifest } from './public-github-smoke.manifest';

export interface SmokePreflightResult {
  health: SystemHealthResponse;
  workspace: CurrentWorkspaceResponse;
}

export interface SmokeSummary {
  analysis: {
    id: string;
    insightCount: number;
    status: string;
    durationMs: number;
  };
  diagnostics: {
    blockerSecurityCount: number;
    scanDiagnosticCount: number;
    snapshotDiagnosticCount: number;
  };
  report: {
    id: string;
    isStale: boolean;
    title: string;
    markdownLength: number;
  };
  repository: {
    id: string;
    requestedRef: string;
    url: string;
  };
  scan: {
    commitSha: string;
    coverageStatus: 'READY' | 'PARTIAL';
    jobId: string;
    snapshotId: string;
    status: string;
    durationMs: number;
  };
  tempWorkspaceCleanup: {
    afterCount: number;
    beforeCount: number;
    leaked: boolean;
  };
  workspace: {
    mode: string;
    projectId: string;
  };
  vector?: {
    indexStatus: string;
    embeddingChunkCount: number;
    embeddingModel: string;
    vectorSignalCount: number;
    hybridSignalCount: number;
  };
  llm?: {
    provider: string;
    model: string;
    promptVersion: string;
    parseMode: string;
    inputTokens: number;
    outputTokens: number;
  };
  reviewQueue?: {
    total: number;
    remaining: number;
    highRiskRemaining: number;
    blockingRemaining: number;
  };
  links: {
    analysisUrl: string;
    reportUrl: string;
  };
}

export type SmokeFailureStage =
  | 'AUTH_BOOTSTRAP'
  | 'SCAN'
  | 'EMBEDDING_VECTOR_READINESS'
  | 'IMPACT_ANALYSIS_AI_OUTPUT'
  | 'REPORT_FINALIZATION'
  | 'UNKNOWN';

const TEMP_DIR_PREFIX = 'ba-scan-';

export function assertPreflight(
  health: SystemHealthResponse,
  workspace: CurrentWorkspaceResponse,
): SmokePreflightResult {
  if (health.status !== 'ok') {
    throw new Error(
      `API health check failed: ${health.status} (${Object.entries(
        health.dependencies,
      )
        .map(([name, value]) => `${name}=${value}`)
        .join(', ')})`,
    );
  }

  if (workspace.mode !== 'dev-single-user') {
    throw new Error(
      `Smoke run requires dev-single-user workspace mode. Got: ${workspace.mode}`,
    );
  }

  return { health, workspace };
}

export function assertCompletedScan(
  manifest: PublicGitHubSmokeManifest,
  scanJob: ScanJobResponse,
  repository: RepositoryDetailResponse,
): {
  commitSha: string;
  coverageStatus: 'READY' | 'PARTIAL';
  snapshotId: string;
  sourceTargetId: string;
} {
  if (scanJob.status !== 'COMPLETED') {
    throw new Error(`Scan job did not complete successfully. Got: ${scanJob.status}`);
  }

  if (!scanJob.result.snapshotId) {
    throw new Error('Completed scan did not publish a snapshotId.');
  }

  if (!scanJob.result.sourceTargetId) {
    throw new Error('Completed scan did not publish a sourceTargetId.');
  }

  if (!repository.latestSnapshot) {
    throw new Error('Repository detail did not expose latestSnapshot after scan completion.');
  }

  if (!manifest.expected.allowCoverageStatuses.includes(repository.latestSnapshot.coverageStatus)) {
    throw new Error(
      `Snapshot coverage status ${repository.latestSnapshot.coverageStatus} is not allowed by manifest.`,
    );
  }

  const blockerSecurityCount = countBlockerSecurityDiagnostics([
    ...(scanJob.diagnostics ?? []),
    ...(repository.latestSnapshot.diagnostics ?? []),
  ]);

  if (
    manifest.expected.requireNoBlockerSecurityDiagnostics &&
    blockerSecurityCount > 0
  ) {
    throw new Error('Smoke run detected blocker-level security diagnostics.');
  }

  return {
    commitSha: repository.latestSnapshot.commitSha,
    coverageStatus: repository.latestSnapshot.coverageStatus,
    snapshotId: repository.latestSnapshot.id,
    sourceTargetId: scanJob.result.sourceTargetId,
  };
}

export function assertReviewableAnalysis(
  manifest: PublicGitHubSmokeManifest,
  analysis: ImpactAnalysisResponse,
  insights: InsightListResponse,
): void {
  if (analysis.status !== 'WAITING_FOR_REVIEW' && analysis.status !== 'COMPLETED') {
    throw new Error(
      `Analysis did not reach a reviewable state. Got: ${analysis.status}`,
    );
  }

  if (insights.items.length < manifest.expected.minInsights) {
    throw new Error(
      `Expected at least ${manifest.expected.minInsights} insights, got ${insights.items.length}.`,
    );
  }
}

export function assertApprovedReport(
  report: ApprovedImpactReportResponse,
  analysis: ImpactAnalysisResponse,
  expectedCommitSha: string,
): void {
  if (report.status !== 'APPROVED') {
    throw new Error(`Expected approved report, got: ${report.status}`);
  }

  if (report.impactAnalysisId !== analysis.id) {
    throw new Error('Approved report is not tied to the expected analysis.');
  }

  if (report.snapshotId !== analysis.snapshot.id) {
    throw new Error('Approved report is not tied to the expected snapshot.');
  }

  if (report.provenance.commitSha !== expectedCommitSha) {
    throw new Error('Approved report provenance commitSha does not match scanned snapshot.');
  }
}

export async function countTempScanWorkspaces(): Promise<number> {
  const entries = await readdir(os.tmpdir(), { withFileTypes: true });
  return entries.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith(TEMP_DIR_PREFIX),
  ).length;
}

export function buildSmokeSummary(input: {
  afterTempDirCount: number;
  analysis: ImpactAnalysisResponse;
  beforeTempDirCount: number;
  insights: InsightListResponse;
  manifest: PublicGitHubSmokeManifest;
  report: ApprovedImpactReportResponse;
  repository: { id: string };
  repositoryDetail: RepositoryDetailResponse;
  scanJob: ScanJobResponse;
  workspace: CurrentWorkspaceResponse;
  scanDurationMs: number;
  analysisDurationMs: number;
  vectorInfo?: SmokeSummary['vector'];
  llmInfo?: SmokeSummary['llm'];
  reviewQueue?: ReviewQueueResponse;
  apiUrl?: string;
}): SmokeSummary {
  const snapshotDiagnostics = input.repositoryDetail.latestSnapshot?.diagnostics ?? [];
  const scanDiagnostics = input.scanJob.diagnostics ?? [];
  const coverageStatus = input.repositoryDetail.latestSnapshot?.coverageStatus;
  const commitSha = input.repositoryDetail.latestSnapshot?.commitSha;
  const snapshotId = input.repositoryDetail.latestSnapshot?.id;

  if (!coverageStatus || !commitSha || !snapshotId) {
    throw new Error('Repository detail is missing latest snapshot data.');
  }

  return {
    analysis: {
      id: input.analysis.id,
      insightCount: input.insights.items.length,
      status: input.analysis.status,
      durationMs: input.analysisDurationMs,
    },
    diagnostics: {
      blockerSecurityCount: countBlockerSecurityDiagnostics([
        ...scanDiagnostics,
        ...snapshotDiagnostics,
      ]),
      scanDiagnosticCount: scanDiagnostics.length,
      snapshotDiagnosticCount: snapshotDiagnostics.length,
    },
    report: {
      id: input.report.id,
      isStale: input.report.isStale,
      title: input.report.title,
      markdownLength: input.report.markdown.length,
    },
    repository: {
      id: input.repository.id,
      requestedRef: input.manifest.requestedRef,
      url: input.manifest.repositoryUrl,
    },
    scan: {
      commitSha,
      coverageStatus,
      jobId: input.scanJob.id,
      snapshotId,
      status: input.scanJob.status,
      durationMs: input.scanDurationMs,
    },
    tempWorkspaceCleanup: {
      afterCount: input.afterTempDirCount,
      beforeCount: input.beforeTempDirCount,
      leaked: input.afterTempDirCount > input.beforeTempDirCount,
    },
    workspace: {
      mode: input.workspace.mode,
      projectId: input.workspace.projectId,
    },
    vector: input.vectorInfo,
    llm: input.llmInfo,
    reviewQueue: input.reviewQueue ? {
      total: input.reviewQueue.summary.total,
      remaining: input.reviewQueue.summary.remaining,
      highRiskRemaining: input.reviewQueue.summary.highRiskRemaining,
      blockingRemaining: input.reviewQueue.summary.blockingRemaining,
    } : undefined,
    links: {
      analysisUrl: `http://localhost:3000/analyses/${input.analysis.id}`,
      reportUrl: `http://localhost:3000/reports?analysisId=${input.analysis.id}`,
    },
  };
}

export function assertTempWorkspaceCleanup(summary: SmokeSummary): void {
  if (summary.tempWorkspaceCleanup.leaked) {
    throw new Error(
      `Temp workspace leak detected: before=${summary.tempWorkspaceCleanup.beforeCount}, after=${summary.tempWorkspaceCleanup.afterCount}`,
    );
  }
}

export function getPollDeadline(timeoutMs: number): number {
  return Date.now() + timeoutMs;
}

export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeApiBaseUrl(url: string): string {
  return new URL(url).toString().replace(/\/$/, '');
}

export function countBlockerSecurityDiagnostics(
  diagnostics: DiagnosticItem[],
): number {
  return diagnostics.filter(
    (item) =>
      item.severity === 'BLOCKER' &&
      (item.category === 'SECURITY' || item.code === 'SECURITY_RISK_BLOCKED'),
  ).length;
}

export function formatFailureSummary(
  error: unknown,
  partial?: Record<string, unknown>,
): string {
  const message = error instanceof Error ? error.message : String(error);
  return JSON.stringify(
    {
      error: message,
      stage: classifySmokeFailureStage(message),
      partial,
      status: 'failed',
    },
    null,
    2,
  );
}

export function getRunbookPath(): string {
  const cwd = process.cwd();
  const repoRoot = cwd.endsWith(path.join('apps', 'api'))
    ? path.resolve(cwd, '../..')
    : cwd;

  return path.resolve(repoRoot, 'docs/runbooks/public-github-smoke-demo.md');
}

export function getSmokeDiagnosticsDir(): string {
  return path.resolve(path.dirname(getRunbookPath()), 'diagnostics');
}

export function classifySmokeFailureStage(message: string): SmokeFailureStage {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('auth_supplied_token_failed') ||
    normalized.includes('dev login') ||
    normalized.includes('/auth/dev-login') ||
    normalized.includes('/auth/me') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'AUTH_BOOTSTRAP';
  }

  if (
    normalized.includes('scan job') ||
    normalized.includes('vector_failed') ||
    normalized.includes('unsupported_framework') ||
    normalized.includes('worker_not_processing: scan')
  ) {
    return 'SCAN';
  }

  if (
    normalized.includes('vector_ready') ||
    normalized.includes('embedding') ||
    normalized.includes('chunk') ||
    normalized.includes('vector')
  ) {
    return 'EMBEDDING_VECTOR_READINESS';
  }

  if (
    normalized.includes('ai_json_parse_failed') ||
    normalized.includes('ai_output_schema') ||
    normalized.includes('ai_output_truncated') ||
    normalized.includes('impact analysis failed') ||
    normalized.includes('runimpactanalysisusecase') ||
    normalized.includes('google llm output')
  ) {
    return 'IMPACT_ANALYSIS_AI_OUTPUT';
  }

  if (
    normalized.includes('approved report') ||
    normalized.includes('finalize') ||
    normalized.includes('reviewable') ||
    normalized.includes('review queue')
  ) {
    return 'REPORT_FINALIZATION';
  }

  return 'UNKNOWN';
}
