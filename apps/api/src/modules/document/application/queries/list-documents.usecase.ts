import type { DocumentRepository } from '../../infrastructure/document.repository';

export class ListDocumentsUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(impactAnalysisId: string) {
    return this.repository.listByAnalysis(impactAnalysisId);
  }
}
