import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { MultiRepoAnalysisRunRepository } from '../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from '../infrastructure/multi-repo-merged-report.repository';

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

    const normalizeProvenance = (items: StoredChildProvenance[]) =>
      [...items].sort((left, right) => left.analysisId.localeCompare(right.analysisId));

    const storedChildProvenance = normalizeProvenance(
      (report.provenance as { childAnalyses: StoredChildProvenance[] }).childAnalyses,
    );
    const currentChildProvenance = run.analyses.map((analysis) => ({
      analysisId: analysis.id,
      latestReviewDecisionId: analysis.reviewDecisions[0]?.id ?? null,
      snapshotId: analysis.snapshot.id,
      commitSha: analysis.snapshot.commitSha,
      status: analysis.status,
    }));

    let isStale = false;
    let staleReason: string | undefined;

    if (storedChildProvenance.length !== currentChildProvenance.length) {
      isStale = true;
      staleReason = 'Child analysis set changed after the approved merged report snapshot was generated.';
    } else {
      const storedByAnalysisId = new Map(
        storedChildProvenance.map((item) => [item.analysisId, item]),
      );

      for (const current of currentChildProvenance) {
        const stored = storedByAnalysisId.get(current.analysisId);
        if (!stored) {
          isStale = true;
          staleReason = 'Child analysis set changed after the approved merged report snapshot was generated.';
          break;
        }
        if (current.status !== 'COMPLETED') {
          isStale = true;
          staleReason = 'A child analysis is no longer completed.';
          break;
        }
        if (current.latestReviewDecisionId !== stored.latestReviewDecisionId) {
          isStale = true;
          staleReason = 'Child review decisions changed after the approved merged report snapshot was generated.';
          break;
        }
        if (
          current.snapshotId !== stored.snapshotId ||
          current.commitSha !== stored.commitSha
        ) {
          isStale = true;
          staleReason = 'Child snapshot provenance changed after the approved merged report snapshot was generated.';
          break;
        }
      }
    }

    return {
      id: report.id,
      runId: report.runId,
      projectId: report.run.projectId,
      requirementRevisionId: report.run.requirementRevisionId,
      requirementTitle: report.run.requirementRevision.title,
      markdown: report.content,
      approvedAt: report.updatedAt.toISOString(),
      isStale,
      staleReason,
      provenance: {
        childAnalyses: storedChildProvenance,
      },
    };
  }
}
