import { DocumentRepository } from "@ba-helper/backend-runtime";

export class ListDocumentsUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(impactAnalysisId: string) {
    return this.repository.listByAnalysis(impactAnalysisId);
  }
}
