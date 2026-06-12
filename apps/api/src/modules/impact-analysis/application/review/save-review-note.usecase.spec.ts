import { SaveReviewNoteUseCase } from './save-review-note.usecase';
import { ReviewNoteRepository } from '../../infrastructure/review-note.repository';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { AppError } from '../../../../shared/app-error';

describe('SaveReviewNoteUseCase', () => {
  let useCase: SaveReviewNoteUseCase;
  let reviewNoteRepo: jest.Mocked<ReviewNoteRepository>;
  let impactAnalysisRepo: jest.Mocked<ImpactAnalysisRepository>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;

  const analysisId = 'analysis-1';

  beforeEach(() => {
    reviewNoteRepo = { upsert: jest.fn(), findByAnalysisId: jest.fn() } as any;
    impactAnalysisRepo = { findById: jest.fn() } as any;
    insightRepo = { findById: jest.fn() } as any;
    traceabilityRepo = { findById: jest.fn() } as any;

    useCase = new SaveReviewNoteUseCase(
      reviewNoteRepo,
      impactAnalysisRepo,
      insightRepo,
      traceabilityRepo,
    );
  });

  it('rejects if both insightId and traceabilityLinkId are provided', async () => {
    impactAnalysisRepo.findById.mockResolvedValue({ status: 'WAITING_FOR_REVIEW' } as any);
    await expect(
      useCase.execute(analysisId, {
        insightId: 'i1',
        traceabilityLinkId: 't1',
        body: 'test',
      }),
    ).rejects.toThrow(AppError);
  });

  it('rejects if neither insightId nor traceabilityLinkId is provided', async () => {
    impactAnalysisRepo.findById.mockResolvedValue({ status: 'WAITING_FOR_REVIEW' } as any);
    await expect(
      useCase.execute(analysisId, { body: 'test' }),
    ).rejects.toThrow(AppError);
  });

  it('rejects if analysis is COMPLETED', async () => {
    impactAnalysisRepo.findById.mockResolvedValue({ status: 'COMPLETED' } as any);
    await expect(
      useCase.execute(analysisId, { insightId: 'i1', body: 'test' }),
    ).rejects.toThrow(AppError);
  });

  it('rejects if insight belongs to a different analysis', async () => {
    impactAnalysisRepo.findById.mockResolvedValue({ status: 'WAITING_FOR_REVIEW' } as any);
    insightRepo.findById.mockResolvedValue({ impactAnalysisId: 'analysis-2' } as any);
    
    await expect(
      useCase.execute(analysisId, { insightId: 'i1', body: 'test' }),
    ).rejects.toThrow('Insight does not belong to this analysis');
  });

  it('upserts successfully when valid', async () => {
    impactAnalysisRepo.findById.mockResolvedValue({ status: 'WAITING_FOR_REVIEW' } as any);
    insightRepo.findById.mockResolvedValue({ impactAnalysisId: analysisId } as any);
    reviewNoteRepo.upsert.mockResolvedValue({ id: 'note1' } as any);

    const res = await useCase.execute(analysisId, { insightId: 'i1', body: 'test' });
    expect(res.id).toBe('note1');
    expect(reviewNoteRepo.upsert).toHaveBeenCalledWith({
      impactAnalysisId: analysisId,
      insightId: 'i1',
      traceabilityLinkId: undefined,
      body: 'test',
    });
  });
});
