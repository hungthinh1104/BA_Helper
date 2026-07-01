import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { MultiRepoMergedReportRepository, MergedMultiRepoReportReviewDecisionRepository } from "@ba-helper/backend-runtime";

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
