import { Test, TestingModule } from '@nestjs/testing';
import { GetImpactAnalysisLineageUseCase } from './get-impact-analysis-lineage.usecase';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../shared/app-error';

describe('GetImpactAnalysisLineageUseCase', () => {
  let useCase: GetImpactAnalysisLineageUseCase;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    prisma = {
      impactAnalysis: {
        findUnique: jest.fn(),
      },
      requirementRevision: {
        findMany: jest.fn(),
      },
      analysisReviewDecision: {
        findMany: jest.fn(),
      },
      reviewClarificationRequest: {
        findMany: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetImpactAnalysisLineageUseCase,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    useCase = module.get<GetImpactAnalysisLineageUseCase>(GetImpactAnalysisLineageUseCase);
  });

  it('throws ANALYSIS_NOT_FOUND if current analysis does not exist', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(useCase.execute('non-existent')).rejects.toThrow(
      new AppError('ANALYSIS_NOT_FOUND', 'Analysis not found')
    );
  });

  it('detects and prevents infinite lineage cycles', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock)
      .mockResolvedValueOnce({ id: 'ana-1', derivedFromAnalysisId: 'ana-2' })
      .mockResolvedValueOnce({ id: 'ana-2', derivedFromAnalysisId: 'ana-1' });

    await expect(useCase.execute('ana-1')).rejects.toThrow(
      new AppError('LINEAGE_CYCLE_DETECTED', 'Circular reference detected in analysis lineage')
    );
  });

  it('builds lineage for a single root analysis', async () => {
    (prisma.impactAnalysis.findUnique as jest.Mock).mockResolvedValue({
      id: 'root-1',
      derivedFromAnalysisId: null,
      status: 'COMPLETED',
      createdAt: new Date('2026-06-05T00:00:00Z'),
      updatedAt: new Date('2026-06-05T00:10:00Z'),
      requirementRevisionId: 'rev-1',
    });

    (prisma.requirementRevision.findMany as jest.Mock).mockResolvedValue([
      { id: 'rev-1', title: 'Rev 1', createdAt: new Date('2026-06-04T00:00:00Z') },
    ]);

    (prisma.analysisReviewDecision.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.reviewClarificationRequest.findMany as jest.Mock).mockResolvedValue([]);

    const result = await useCase.execute('root-1');

    expect(result.depth).toBe(0);
    expect(result.rootAnalysisId).toBe('root-1');
    expect(result.currentAnalysisId).toBe('root-1');
    expect(result.events.length).toBe(3); // REQ_CREATED, ANA_CREATED, ANA_COMPLETED
    expect(result.events[0].type).toBe('REQUIREMENT_CREATED');
    expect(result.events[1].type).toBe('ANALYSIS_CREATED');
    expect(result.events[2].type).toBe('ANALYSIS_COMPLETED');
  });

  it('builds lineage for a derived chain correctly', async () => {
    // current
    (prisma.impactAnalysis.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'derived-1',
        derivedFromAnalysisId: 'root-1',
        status: 'WAITING_FOR_REVIEW',
        createdAt: new Date('2026-06-05T01:00:00Z'),
        updatedAt: new Date('2026-06-05T01:10:00Z'),
        requirementRevisionId: 'rev-2',
      })
      // root
      .mockResolvedValueOnce({
        id: 'root-1',
        derivedFromAnalysisId: null,
        status: 'COMPLETED',
        createdAt: new Date('2026-06-05T00:00:00Z'),
        updatedAt: new Date('2026-06-05T00:10:00Z'),
        requirementRevisionId: 'rev-1',
      });

    (prisma.requirementRevision.findMany as jest.Mock).mockResolvedValue([
      { id: 'rev-1', title: 'Rev 1', createdAt: new Date('2026-06-04T00:00:00Z') },
      { id: 'rev-2', title: 'Rev 2', createdAt: new Date('2026-06-05T00:30:00Z') },
    ]);

    (prisma.analysisReviewDecision.findMany as jest.Mock).mockResolvedValue([
      { id: 'dec-1', analysisId: 'root-1', decision: 'NEEDS_MORE_CLARIFICATION', createdAt: new Date('2026-06-05T00:15:00Z') },
    ]);

    (prisma.reviewClarificationRequest.findMany as jest.Mock).mockResolvedValue([
      { id: 'clar-1', reviewDecisionId: 'dec-1', status: 'ANSWERED', createdAt: new Date('2026-06-05T00:16:00Z'), answeredAt: new Date('2026-06-05T00:20:00Z') },
    ]);

    const result = await useCase.execute('derived-1');

    expect(result.depth).toBe(1);
    expect(result.rootAnalysisId).toBe('root-1');
    expect(result.events.length).toBe(10);
    // Sequence roughly:
    // root REQ_CREATED
    // root ANA_CREATED
    // root ANA_COMPLETED
    // root REVIEW_DECISION
    // root CLARIFICATION_REQUESTED
    // root CLARIFICATION_ANSWERED
    // derived REQ_REVISED
    // derived DERIVED_ANA_CREATED
    // derived ANA_COMPLETED
    // derived IMPACT_DIFF_AVAILABLE
    
    const types = result.events.map(e => e.type);
    expect(types).toContain('REQUIREMENT_CREATED');
    expect(types).toContain('ANALYSIS_CREATED');
    expect(types).toContain('REVIEW_DECISION');
    expect(types).toContain('CLARIFICATION_REQUESTED');
    expect(types).toContain('CLARIFICATION_ANSWERED');
    expect(types).toContain('REQUIREMENT_REVISED');
    expect(types).toContain('DERIVED_ANALYSIS_CREATED');
    expect(types).toContain('IMPACT_DIFF_AVAILABLE');
  });
});
