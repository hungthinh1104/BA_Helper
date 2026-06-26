import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { MultiRepoAnalysisRunRepository } from '../../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from '../../infrastructure/multi-repo-merged-report.repository';
import { deriveMultiRepoRunAggregates } from './multi-repo-run-readiness';
import {
  deriveMergedReportBlockedReasons,
  deriveMergedReportCapabilities,
  deriveMergedReportStaleness,
  normalizeChildProvenance,
} from './multi-repo-merged-report-state';

type StoredChildProvenance = {
  analysisId: string;
  latestReviewDecisionId: string;
  snapshotId: string;
  commitSha: string;
};

@Injectable()
export class GetApprovedMultiRepoReportUseCase {
  constructor(
    private readonly reports: MultiRepoMergedReportRepository,
    private readonly runs: MultiRepoAnalysisRunRepository,
  ) {}

  async execute(runId: string) {
    const report = await this.reports.findByRunId(runId);
    if (!report) {
      throw new AppError(
        'MERGED_MULTI_REPO_REPORT_NOT_FOUND',
        'Merged multi-repo report not found.',
      );
    }

    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    const storedChildProvenance = normalizeChildProvenance(
      (report.provenance as { childAnalyses: StoredChildProvenance[] }).childAnalyses,
    );
    const currentChildProvenance = run.analyses.map((analysis) => ({
      analysisId: analysis.id,
      latestReviewDecisionId: analysis.reviewDecisions[0]?.id ?? null,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
      isStale:
        analysis.sourceTarget.resolvedRefType !== 'COMMIT' &&
        analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha,
    }));
    const staleness = deriveMergedReportStaleness({
      storedChildProvenance,
      currentChildProvenance,
    });
    const aggregates = deriveMultiRepoRunAggregates(
      run.analyses.map((analysis) => ({
        status: analysis.status,
        latestReviewDecision: analysis.reviewDecisions[0]?.decision ?? null,
        isStale:
          analysis.sourceTarget.resolvedRefType !== 'COMMIT' &&
          analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha,
      })),
    );
    const blockedReasons = deriveMergedReportBlockedReasons(
      run.analyses.map((analysis) => ({
        status: analysis.status,
        latestReviewDecision: analysis.reviewDecisions[0]?.decision ?? null,
        isStale:
          analysis.sourceTarget.resolvedRefType !== 'COMMIT' &&
          analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha,
      })),
    );
    const mergedReportState = deriveMergedReportCapabilities({
      hasApprovedReport: true,
      isApprovedReportStale: staleness.isStale,
      canStartMergedReport: aggregates.runReadiness.canStartMergedReport,
      blockedReasons,
    });

    return {
      id: report.id,
      runId: report.runId,
      projectId: report.run.projectId,
      requirementRevisionId: report.run.requirementRevisionId,
      requirementTitle: report.run.requirementRevision.title,
      markdown: report.content,
      approvedAt: report.updatedAt.toISOString(),
      mergedReportStatus: mergedReportState.mergedReportStatus,
      capabilities: mergedReportState.capabilities,
      isStale: staleness.isStale,
      staleReason: staleness.staleReason,
      provenance: {
        childAnalyses: storedChildProvenance,
      },
    };
  }
}
