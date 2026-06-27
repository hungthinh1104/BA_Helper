import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { MultiRepoAnalysisRunRepository } from '../../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from '../../infrastructure/multi-repo-merged-report.repository';
import {
  deriveMergedReportState,
  MultiRepoChildState,
} from './multi-repo-merged-report-state';

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

    const children: MultiRepoChildState[] = run.analyses.map((analysis) => ({
      analysisId: analysis.id,
      latestReviewDecisionId: analysis.reviewDecisions[0]?.id ?? null,
      latestReviewDecision: analysis.reviewDecisions[0]?.decision ?? null,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
      sourceTarget: {
        resolvedRefType: analysis.sourceTarget.resolvedRefType,
        latestObservedCommitSha: analysis.sourceTarget.latestObservedCommitSha,
      },
    }));
    const mergedReportState = deriveMergedReportState({
      children,
      approvedReportProvenance: report.provenance,
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
      isStale: mergedReportState.staleness.isStale,
      staleReason: mergedReportState.staleness.staleReason,
      provenance: {
        domainPack: readStoredDomainPackProvenance(report.provenance),
        childAnalyses: mergedReportState.storedChildProvenance,
      },
    };
  }
}

function readStoredDomainPackProvenance(provenance: unknown) {
  if (!provenance || typeof provenance !== 'object' || Array.isArray(provenance)) {
    return null;
  }

  const domainPack = (provenance as Record<string, unknown>).domainPack;
  if (!domainPack || typeof domainPack !== 'object' || Array.isArray(domainPack)) {
    return null;
  }

  const data = domainPack as Record<string, unknown>;
  if (
    typeof data.domainPackId !== 'string' ||
    typeof data.domainPackVersion !== 'string' ||
    typeof data.domainPackStatus !== 'string' ||
    typeof data.selectedBy !== 'string'
  ) {
    return null;
  }

  return {
    domainPackId: data.domainPackId,
    domainPackVersion: data.domainPackVersion,
    domainPackStatus: data.domainPackStatus,
    selectedBy: data.selectedBy,
  };
}
