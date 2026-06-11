import { CreateAnalysisReviewDecisionUseCase } from './create-analysis-review-decision.usecase';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { ReviewDecisionRepository } from '../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from './get-impact-diff.usecase';
import { DocumentRepository } from '../../document/infrastructure/document.repository';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { ReviewNoteRepository } from '../infrastructure/review-note.repository';
import { ClarificationRepository } from '../../clarification/infrastructure/clarification.repository';
import { MarkdownImpactReportBuilder } from '../../document/application/markdown-impact-report.builder';
import { AppError } from '../../../shared/app-error';

describe('CreateAnalysisReviewDecisionUseCase', () => {
  let useCase: CreateAnalysisReviewDecisionUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let decisionRepo: jest.Mocked<ReviewDecisionRepository>;
  let getDiffUseCase: jest.Mocked<GetImpactDiffUseCase>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;
  let graphRepo: jest.Mocked<GraphRepository>;
  let reviewNoteRepo: jest.Mocked<ReviewNoteRepository>;
  let clarificationRepo: jest.Mocked<ClarificationRepository>;
  let documentRepo: jest.Mocked<DocumentRepository>;
  let reportBuilder: jest.Mocked<MarkdownImpactReportBuilder>;

  beforeEach(() => {
    impactRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    decisionRepo = {
      create: jest.fn(),
      listByAnalysisId: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReviewDecisionRepository>;

    getDiffUseCase = {
      computeForAnalysis: jest.fn(),
    } as unknown as jest.Mocked<GetImpactDiffUseCase>;

    insightRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<InsightRepository>;

    traceabilityRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<TraceabilityRepository>;

    graphRepo = {
      listBySnapshot: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GraphRepository>;

    reviewNoteRepo = {
      findByAnalysisId: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReviewNoteRepository>;

    clarificationRepo = {
      listByAnalysisId: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ClarificationRepository>;

    documentRepo = {
      upsertApproved: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;

    reportBuilder = {
      build: jest.fn().mockReturnValue('mock markdown report'),
    } as unknown as jest.Mocked<MarkdownImpactReportBuilder>;

    useCase = new CreateAnalysisReviewDecisionUseCase(
      impactRepo,
      decisionRepo,
      getDiffUseCase,
      insightRepo,
      traceabilityRepo,
      graphRepo,
      reviewNoteRepo,
      clarificationRepo,
      documentRepo,
      reportBuilder,
    );
  });

  const validParams = {
    analysisId: 'analysis-1',
    decision: 'ACCEPTED' as const,
    note: 'Looks good',
    actor: { id: 'admin-id', email: 'admin@example.com', role: 'ADMIN' as const },
  };

  it('should throw if analysis does not exist', async () => {
    impactRepo.findById.mockResolvedValue(null);

    await expect(useCase.execute(validParams)).rejects.toThrow(AppError);
    expect(impactRepo.findById).toHaveBeenCalledWith('analysis-1');
  });

  it('should throw if analysis is not COMPLETED', async () => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'WAITING_FOR_REVIEW',
    } as any);

    await expect(useCase.execute(validParams)).rejects.toThrow(
      expect.objectContaining({ code: 'INVALID_ANALYSIS_STATUS' })
    );
  });

  it('should allow reviewing a baseline analysis (no derivedFromAnalysisId) without diff computability check', async () => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'COMPLETED',
      derivedFromAnalysisId: null,
      snapshot: { id: 'snap-1' },
    } as any);

    decisionRepo.create.mockResolvedValue({
      id: 'decision-1',
      analysisId: 'analysis-1',
      decision: 'ACCEPTED',
      note: 'Looks good',
      reviewedBy: 'admin',
      createdAt: new Date(),
    } as any);

    const result = await useCase.execute(validParams);

    expect(result.decision.id).toBe('decision-1');
    expect(getDiffUseCase.computeForAnalysis).not.toHaveBeenCalled();
    expect(documentRepo.upsertApproved).toHaveBeenCalled();
  });

  it('should check computability and accept derived analysis if diff is computable', async () => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'COMPLETED',
      derivedFromAnalysisId: 'baseline-1',
      snapshot: { id: 'snap-1' },
    } as any);

    getDiffUseCase.computeForAnalysis.mockResolvedValue({
      computable: true,
      diff: { baseAnalysisId: 'baseline-1', currentAnalysisId: 'analysis-1' } as any,
    });

    decisionRepo.create.mockResolvedValue({
      id: 'decision-1',
      analysisId: 'analysis-1',
      decision: 'ACCEPTED',
      note: 'Looks good',
      reviewedBy: 'admin',
      createdAt: new Date(),
    } as any);

    const result = await useCase.execute(validParams);

    expect(result.decision.id).toBe('decision-1');
    expect(getDiffUseCase.computeForAnalysis).toHaveBeenCalledWith('analysis-1');
    expect(result.reportRegenerated).toBe(true);
  });

  it('should throw if derived analysis is ACCEPTED and diff is not computable', async () => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'COMPLETED',
      derivedFromAnalysisId: 'baseline-1',
      snapshot: { id: 'snap-1' },
    } as any);

    getDiffUseCase.computeForAnalysis.mockResolvedValue({
      computable: false,
      reason: 'BASELINE_NOT_COMPLETED',
    });

    await expect(useCase.execute(validParams)).rejects.toThrow(
      expect.objectContaining({ code: 'BASELINE_NOT_COMPLETED' })
    );
    expect(decisionRepo.create).not.toHaveBeenCalled();
  });

  it('should allow REJECTED or NEEDS_MORE_CLARIFICATION decisions even if diff is not computable', async () => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'COMPLETED',
      derivedFromAnalysisId: 'baseline-1',
      snapshot: { id: 'snap-1' },
    } as any);

    getDiffUseCase.computeForAnalysis.mockResolvedValue({
      computable: false,
      reason: 'BASELINE_NOT_COMPLETED',
    });

    decisionRepo.create.mockResolvedValue({
      id: 'decision-1',
      analysisId: 'analysis-1',
      decision: 'REJECTED',
      note: 'No way',
      reviewedBy: 'admin',
      createdAt: new Date(),
    } as any);

    const result = await useCase.execute({
      ...validParams,
      decision: 'REJECTED',
      note: 'No way',
    });

    expect(result.decision.id).toBe('decision-1');
    expect(result.reportRegenerated).toBe(true); // report is regenerated (without diff because computable: false)
  });

  it('should continue and save decision even if report regeneration fails', async () => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'COMPLETED',
      derivedFromAnalysisId: null,
      snapshot: { id: 'snap-1' },
    } as any);

    decisionRepo.create.mockResolvedValue({
      id: 'decision-1',
      analysisId: 'analysis-1',
      decision: 'ACCEPTED',
      note: 'Good',
      reviewedBy: 'admin',
      createdAt: new Date(),
    } as any);

    documentRepo.upsertApproved.mockRejectedValue(new Error('DB failure during report saving'));

    const result = await useCase.execute(validParams);

    expect(result.decision.id).toBe('decision-1');
    expect(result.reportRegenerated).toBe(false);
    expect(result.reportRegenerationError).toBe('DB failure during report saving');
  });
});
