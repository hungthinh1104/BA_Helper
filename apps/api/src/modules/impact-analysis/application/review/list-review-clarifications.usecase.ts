import { Injectable } from '@nestjs/common';
import { ReviewClarificationRepository } from '../../infrastructure/review-clarification.repository';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { AppError } from '../../../../shared/app-error';

@Injectable()
export class ListReviewClarificationsUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly clarificationRepo: ReviewClarificationRepository,
  ) {}

  async execute(analysisId: string) {
    const analysis = await this.impactRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    const items = await this.clarificationRepo.listByAnalysisId(analysisId);
    return { items };
  }
}
