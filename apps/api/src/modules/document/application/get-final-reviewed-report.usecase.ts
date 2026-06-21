import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { GetReviewCompletionUseCase } from '../../traceability/application/get-review-completion.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './get-latest-reviewed-report-snapshot.usecase';
import { FinalReviewedReportResponse } from '@ba-helper/contracts';

@Injectable()
export class GetFinalReviewedReportUseCase {
  constructor(
    private readonly getReviewCompletion: GetReviewCompletionUseCase,
    private readonly getLatestSnapshot: GetLatestReviewedReportSnapshotUseCase,
  ) {}

  async execute(analysisId: string): Promise<FinalReviewedReportResponse> {
    const completion = await this.getReviewCompletion.execute(analysisId);

    if (!completion.isComplete) {
      throw new AppError(
        'REVIEW_COMPLETION_REQUIRED' as any,
        'Impact analysis review is not complete',
        { blockingReasons: completion.blockingReasons },
      );
    }

    const snapshot = await this.getLatestSnapshot.execute(analysisId);

    if (!snapshot) {
      throw new AppError(
        'REVIEWED_SNAPSHOT_MISSING' as any,
        'Reviewed report snapshot is missing despite review completion indicating otherwise',
      );
    }

    return {
      analysisId,
      snapshotId: snapshot.id,
      markdown: snapshot.markdown,
      createdAt: snapshot.createdAt.toISOString(),
      reviewCompletion: completion,
      reviewDecisionsSnapshot: snapshot.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: snapshot.evidenceQualitySummarySnapshot,
      evaluationContextSnapshot: snapshot.evaluationContextSnapshot,
      createdByUserId: snapshot.createdByUserId,
    };
  }
}
