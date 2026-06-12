import { Injectable } from '@nestjs/common';
import { ReviewClarificationRepository } from '../../infrastructure/review-clarification.repository';
import { AppError } from '../../../../shared/app-error';
import { RequestUser } from '@ba-helper/contracts';

@Injectable()
export class AnswerReviewClarificationUseCase {
  constructor(private readonly clarificationRepo: ReviewClarificationRepository) {}

  async execute(clarificationId: string, answer: string, actor: RequestUser) {
    const clarification = await this.clarificationRepo.findById(clarificationId);

    if (!clarification) {
      throw new AppError('CLARIFICATION_NOT_FOUND', 'Clarification request not found.');
    }

    if (clarification.status === 'ANSWERED') {
      throw new AppError(
        'CLARIFICATION_ALREADY_ANSWERED',
        'This clarification request has already been answered.',
      );
    }

    if (clarification.status === 'CANCELLED') {
      throw new AppError(
        'CLARIFICATION_CANCELLED',
        'Cannot answer a cancelled clarification request.',
      );
    }

    return this.clarificationRepo.answer(clarificationId, answer, actor.id);
  }
}
