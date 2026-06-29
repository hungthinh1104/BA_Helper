import { FinalizeImpactAnalysisUseCase } from './finalize-impact-analysis.usecase';
import type { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import type { TraceabilityRepository } from '../../../traceability/infrastructure/traceability.repository';
import type { InsightRepository } from '../../../insight/infrastructure/insight.repository';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { CreateReviewedReportSnapshotUseCase } from '../../../document/application/commands/create-reviewed-report-snapshot.usecase';
import type { EnqueueDocumentJobUseCase } from '../../../document/application/commands/enqueue-document-job.usecase';

describe('FinalizeImpactAnalysisUseCase', () => {
  let useCase: FinalizeImpactAnalysisUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let traceabilityRepo: jest.Mocked<TraceabilityRepository>;
  let insightRepo: jest.Mocked<InsightRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let createSnapshot: jest.Mocked<CreateReviewedReportSnapshotUseCase>;
  let enqueueJob: jest.Mocked<EnqueueDocumentJobUseCase>;
  let txImpactUpdateMany: jest.Mock;
  let txSnapshotCreate: jest.Mock;
  let txDocumentJobFindUnique: jest.Mock;
  let txDocumentJobCreate: jest.Mock;

  beforeEach(() => {
    impactRepo = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    traceabilityRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<TraceabilityRepository>;
    insightRepo = {
      listByAnalysis: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<InsightRepository>;

    txImpactUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    txSnapshotCreate = jest.fn().mockResolvedValue({
      id: 'reviewed-snapshot-1',
      analysisId: 'analysis-1',
      approvedDocumentId: null,
      createdByUserId: 'user-1',
    });
    txDocumentJobFindUnique = jest.fn().mockResolvedValue(null);
    txDocumentJobCreate = jest.fn().mockResolvedValue({
      id: 'document-job-1',
      analysisId: 'analysis-1',
      snapshotId: 'reviewed-snapshot-1',
      documentType: 'IMPACT_REPORT',
      status: 'QUEUED',
    });

    prisma = {
      $transaction: jest.fn(async (callback: (tx: any) => unknown) =>
        callback({
          impactAnalysis: { updateMany: txImpactUpdateMany },
          reviewedReportSnapshot: { create: txSnapshotCreate },
          documentJob: {
            findUnique: txDocumentJobFindUnique,
            create: txDocumentJobCreate,
          },
        }),
      ),
      documentJob: {
        update: jest.fn(),
      },
    } as unknown as jest.Mocked<PrismaService>;

    createSnapshot = {
      buildSnapshotCreateData: jest.fn().mockResolvedValue({
        analysisId: 'analysis-1',
        approvedDocumentId: null,
        markdown: null,
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {},
        evaluationContextSnapshot: null,
        createdByUserId: 'user-1',
      }),
      recordCreatedEvent: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CreateReviewedReportSnapshotUseCase>;

    enqueueJob = {
      createOrReuseQueuedJobForSnapshot: jest.fn(async (tx: any, params: any) => {
        const existing = await tx.documentJob.findUnique({
          where: {
            snapshotId_documentType: {
              snapshotId: params.snapshotId,
              documentType: params.documentType,
            },
          },
        });
        if (existing) {
          return { job: existing, shouldEnqueue: true };
        }
        const job = await tx.documentJob.create({
          data: {
            analysisId: params.analysisId,
            snapshotId: params.snapshotId,
            documentType: params.documentType,
            status: 'QUEUED',
            attemptCount: 1,
          },
        });
        return { job, shouldEnqueue: true };
      }),
      enqueueExistingJob: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EnqueueDocumentJobUseCase>;

    useCase = new FinalizeImpactAnalysisUseCase(
      impactRepo,
      traceabilityRepo,
      insightRepo,
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
    insightRepo.listByAnalysis.mockResolvedValue((overrides.insights as any[]) ?? [
      {
        id: 'insight-1',
        insightType: 'CLAIM',
        title: 'Insight 1',
        insightKey: 'insight-1',
        certainty: 'EVIDENCED',
        reviewStatus: 'CONFIRMED',
        evidenceLinks: [
          {
            evidence: {
              sourceType: 'CODE',
              artifactId: 'artifact-1',
              sourcePath: 'src/booking.service.ts',
              startLine: 1,
              endLine: 5,
              excerpt: 'await refundService.issueRefundForCancelledPaidBooking(booking.id);',
              artifact: {
                id: 'artifact-1',
                filePath: 'src/booking.service.ts',
                name: 'BookingService',
              },
            },
          },
        ],
      },
    ] as any);
  };

  it('UC07-A: Valid finalize creates COMPLETED status, generates snapshot, and enqueues job', async () => {
    mockValidState();

    const result = await useCase.execute(validParams);

    expect(result.id).toBe('analysis-1');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(txImpactUpdateMany).toHaveBeenCalled();
    expect(createSnapshot.buildSnapshotCreateData).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      createdByUserId: 'user-1',
    });
    expect(txSnapshotCreate).toHaveBeenCalled();
    expect(enqueueJob.createOrReuseQueuedJobForSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      {
        analysisId: 'analysis-1',
        snapshotId: 'reviewed-snapshot-1',
        documentType: 'IMPACT_REPORT',
      },
    );
    expect(enqueueJob.enqueueExistingJob).toHaveBeenCalledWith('document-job-1');
  });

  it('leaves a queued document job recorded when BullMQ enqueue fails after commit', async () => {
    mockValidState();
    enqueueJob.enqueueExistingJob.mockRejectedValueOnce(new Error('Redis down'));

    await useCase.execute(validParams);

    expect(prisma.documentJob.update).toHaveBeenCalledWith({
      where: { id: 'document-job-1' },
      data: {
        error: {
          stage: 'QUEUE_ENQUEUE',
          message: 'Redis down',
        },
      },
    });
  });

  it('creates reviewed snapshot and document job in the same transaction', async () => {
    mockValidState();

    await useCase.execute(validParams);

    expect(txSnapshotCreate).toHaveBeenCalledWith({
      data: {
        analysisId: 'analysis-1',
        approvedDocumentId: null,
        markdown: null,
        reviewDecisionsSnapshot: [],
        evidenceQualitySummarySnapshot: {},
        evaluationContextSnapshot: null,
        createdByUserId: 'user-1',
      },
    });
    expect(txDocumentJobCreate).toHaveBeenCalled();
  });

  it('UC07-B: Finalize with unreviewed items without ack throws FINALIZE_REQUIRES_REVIEW_ACK', async () => {
    mockValidState({
      insights: [
        {
          id: 'qa-1',
          insightType: 'QA_SCENARIO',
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
          id: 'qa-1',
          insightType: 'QA_SCENARIO',
          title: 'Unreviewed Insight',
          certainty: 'INFERRED',
          reviewStatus: 'NEEDS_REVIEW',
          evidenceLinks: [],
        },
      ],
    });
    await useCase.execute({ analysisId: 'analysis-1', acknowledgeUnreviewed: true, userId: 'user-1' });

    expect(txImpactUpdateMany).toHaveBeenCalled();
    expect(createSnapshot.buildSnapshotCreateData).toHaveBeenCalled();
    expect(enqueueJob.enqueueExistingJob).toHaveBeenCalled();
  });

  it('blocks critical unresolved evidence quality issues even with unreviewed acknowledgement', async () => {
    mockValidState({
      insights: [
        {
          id: 'critical-insight-1',
          insightType: 'CLAIM',
          title: 'Critical missing evidence claim',
          insightKey: 'critical-insight-1',
          certainty: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
          evidenceLinks: [],
        },
      ],
    });

    await expect(useCase.execute({
      analysisId: 'analysis-1',
      acknowledgeUnreviewed: true,
      userId: 'user-1',
    })).rejects.toMatchObject({
      code: 'REVIEW_APPROVAL_BLOCKED',
      details: {
        blockingReasons: ['CRITICAL_MISSING_EVIDENCE'],
      },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
