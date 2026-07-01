import { Injectable } from "@nestjs/common";
import { AppError } from '@ba-helper/shared';
import { ImpactAnalysisRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class GetImpactAnalysisUseCase {
  constructor(private readonly repository: ImpactAnalysisRepository) {}

  async execute(id: string) {
    const analysis = await this.repository.findById(id);
    if (!analysis) {
      throw new AppError(
        'IMPACT_ANALYSIS_NOT_FOUND',
        'Impact analysis not found.',
      );
    }

    return analysis;
  }
}
