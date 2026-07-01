import { EnsureClarificationUseCase } from './ensure-clarification.usecase';
import { AnswerClarificationUseCase } from './answer-clarification.usecase';
import { DismissClarificationUseCase } from './dismiss-clarification.usecase';
import { ConvertClarificationToRevisionUseCase } from './convert-clarification-to-revision.usecase';
import type { RequirementRepository } from '../../requirement/infrastructure/requirement.repository';
import { AppError } from '@ba-helper/shared';
import { InsightRepository, ImpactAnalysisRepository, ClarificationRepository } from "@ba-helper/backend-runtime";

describe('Clarification Use Cases', () => {
  let clarificationRepo: jest.Mocked<ClarificationRepository>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let requirementRepo: jest.Mocked<RequirementRepository>;

  let ensureUseCase: EnsureClarificationUseCase;
  let answerUseCase: AnswerClarificationUseCase;
  let dismissUseCase: DismissClarificationUseCase;
  let convertUseCase: ConvertClarificationToRevisionUseCase;

  beforeEach(() => {
    clarificationRepo = {
      findById: jest.fn(),
      findBySourceInsightId: jest.fn(),
      listByAnalysisId: jest.fn(),
      create: jest.fn(),
      updateStatusAndAnswer: jest.fn(),
      markAsConverted: jest.fn(),
    } as unknown as jest.Mocked<ClarificationRepository>;

    insightRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<InsightRepository>;

    impactRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    requirementRepo = {
      findRevisionById: jest.fn(),
      createRevisionWithReadinessTransition: jest.fn(),
    } as unknown as jest.Mocked<RequirementRepository>;

    ensureUseCase = new EnsureClarificationUseCase(clarificationRepo, insightRepo, impactRepo);
    answerUseCase = new AnswerClarificationUseCase(clarificationRepo, impactRepo);
    dismissUseCase = new DismissClarificationUseCase(clarificationRepo, impactRepo);
    convertUseCase = new ConvertClarificationToRevisionUseCase(clarificationRepo, impactRepo, requirementRepo);
  });

  const mockAnalysis = { id: 'analysis-1', status: 'WAITING_FOR_REVIEW' };
  const mockUnknownInsight = { id: 'insight-1', impactAnalysisId: 'analysis-1', insightType: 'UNKNOWN', title: 'Q?', description: 'A' };
  const mockClaimInsight = { id: 'insight-2', impactAnalysisId: 'analysis-1', insightType: 'CLAIM' };

  describe('EnsureClarificationUseCase', () => {
    it('creates clarification for UNKNOWN insight', async () => {
      insightRepo.findById.mockResolvedValue(mockUnknownInsight as any);
      impactRepo.findById.mockResolvedValue(mockAnalysis as any);
      clarificationRepo.findBySourceInsightId.mockResolvedValue(null);
      clarificationRepo.create.mockResolvedValue({ id: 'clar-1' } as any);

      const result = await ensureUseCase.execute('analysis-1', 'insight-1');
      expect(result.id).toBe('clar-1');
      expect(clarificationRepo.create).toHaveBeenCalled();
    });

    it('rejects if insight is not UNKNOWN or QUESTION', async () => {
      insightRepo.findById.mockResolvedValue(mockClaimInsight as any);
      await expect(ensureUseCase.execute('analysis-1', 'insight-2'))
        .rejects.toMatchObject({ code: 'INVALID_CLARIFICATION_SOURCE' });
    });

    it('rejects if analysis is COMPLETED', async () => {
      insightRepo.findById.mockResolvedValue(mockUnknownInsight as any);
      impactRepo.findById.mockResolvedValue({ ...mockAnalysis, status: 'COMPLETED' } as any);
      await expect(ensureUseCase.execute('analysis-1', 'insight-1'))
        .rejects.toMatchObject({ code: 'ANALYSIS_ALREADY_COMPLETED' });
    });

    it('returns existing clarification idempotently', async () => {
      insightRepo.findById.mockResolvedValue(mockUnknownInsight as any);
      impactRepo.findById.mockResolvedValue(mockAnalysis as any);
      clarificationRepo.findBySourceInsightId.mockResolvedValue({ id: 'existing' } as any);

      const result = await ensureUseCase.execute('analysis-1', 'insight-1');
      expect(result.id).toBe('existing');
      expect(clarificationRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('AnswerClarificationUseCase', () => {
    it('answers OPEN clarification', async () => {
      clarificationRepo.findById.mockResolvedValue({ id: 'clar-1', status: 'OPEN', impactAnalysisId: 'analysis-1' } as any);
      impactRepo.findById.mockResolvedValue(mockAnalysis as any);
      clarificationRepo.updateStatusAndAnswer.mockResolvedValue({ id: 'clar-1', status: 'ANSWERED' } as any);

      const result = await answerUseCase.execute('clar-1', 'My answer');
      expect(result.status).toBe('ANSWERED');
      expect(clarificationRepo.updateStatusAndAnswer).toHaveBeenCalledWith('clar-1', 'ANSWERED', 'My answer');
    });

    it('rejects if clarification is DISMISSED', async () => {
      clarificationRepo.findById.mockResolvedValue({ id: 'clar-1', status: 'DISMISSED', impactAnalysisId: 'analysis-1' } as any);
      await expect(answerUseCase.execute('clar-1', 'My answer'))
        .rejects.toMatchObject({ code: 'INVALID_CLARIFICATION_STATE' });
    });
  });

  describe('DismissClarificationUseCase', () => {
    it('dismisses OPEN clarification', async () => {
      clarificationRepo.findById.mockResolvedValue({ id: 'clar-1', status: 'OPEN', impactAnalysisId: 'analysis-1' } as any);
      impactRepo.findById.mockResolvedValue(mockAnalysis as any);
      clarificationRepo.updateStatusAndAnswer.mockResolvedValue({ id: 'clar-1', status: 'DISMISSED' } as any);

      const result = await dismissUseCase.execute('clar-1', 'Not needed');
      expect(result.status).toBe('DISMISSED');
      expect(clarificationRepo.updateStatusAndAnswer).toHaveBeenCalledWith('clar-1', 'DISMISSED', null, 'Not needed');
    });

    it('rejects if analysis is COMPLETED', async () => {
      clarificationRepo.findById.mockResolvedValue({ id: 'clar-1', status: 'OPEN', impactAnalysisId: 'analysis-1' } as any);
      impactRepo.findById.mockResolvedValue({ ...mockAnalysis, status: 'COMPLETED' } as any);
      await expect(dismissUseCase.execute('clar-1'))
        .rejects.toMatchObject({ code: 'ANALYSIS_ALREADY_COMPLETED' });
    });
  });

  describe('ConvertClarificationToRevisionUseCase', () => {
    it('returns existing revision if already converted (idempotent)', async () => {
      clarificationRepo.findById.mockResolvedValue({ 
        id: 'clar-1', 
        status: 'CONVERTED_TO_REVISION', 
        convertedRequirementRevisionId: 'rev-existing' 
      } as any);

      const result = await convertUseCase.execute('clar-1');
      expect(result.revisionId).toBe('rev-existing');
      expect(requirementRepo.createRevisionWithReadinessTransition).not.toHaveBeenCalled();
    });

    it('rejects if clarification is not ANSWERED', async () => {
      clarificationRepo.findById.mockResolvedValue({ id: 'clar-1', status: 'OPEN' } as any);
      await expect(convertUseCase.execute('clar-1'))
        .rejects.toMatchObject({ code: 'INVALID_CLARIFICATION_STATE' });
    });

    it('creates new revision and marks converted', async () => {
      clarificationRepo.findById.mockResolvedValue({ 
        id: 'clar-1', 
        status: 'ANSWERED', 
        question: 'Q', 
        answer: 'A',
        impactAnalysisId: 'analysis-1' 
      } as any);
      impactRepo.findById.mockResolvedValue({ id: 'analysis-1', requirementRevisionId: 'rev-1' } as any);
      requirementRepo.findRevisionById.mockResolvedValue({ 
        id: 'rev-1', 
        requirementId: 'req-1',
        title: 'Title',
        rawText: 'Old text'
      } as any);
      requirementRepo.createRevisionWithReadinessTransition.mockResolvedValue({ id: 'rev-new', requirementId: 'req-1' } as any);

      const result = await convertUseCase.execute('clar-1');
      
      expect(result.revisionId).toBe('rev-new');
      expect(requirementRepo.createRevisionWithReadinessTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          requirementId: 'req-1',
          rawText: expect.stringContaining('Question: Q'),
        })
      );
      expect(clarificationRepo.markAsConverted).toHaveBeenCalledWith('clar-1', 'rev-new');
    });
  });
});
