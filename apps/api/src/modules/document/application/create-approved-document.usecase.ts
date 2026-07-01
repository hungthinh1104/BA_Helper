import { DocumentRepository } from "@ba-helper/backend-runtime";

export class CreateApprovedDocumentUseCase {
  constructor(private readonly repository: DocumentRepository) {}

  async execute(params: { impactAnalysisId: string; content: string }) {
    return this.repository.upsertApproved(params);
  }
}
