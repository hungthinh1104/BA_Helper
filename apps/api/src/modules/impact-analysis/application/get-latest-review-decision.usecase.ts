import { Injectable } from '@nestjs/common';
import { ReviewDecisionRepository } from '../infrastructure/review-decision.repository';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class GetLatestReviewDecisionUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
  ) {}

  async execute(analysisId: string) {
    const analysis = await this.impactRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    const decision = await this.decisionRepo.findLatestByAnalysisId(analysisId);
    return decision;
  }
}
