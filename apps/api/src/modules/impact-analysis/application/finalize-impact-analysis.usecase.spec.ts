import { Injectable } from "@nestjs/common";

import { FinalizeImpactAnalysisUseCase } from './finalize-impact-analysis.usecase';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { DocumentRepository } from '../../document/infrastructure/document.repository';
import { EventLogService } from '../../event-log/application/event-log.service';
import { AppError } from '../../../shared/app-error';

describe('FinalizeImpactAnalysisUseCase', () => {
  let useCase: FinalizeImpactAnalysisUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let documentRepo: jest.Mocked<DocumentRepository>;
  let eventLog: jest.Mocked<EventLogService>;

  beforeEach(() => {
    impactRepo = {
      findById: jest.fn(),
      finalizeIfCurrent: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    documentRepo = {
      upsertApproved: jest.fn(),
    } as unknown as jest.Mocked<DocumentRepository>;

    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    useCase = new FinalizeImpactAnalysisUseCase(impactRepo, documentRepo, eventLog);
  });

  const validParams = {
    analysisId: 'analysis-1',
    acknowledgeUnreviewed: false,
  };

  const mockValidState = (overrides = {}) => {
    impactRepo.findById.mockResolvedValue({
      id: 'analysis-1',
      status: 'WAITING_FOR_REVIEW',
      requirementRevision: {
        title: 'Test Requirement',
        rawText: 'Test requirement raw text',
      },
      snapshot: { commitSha: 'abc1234' },
      sourceTarget: {
        resolvedRefType: 'BRANCH',
        latestObservedCommitSha: 'abc1234',
      },
      insights: [
        {
          insightType: 'CLAIM',
          title: 'Insight 1',
          certainty: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
        },
      ],
      ...overrides,
    } as any);
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
        },
        {
          insightType: 'CLAIM',
          title: 'Rejected Insight',
          certainty: 'INFERRED',
          reviewStatus: 'REJECTED',
        },
      ],
    });
    impactRepo.finalizeIfCurrent.mockResolvedValue({ count: 1 } as any);

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
        },
      ],
    });
    impactRepo.finalizeIfCurrent.mockResolvedValue({ count: 1 } as any);

    await useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true });

    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.stringContaining('Unreviewed Insight'),
    });
    expect(documentRepo.upsertApproved).toHaveBeenCalledWith({
      impactAnalysisId: 'analysis-1',
      content: expect.stringContaining('NEEDS_REVIEW'),
    });
    expect(impactRepo.finalizeIfCurrent).toHaveBeenCalled();
  });
});
