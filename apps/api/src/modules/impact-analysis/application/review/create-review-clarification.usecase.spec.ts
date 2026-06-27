import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { CreateReviewClarificationRequestUseCase } from './create-review-clarification.usecase';
import { ReviewClarificationRepository } from '../../infrastructure/review-clarification.repository';
import { ReviewDecisionRepository } from '../../infrastructure/review-decision.repository';
import { AppError } from '@ba-helper/shared';

describe('CreateReviewClarificationRequestUseCase', () => {
  let useCase: CreateReviewClarificationRequestUseCase;
  let clarificationRepo: jest.Mocked<ReviewClarificationRepository>;
  let decisionRepo: jest.Mocked<ReviewDecisionRepository>;

  beforeEach(async () => {
    clarificationRepo = {
      findByAnalysisId: jest.fn(),
      create: jest.fn(),
    } as any;

    decisionRepo = {
      findById: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreateReviewClarificationRequestUseCase,
        { provide: ReviewClarificationRepository, useValue: clarificationRepo },
        { provide: ReviewDecisionRepository, useValue: decisionRepo },
      ],
    }).compile();

    useCase = module.get<CreateReviewClarificationRequestUseCase>(CreateReviewClarificationRequestUseCase);
  });

  it('throws REVIEW_DECISION_NOT_FOUND if decision is not found', async () => {
    decisionRepo.findById.mockResolvedValue(null);

    await expect(
      useCase.execute('ana-1', { reviewDecisionId: 'dec-1', question: 'Q?' }, { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })
    ).rejects.toThrow(new AppError('REVIEW_DECISION_NOT_FOUND', 'Review decision not found.'));
  });

  it('throws INVALID_CLARIFICATION_REQUEST if decision analysis ID does not match', async () => {
    decisionRepo.findById.mockResolvedValue({
      id: 'dec-1',
      analysisId: 'ana-2', // mismatches 'ana-1'
      decision: 'NEEDS_MORE_CLARIFICATION',
    } as any);

    await expect(
      useCase.execute('ana-1', { reviewDecisionId: 'dec-1', question: 'Q?' }, { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })
    ).rejects.toThrow(new AppError('INVALID_CLARIFICATION_REQUEST', 'Review decision does not belong to this analysis.'));
  });

  it('throws INVALID_CLARIFICATION_REQUEST if decision is not NEEDS_MORE_CLARIFICATION', async () => {
    decisionRepo.findById.mockResolvedValue({
      id: 'dec-1',
      analysisId: 'ana-1',
      decision: 'REJECTED',
    } as any);

    await expect(
      useCase.execute('ana-1', { reviewDecisionId: 'dec-1', question: 'Q?' }, { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })
    ).rejects.toThrow(new AppError('INVALID_CLARIFICATION_REQUEST', 'Clarifications can only be requested for decisions with NEEDS_MORE_CLARIFICATION status.'));
  });

  it('throws DUPLICATE_CLARIFICATION_REQUEST if there is already an OPEN request', async () => {
    decisionRepo.findById.mockResolvedValue({
      id: 'dec-1',
      analysisId: 'ana-1',
      decision: 'NEEDS_MORE_CLARIFICATION',
    } as any);

    clarificationRepo.findOpenByReviewDecisionId = jest.fn().mockResolvedValue({ status: 'OPEN', id: 'req-1' } as any);

    await expect(
      useCase.execute('ana-1', { reviewDecisionId: 'dec-1', question: 'Q?' }, { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' })
    ).rejects.toThrow(new AppError('DUPLICATE_CLARIFICATION_REQUEST', 'An open clarification request already exists for this review decision.'));
  });

  it('creates the clarification successfully', async () => {
    decisionRepo.findById.mockResolvedValue({
      id: 'dec-1',
      analysisId: 'ana-1',
      decision: 'NEEDS_MORE_CLARIFICATION',
    } as any);

    clarificationRepo.findOpenByReviewDecisionId = jest.fn().mockResolvedValue(null);
    clarificationRepo.create.mockResolvedValue({ id: 'new-1' } as any);

    const result = await useCase.execute('ana-1', { reviewDecisionId: 'dec-1', question: 'Q?' }, { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' });

    expect(result).toEqual({ id: 'new-1' });
    expect(clarificationRepo.create).toHaveBeenCalledWith({
      analysisId: 'ana-1',
      reviewDecisionId: 'dec-1',
      question: 'Q?',
      createdByUserId: 'admin-id',
    });
  });
});
