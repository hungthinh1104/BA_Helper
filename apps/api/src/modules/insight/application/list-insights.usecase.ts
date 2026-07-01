import { InsightRepository } from "@ba-helper/backend-runtime";

export class ListInsightsUseCase {
  constructor(private readonly repository: InsightRepository) {}

  async execute(impactAnalysisId: string) {
    return this.repository.listByAnalysis(impactAnalysisId);
  }
}
