import { InsightRepository } from '../infrastructure/insight.repository';

export class ListInsightsUseCase {
  constructor(private readonly repository: InsightRepository) {}

  async execute(impactAnalysisId: string) {
    return this.repository.listByAnalysis(impactAnalysisId);
  }
}
