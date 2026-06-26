import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { GetMergedMultiRepoReportDraftUseCase } from './get-merged-multi-repo-report-draft.usecase';
import { MultiRepoAnalysisRunRepository } from '../../infrastructure/multi-repo-analysis-run.repository';
import { MultiRepoMergedReportRepository } from '../../infrastructure/multi-repo-merged-report.repository';
import { GetApprovedMultiRepoReportUseCase } from './get-approved-multi-repo-report.usecase';
import { RequestUser } from '@ba-helper/contracts';
import { deriveMultiRepoRunAggregates } from './multi-repo-run-readiness';
import { normalizeChildProvenance } from './multi-repo-merged-report-state';

@Injectable()
export class FinalizeMultiRepoReportUseCase {
  constructor(
    private readonly runs: MultiRepoAnalysisRunRepository,
    private readonly draft: GetMergedMultiRepoReportDraftUseCase,
    private readonly reports: MultiRepoMergedReportRepository,
    private readonly getApproved: GetApprovedMultiRepoReportUseCase,
  ) {}

  async execute(runId: string, actor: RequestUser) {
    const run = await this.runs.findById(runId);
    if (!run) {
      throw new AppError(
        'MULTI_REPO_ANALYSIS_RUN_NOT_FOUND',
        'Multi-repo analysis run not found.',
      );
    }

    const aggregates = deriveMultiRepoRunAggregates(
      run.analyses.map((analysis) => ({
        status: analysis.status,
        latestReviewDecision: analysis.reviewDecisions[0]?.decision ?? null,
        isStale:
          analysis.sourceTarget.resolvedRefType !== 'COMMIT' &&
          analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha,
      })),
    );

    if (!aggregates.runReadiness.canStartMergedReport) {
      throw new AppError(
        'MULTI_REPO_RUN_NOT_READY',
        'Multi-repo analysis run is not ready for a merged report.',
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

    const draft = await this.draft.execute(runId, actor);
    await this.reports.upsertApproved({
      runId,
      content: draft.markdown,
      provenance: {
        childAnalyses: normalizeChildProvenance(currentProvenance),
      },
    });

    return this.getApproved.execute(runId);
  }
}
