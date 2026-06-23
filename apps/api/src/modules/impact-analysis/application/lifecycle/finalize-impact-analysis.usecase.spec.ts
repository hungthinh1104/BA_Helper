import { FinalizeImpactAnalysisUseCase } from './finalize-impact-analysis.usecase';
import { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateReviewedReportSnapshotUseCase } from '../../../document/application/create-reviewed-report-snapshot.usecase';
import { EnqueueDocumentJobUseCase } from '../../../document/application/enqueue-document-job.usecase';

describe('FinalizeImpactAnalysisUseCase', () => {
  let useCase: FinalizeImpactAnalysisUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let createSnapshot: jest.Mocked<CreateReviewedReportSnapshotUseCase>;
  let enqueueJob: jest.Mocked<EnqueueDocumentJobUseCase>;
  let txImpactUpdateMany: jest.Mock;

  beforeEach(() => {
    impactRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    traceabilityRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<TraceabilityRepository>;

    txImpactUpdateMany = jest.fn().mockResolvedValue({ count: 1 })

    prisma = {
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          impactAnalysis: { updateMany: txImpactUpdateMany },
        }),
      ),
    } as unknown as jest.Mocked<PrismaService>;

    createSnapshot = {
      execute: jest.fn().mockResolvedValue({ id: 'snapshot-1' }),
    } as unknown as jest.Mocked<CreateReviewedReportSnapshotUseCase>;

    enqueueJob = {
      execute: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<EnqueueDocumentJobUseCase>;

    useCase = new FinalizeImpactAnalysisUseCase(
      impactRepo,
      traceabilityRepo,
      prisma,
      createSnapshot,
      enqueueJob,
    );
  });

  const validParams = {
    analysisId: 'analysis-1',
    acknowledgeUnreviewed: false,
    userId: 'user-1',
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
  };

  it('UC07-A: Valid finalize creates COMPLETED status, generates snapshot, and enqueues job', async () => {
    mockValidState();

    const result = await useCase.execute(validParams);

    expect(result.id).toBe('analysis-1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(txImpactUpdateMany).toHaveBeenCalled();
    expect(createSnapshot.execute).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      createdByUserId: 'user-1',
    });
    expect(enqueueJob.execute).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      documentType: 'IMPACT_REPORT',
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
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('UC07-C: Finalize terminal duplicate (COMPLETED) throws INVALID_STATE_TRANSITION', async () => {
    mockValidState({ status: 'COMPLETED' });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
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
    await useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true, userId: 'user-1' });

    expect(txImpactUpdateMany).toHaveBeenCalled();
    expect(createSnapshot.execute).toHaveBeenCalled();
    expect(enqueueJob.execute).toHaveBeenCalled();
  });
});
