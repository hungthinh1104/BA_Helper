import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { ReviewDecisionRepository, ImpactAnalysisRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class ListReviewDecisionsUseCase {
  constructor(
    private readonly impactRepo: ImpactAnalysisRepository,
    private readonly decisionRepo: ReviewDecisionRepository,
  ) {}

  async execute(analysisId: string) {
    const analysis = await this.impactRepo.findById(analysisId);
    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    const items = await this.decisionRepo.listByAnalysisId(analysisId);
    return { items };
  }
}
