import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { MultiRepoMergedReportRepository } from '../infrastructure/multi-repo-merged-report.repository';
import { MergedMultiRepoReportReviewDecisionRepository } from '../infrastructure/merged-multi-repo-report-review-decision.repository';

@Injectable()
export class ListMergedMultiRepoReportReviewDecisionsUseCase {
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

    const items = await this.decisions.listByMergedReportId(report.id);
    return { items };
  }
}
