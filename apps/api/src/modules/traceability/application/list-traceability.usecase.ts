import { TraceabilityRepository } from "@ba-helper/backend-runtime";

export class ListTraceabilityUseCase {
  constructor(private readonly repository: TraceabilityRepository) {}

  async execute(impactAnalysisId: string) {
    return this.repository.listByAnalysis(impactAnalysisId);
  }
}
