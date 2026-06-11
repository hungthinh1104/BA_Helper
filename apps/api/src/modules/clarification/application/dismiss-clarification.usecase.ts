import { Injectable } from '@nestjs/common';
import { ClarificationRepository } from '../infrastructure/clarification.repository';
import { ImpactAnalysisRepository } from '../../impact-analysis/infrastructure/impact-analysis.repository';
import { AppError } from '../../../shared/app-error';

@Injectable()
export class DismissClarificationUseCase {
  constructor(
    private readonly clarificationRepo: ClarificationRepository,
    private readonly impactRepo: ImpactAnalysisRepository,
  ) {}

  async execute(id: string, reason?: string) {
    const clarification = await this.clarificationRepo.findById(id);
    if (!clarification) {
      throw new AppError('CLARIFICATION_NOT_FOUND', 'Clarification item not found');
    }

    if (clarification.status !== 'OPEN') {
      throw new AppError(
        'INVALID_CLARIFICATION_STATE',
        'Can only dismiss OPEN clarifications',
      );
    }

    const analysis = await this.impactRepo.findById(clarification.impactAnalysisId);
    if (!analysis) {
      throw new AppError('ANALYSIS_NOT_FOUND', 'Analysis not found');
    }
    if (analysis.status === 'COMPLETED') {
      throw new AppError(
        'ANALYSIS_ALREADY_COMPLETED',
        'Cannot dismiss clarification for a completed analysis',
      );
    }

    return this.clarificationRepo.updateStatusAndAnswer(id, 'DISMISSED', null, reason || null);
  }
}
