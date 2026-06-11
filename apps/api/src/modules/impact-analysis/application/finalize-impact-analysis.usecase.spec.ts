import { Injectable } from "@nestjs/common";

import { FinalizeImpactAnalysisUseCase } from './finalize-impact-analysis.usecase';
import { ReviewNoteRepository } from '../infrastructure/review-note.repository';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { DocumentRepository } from '../../document/infrastructure/document.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { MarkdownImpactReportBuilder } from '../../document/application/markdown-impact-report.builder';
import { MermaidImpactDiagramBuilder } from '../../document/application/mermaid-impact-diagram.builder';
import { ClarificationRepository } from '../../clarification/infrastructure/clarification.repository';
import { ReviewDecisionRepository } from '../infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from './get-impact-diff.usecase';

describe('FinalizeImpactAnalysisUseCase', () => {
  let useCase: FinalizeImpactAnalysisUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let documentRepo: jest.Mocked<DocumentRepository>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;
  let graphRepo: jest.Mocked<GraphRepository>;
  let reviewNoteRepo: jest.Mocked<ReviewNoteRepository>;
  let clarificationRepo: jest.Mocked<ClarificationRepository>;
  let decisionRepo: jest.Mocked<ReviewDecisionRepository>;
  let getDiffUseCase: jest.Mocked<GetImpactDiffUseCase>;
  let eventLog: jest.Mocked<EventLogService>;
  let reportBuilder: MarkdownImpactReportBuilder;

  beforeEach(() => {
    impactRepo = {
      findById: jest.fn(),
      finalizeIfCurrent: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    documentRepo = {
      upsertApproved: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;
    documentRepo.upsertApproved.mockResolvedValue({
      id: 'document-1',
      createdAt: new Date('2026-06-06T00:00:00.000Z'),
      updatedAt: new Date('2026-06-06T00:00:00.000Z'),
    } as any);

    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

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

    decisionRepo = {
      listByAnalysisId: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReviewDecisionRepository>;

    getDiffUseCase = {
      computeForAnalysis: jest.fn().mockResolvedValue({ computable: false }),
    } as unknown as jest.Mocked<GetImpactDiffUseCase>;

    const mermaidBuilder = {
      build: jest.fn().mockReturnValue({ mermaid: '```mermaid\nflowchart TD\n```', isTruncated: false }),
    } as unknown as jest.Mocked<MermaidImpactDiagramBuilder>;

    reportBuilder = new MarkdownImpactReportBuilder(mermaidBuilder);

    useCase = new FinalizeImpactAnalysisUseCase(
      impactRepo,
      insightRepo,
      traceabilityRepo,
      graphRepo,
      reviewNoteRepo,
      clarificationRepo,
      documentRepo,
      eventLog,
      reportBuilder,
      decisionRepo,
      getDiffUseCase,
    );
  });

  const validParams = {
    analysisId: 'analysis-1',
    acknowledgeUnreviewed: false,
  };

  const mockValidState = (overrides: Record<string, unknown> = {}) => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'WAITING_FOR_REVIEW',
      requirementRevision: {
        title: 'Test Requirement',
        rawText: 'Test requirement raw text',
      },
      snapshot: { 
        commitSha: 'abc1234',
        id: 'snapshot-1',
        analyzerVersion: '1.0.0',
        repositoryId: 'repo-1',
        repository: {
          canonicalUrl: 'https://github.com/test',
          projectId: 'project-1',
        },
      },
      sourceTarget: {
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
        requestedRef: 'main',
      },
      insights: [
        {
          insightType: 'CLAIM',
          title: 'Insight 1',
          certainty: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
          evidenceLinks: [],
        },
      ],
      ...overrides,
    } as any);

    insightRepo.listByAnalysis.mockResolvedValue(overrides.insights || [
      {
        insightType: 'CLAIM',
        title: 'Insight 1',
        description: 'Insight 1',
        certainty: 'EVIDENCED',
        reviewStatus: 'CONFIRMED',
        evidenceLinks: [],
      }
    ] as any);
  };

  it('UC07-A: Valid finalize creates COMPLETED status, approved markdown, and emits event', async () => {
    mockValidState();
    impactRepo.finalizeIfCurrent.mockResolvedValue({ count: 1 } as any);

    const result = await useCase.execute(validParams);

    expect(result.id).toBe('analysis-1');
    expect(impactRepo.finalizeIfCurrent).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      status: 'COMPLETED',
      stage: 'DONE',
      progress: 100,
      expectedCommitSha: 'abc1234',
      expectedTargetCommitSha: 'abc1234',
      expectedResolvedRefType: 'BRANCH',
    });
    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.stringContaining('Insight 1'),
    });
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'IMPACT_ANALYSIS_FINALIZED' }),
    );
  });

  it('UC07-A: Rejected insights are excluded from approved markdown', async () => {
    mockValidState({
      insights: [
        {
          insightType: 'CLAIM',
          title: 'Confirmed Insight',
          certainty: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
          evidenceLinks: [],
        },
        {
          insightType: 'CLAIM',
          title: 'Rejected Insight',
          certainty: 'INFERRED',
          reviewStatus: 'REJECTED',
          evidenceLinks: [],
        },
      ],
    });
    impactRepo.finalizeIfCurrent.mockResolvedValue({ count: 1 });

    await useCase.execute(validParams);

    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.stringMatching(/Confirmed Insight/),
    });
    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.not.stringMatching(/Rejected Insight/),
    });
  });

  it('UC07-B: Finalize with unreviewed items without ack throws FINALIZE_REQUIRES_REVIEW_ACK', async () => {
    mockValidState({
      insights: [
        {
          insightType: 'CLAIM',
          title: 'Unreviewed Insight',
          certainty: 'INFERRED',
          reviewStatus: 'NEEDS_REVIEW',
        },
      ],
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'FINALIZE_REQUIRES_REVIEW_ACK',
    });
    expect(impactRepo.finalizeIfCurrent).not.toHaveBeenCalled();
  });

  it('UC07-C: Finalize stale analysis throws ANALYSIS_STALE', async () => {
    mockValidState({
      sourceTarget: {
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'newer-commit',
      },
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'ANALYSIS_STALE',
    });
    expect(impactRepo.finalizeIfCurrent).not.toHaveBeenCalled();
  });

  it('UC07-C: Finalize terminal duplicate (COMPLETED) throws INVALID_STATE_TRANSITION', async () => {
    mockValidState({ status: 'COMPLETED' });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(impactRepo.finalizeIfCurrent).not.toHaveBeenCalled();
  });

  it('UC07-D: Finalize unreviewed with ack success, unreviewed items remain labeled', async () => {
    mockValidState({
      insights: [
        {
          insightType: 'CLAIM',
          title: 'Unreviewed Insight',
          certainty: 'INFERRED',
          reviewStatus: 'NEEDS_REVIEW',
          evidenceLinks: [],
        },
      ],
    });
    impactRepo.finalizeIfCurrent.mockResolvedValue({ count: 1 });

    await useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true });

    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.stringContaining('Unreviewed Insight'),
    });
    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.stringContaining('This report was finalized with unreviewed items acknowledged.'),
    });
    expect(impactRepo.finalizeIfCurrent).toHaveBeenCalled();
  });
});
