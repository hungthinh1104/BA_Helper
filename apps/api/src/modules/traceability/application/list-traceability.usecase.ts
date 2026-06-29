import type { TraceabilityRepository } from '../infrastructure/traceability.repository';

export class ListTraceabilityUseCase {
  constructor(private readonly repository: TraceabilityRepository) {}

  async execute(impactAnalysisId: string) {
    return this.repository.listByAnalysis(impactAnalysisId);
  }
}
