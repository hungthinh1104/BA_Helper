import { Injectable } from '@nestjs/common';
import { AnalysisReviewDecisionValue } from '@prisma/client';
import { AppError } from '../../../shared/app-error';
import { GetApprovedMultiRepoReportUseCase } from './get-approved-multi-repo-report.usecase';
import { MultiRepoMergedReportRepository } from '../infrastructure/multi-repo-merged-report.repository';
import { MergedMultiRepoReportReviewDecisionRepository } from '../infrastructure/merged-multi-repo-report-review-decision.repository';

@Injectable()
export class CreateMergedMultiRepoReportReviewDecisionUseCase {
  constructor(
    private readonly reports: MultiRepoMergedReportRepository,
    private readonly getApprovedReport: GetApprovedMultiRepoReportUseCase,
    private readonly decisions: MergedMultiRepoReportReviewDecisionRepository,
  ) {}

  async execute(params: {
    runId: string;
    decision: AnalysisReviewDecisionValue;
    note?: string;
    reviewedByUserId: string;
  }) {
    const approvedReport = await this.getApprovedReport.execute(params.runId);
    if (approvedReport.isStale) {
      throw new AppError(
        'MERGED_MULTI_REPO_REPORT_STALE',
        'Merged multi-repo report is stale and must be refreshed before review.',
      );
    }

    const report = await this.reports.findByRunId(params.runId);
    if (!report) {
      throw new AppError(
        'MERGED_MULTI_REPO_REPORT_NOT_FOUND',
        'Merged multi-repo report not found.',
      );
    }

    const decision = await this.decisions.create({
      mergedReportId: report.id,
      decision: params.decision,
      note: params.note,
      reviewedByUserId: params.reviewedByUserId,
    });

    return { decision };
  }
}
