import { Injectable } from '@nestjs/common';
import { ClarificationRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class ListClarificationsUseCase {
  constructor(private readonly clarificationRepo: ClarificationRepository) {}

  async execute(analysisId: string) {
    return this.clarificationRepo.listByAnalysisId(analysisId);
  }
}
