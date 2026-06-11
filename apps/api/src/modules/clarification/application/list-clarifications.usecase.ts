import { Injectable } from '@nestjs/common';
import { ClarificationRepository } from '../infrastructure/clarification.repository';

@Injectable()
export class ListClarificationsUseCase {
  constructor(private readonly clarificationRepo: ClarificationRepository) {}

  async execute(analysisId: string) {
    return this.clarificationRepo.listByAnalysisId(analysisId);
  }
}
