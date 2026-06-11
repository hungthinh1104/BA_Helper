import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { GetMergedMultiRepoReportDraftUseCase } from './get-merged-multi-repo-report-draft.usecase';
import { MultiRepoAnalysisRunRepository } from '../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from '../infrastructure/multi-repo-merged-report.repository';
import { GetApprovedMultiRepoReportUseCase } from './get-approved-multi-repo-report.usecase';

@Injectable()
export class FinalizeMultiRepoReportUseCase {
  constructor(
    private readonly runs: MultiRepoAnalysisRunRepository,
    private readonly draft: GetMergedMultiRepoReportDraftUseCase,
    private readonly reports: MultiRepoMergedReportRepository,
    private readonly getApproved: GetApprovedMultiRepoReportUseCase,
  ) {}

  async execute(runId: string) {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    const currentProvenance = run.analyses.map((analysis) => {
      const latestDecision = analysis.reviewDecisions[0];
      if (!latestDecision) {
        throw new AppError(
          'MULTI_REPO_RUN_NOT_READY',
          'Multi-repo analysis run is not ready for a merged report.',
        );
      }

      return {
        analysisId: analysis.id,
        latestReviewDecisionId: latestDecision.id,
        snapshotId: analysis.snapshot.id,
        commitSha: analysis.snapshot.commitSha,
      };
    });
    const normalizeProvenance = (
      items: Array<{
        analysisId: string;
        latestReviewDecisionId: string;
        snapshotId: string;
        commitSha: string;
      }>,
    ) => [...items].sort((left, right) => left.analysisId.localeCompare(right.analysisId));

    try {
      const existingApproved = await this.getApproved.execute(runId);
      if (!existingApproved.isStale) {
        return existingApproved;
      }
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'MERGED_MULTI_REPO_REPORT_NOT_FOUND') {
        throw error;
      }
    }

    const draft = await this.draft.execute(runId);
    const report = await this.reports.upsertApproved({
      runId,
      content: draft.markdown,
      provenance: {
        childAnalyses: normalizeProvenance(currentProvenance),
      },
    });

    return {
      id: report.id,
      runId: report.runId,
      projectId: report.run.projectId,
      requirementRevisionId: report.run.requirementRevisionId,
      requirementTitle: report.run.requirementRevision.title,
      markdown: report.content,
      approvedAt: report.updatedAt.toISOString(),
      isStale: false,
      provenance: {
        childAnalyses: currentProvenance,
      },
    };
  }
}
