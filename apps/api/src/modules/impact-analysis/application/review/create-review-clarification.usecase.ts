import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { ReviewClarificationCreateRequest, RequestUser } from '@ba-helper/contracts';
import { ReviewClarificationRepository, ReviewDecisionRepository } from "@ba-helper/backend-runtime";

@Injectable()
export class CreateReviewClarificationRequestUseCase {
  constructor(
    private readonly clarificationRepo: ReviewClarificationRepository,
    private readonly reviewDecisionRepo: ReviewDecisionRepository,
  ) {}

  async execute(analysisId: string, payload: ReviewClarificationCreateRequest, actor: RequestUser) {
    const decision = await this.reviewDecisionRepo.findById(payload.reviewDecisionId);

    if (!decision) {
      throw new AppError('REVIEW_DECISION_NOT_FOUND', 'Review decision not found.');
    }

    if (decision.analysisId !== analysisId) {
      throw new AppError(
        'INVALID_CLARIFICATION_REQUEST',
        'Review decision does not belong to this analysis.',
      );
    }

    if (decision.decision !== 'NEEDS_MORE_CLARIFICATION') {
      throw new AppError(
        'INVALID_CLARIFICATION_REQUEST',
        'Clarifications can only be requested for decisions with NEEDS_MORE_CLARIFICATION status.',
      );
    }

    const existingOpen = await this.clarificationRepo.findOpenByReviewDecisionId(decision.id);
    if (existingOpen) {
      throw new AppError(
        'DUPLICATE_CLARIFICATION_REQUEST',
        'An open clarification request already exists for this review decision.',
      );
    }

    return this.clarificationRepo.create({
      analysisId,
      reviewDecisionId: decision.id,
      question: payload.question,
      createdByUserId: actor.id,
    });
  }
}
