import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { MultiRepoMergedReportRepository } from '../../infrastructure/multi-repo-merged-report.repository';
import { MergedMultiRepoReportReviewDecisionRepository } from '../../infrastructure/merged-multi-repo-report-review-decision.repository';

@Injectable()
export class GetLatestMergedMultiRepoReportReviewDecisionUseCase {
  constructor(
    private readonly reports: MultiRepoMergedReportRepository,
    private readonly decisions: MergedMultiRepoReportReviewDecisionRepository,
  ) {}

  async execute(runId: string) {
    const report = await this.reports.findByRunId(runId);
    if (!report) {
      throw new AppError(
        'MERGED_MULTI_REPO_REPORT_NOT_FOUND',
        'Merged multi-repo report not found.',
      );
    }

    return this.decisions.findLatestByMergedReportId(report.id);
  }
}
