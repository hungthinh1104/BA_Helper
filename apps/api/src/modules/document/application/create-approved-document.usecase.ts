import { DocumentRepository } from '../infrastructure/document.repository';

export class CreateApprovedDocumentUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(params: { impactAnalysisId: string; content: string }) {
    return this.repository.upsertApproved(params);
  }
}
