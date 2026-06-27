import { Injectable } from "@nestjs/common";

import { CreateImpactAnalysisUseCase } from './create-impact-analysis.usecase';
import type { ImpactAnalysisRepository } from '../../infrastructure/impact-analysis.repository';
import type { RequirementRepository } from '../../../requirement/infrastructure/requirement.repository';
import type { PrismaService } from '../../../prisma/prisma.service';
import type { EventLogService } from '../../../event-log/application/event-log.service';
import type { QueueService } from '../../../queue/queue.service';
import { Prisma } from '@prisma/client';
import { DomainPackRegistry } from '../../../domain-pack/application/domain-pack.registry';

describe('CreateImpactAnalysisUseCase', () => {
  let useCase: CreateImpactAnalysisUseCase;
  let impactRepo: jest.Mocked<ImpactAnalysisRepository>;
  let requirementRepo: jest.Mocked<RequirementRepository>;
  let prisma: jest.Mocked<PrismaService>;
  let eventLog: jest.Mocked<EventLogService>;
  let queue: jest.Mocked<QueueService>;

  beforeEach(() => {
    impactRepo = {
      findByRequestKey: jest.fn(),
      findByComposite: jest.fn(),
      createQueued: jest.fn(),
      updateStatus: jest.fn(),
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    requirementRepo = {
      findRevisionById: jest.fn(),
    } as unknown as jest.Mocked<RequirementRepository>;

    prisma = {
      requirement: { findUnique: jest.fn() },
      repositorySnapshot: { findUnique: jest.fn() },
      repositoryTarget: { findUnique: jest.fn() },
      clarificationItem: { findUnique: jest.fn() },
    } as unknown as jest.Mocked<PrismaService>;
    
    eventLog = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<EventLogService>;

    queue = {
      enqueueImpactAnalysis: jest.fn(),
    } as unknown as jest.Mocked<QueueService>;

    useCase = new CreateImpactAnalysisUseCase(
      impactRepo,
      requirementRepo,
      prisma,
      eventLog,
      queue,
      new DomainPackRegistry(),
    );
  });

  const validParams = {
    requirementRevisionId: 'rev-1',
    snapshotId: 'snap-1',
    sourceTargetId: 'target-1',
    requestKey: 'req-key',
    allowPartialSnapshot: false,
  };

  const mockValidState = () => {
    (requirementRepo.findRevisionById as jest.Mock).mockResolvedValue({
      id: 'rev-1',
      readinessStatus: 'READY_FOR_ANALYSIS',
      requirementId: 'req-1',
    });
    (prisma.requirement.findUnique as jest.Mock).mockResolvedValue({
      id: 'req-1',
      projectId: 'proj-1',
    });
    (prisma.repositorySnapshot.findUnique as jest.Mock).mockResolvedValue({
      id: 'snap-1',
      repositoryId: 'repo-1',
      commitSha: 'abc1234',
      coverageStatus: 'READY',
      repository: { projectId: 'proj-1' },
    });
    (prisma.repositoryTarget.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-1',
      repositoryId: 'repo-1',
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'abc1234',
    });
    impactRepo.findByRequestKey.mockResolvedValue(null);
    impactRepo.findByComposite.mockResolvedValue(null);
    impactRepo.createQueued.mockResolvedValue({ id: 'analysis-1' } as any);
  };

  it('UC05-A: valid input creates QUEUED analysis and enqueues job', async () => {
    mockValidState();

    const result = await useCase.execute(validParams);

    expect(result.id).toBe('analysis-1');
    expect(impactRepo.createQueued).toHaveBeenCalled();
    expect(eventLog.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'IMPACT_ANALYSIS_QUEUED' }),
    );
    expect(queue.enqueueImpactAnalysis).toHaveBeenCalledWith('analysis-1');
  });

  it('UC05-B: PARTIAL snapshot without allowPartialSnapshot is rejected', async () => {
    mockValidState();
    (prisma.repositorySnapshot.findUnique as jest.Mock).mockResolvedValue({
      id: 'snap-1',
      repositoryId: 'repo-1',
      commitSha: 'abc1234',
      coverageStatus: 'PARTIAL',
      repository: { projectId: 'proj-1' },
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'SNAPSHOT_PARTIAL_NOT_ALLOWED',
    });
  });

  it('UC05-C: project mismatch is rejected', async () => {
    mockValidState();
    (prisma.repositorySnapshot.findUnique as jest.Mock).mockResolvedValue({
      id: 'snap-1',
      repositoryId: 'repo-1',
      commitSha: 'abc1234',
      coverageStatus: 'READY',
      repository: { projectId: 'different-proj' },
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'INPUT_PROJECT_MISMATCH',
    });
  });

  it('UC05-C: revision not READY is rejected', async () => {
    mockValidState();
    (requirementRepo.findRevisionById as jest.Mock).mockResolvedValue({
      id: 'rev-1',
      readinessStatus: 'DRAFT',
      requirementId: 'req-1',
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REQUIREMENT_REVISION_NOT_READY',
    });
  });

  it('UC05-C: stale moving target is rejected', async () => {
    mockValidState();
    (prisma.repositoryTarget.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-1',
      repositoryId: 'repo-1',
      resolvedRefType: 'BRANCH',
      latestObservedCommitSha: 'newer-commit', // different from snapshot.commitSha
    });

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'ANALYSIS_STALE',
    });
  });

  it('UC05-E: same requestKey and same payload returns existing analysis', async () => {
    mockValidState();
    impactRepo.findByComposite.mockResolvedValue({ id: 'existing-1' } as any);

    const result = await useCase.execute(validParams);

    expect(result.id).toBe('existing-1');
    expect(impactRepo.createQueued).not.toHaveBeenCalled();
    expect(queue.enqueueImpactAnalysis).not.toHaveBeenCalled();
  });

  it('returns existing analysis on unique-conflict race for same payload', async () => {
    mockValidState();
    impactRepo.createQueued.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    impactRepo.findByComposite.mockResolvedValueOnce(null);
    impactRepo.findByComposite.mockResolvedValueOnce({ id: 'analysis-race' } as any);

    const result = await useCase.execute(validParams);

    expect(result.id).toBe('analysis-race');
    expect(queue.enqueueImpactAnalysis).not.toHaveBeenCalled();
  });

  it('marks analysis failed if queue enqueue fails after DB create', async () => {
    mockValidState();
    queue.enqueueImpactAnalysis.mockRejectedValue(new Error('queue offline'));

    await expect(useCase.execute(validParams)).rejects.toThrow('queue offline');

    expect(impactRepo.updateStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'analysis-1',
        status: 'FAILED',
        error: expect.objectContaining({
          code: 'QUEUE_ENQUEUE_FAILED',
        }),
      }),
    );
  });

  it('requestKey reused with different payload is rejected', async () => {
    mockValidState();
    impactRepo.findByRequestKey.mockResolvedValue({
      id: 'existing-1',
      requirementRevisionId: 'rev-1',
      snapshotId: 'different-snap',
      sourceTargetId: 'target-1',
      requestKey: 'req-key',
    } as any);

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REQUEST_KEY_MISMATCH',
    });
  });

  it('requestKey reused with different requirementRevisionId is rejected', async () => {
    mockValidState();
    impactRepo.findByRequestKey.mockResolvedValue({
      id: 'existing-1',
      requirementRevisionId: 'different-rev',
      snapshotId: 'snap-1',
      sourceTargetId: 'target-1',
      requestKey: 'req-key',
    } as any);

    await expect(useCase.execute(validParams)).rejects.toMatchObject({
      code: 'REQUEST_KEY_MISMATCH',
    });
  });

  it('persists canonical resolved domain pack metadata for explicit healthcare alias', async () => {
    mockValidState();

    await useCase.execute({
      ...validParams,
      domainPackId: 'healthcare',
    });

    expect(impactRepo.createQueued).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          selectedDomainPack: expect.objectContaining({
            requestedDomainPackId: 'healthcare',
            resolvedDomainPackId: 'healthcare',
            resolvedDomainPackVersion: '0.1.0',
            resolvedDomainPackStatus: 'PARTIAL',
            selectedBy: 'EXPLICIT',
            resolvedAt: expect.any(String),
          }),
          domainPack: {
            id: 'healthcare',
            version: '0.1.0',
            status: 'PARTIAL',
            selectedBy: 'EXPLICIT',
          },
          reportProvenance: {
            domainPackId: 'healthcare',
            domainPackVersion: '0.1.0',
            domainPackStatus: 'PARTIAL',
            selectedBy: 'EXPLICIT',
          },
        }),
      }),
    );
  });

  it('rejects unsupported explicit domain pack version with supported canonical ids', async () => {
    mockValidState();

    await expect(useCase.execute({
      ...validParams,
      domainPackId: 'healthcare@0.2.0',
    })).rejects.toMatchObject({
      code: 'UNSUPPORTED_DOMAIN_PACK_VERSION',
      details: {
        requested: 'healthcare@0.2.0',
        supported: expect.arrayContaining(['healthcare@0.1.0']),
      },
    });
  });

  it('requestKey reused with different domain pack is rejected', async () => {
    mockValidState();
    impactRepo.findByRequestKey.mockResolvedValue({
      id: 'existing-1',
      requirementRevisionId: 'rev-1',
      snapshotId: 'snap-1',
      sourceTargetId: 'target-1',
      requestKey: 'req-key',
      metadata: {
        selectedDomainPack: {
          requestedDomainPackId: 'booking',
          resolvedDomainPackId: 'booking',
          resolvedDomainPackVersion: '0.1.0',
          resolvedDomainPackStatus: 'STABLE',
          selectedBy: 'EXPLICIT',
          resolvedAt: '2026-06-27T00:00:00.000Z',
        },
      },
    } as any);

    await expect(useCase.execute({
      ...validParams,
      domainPackId: 'healthcare',
    })).rejects.toMatchObject({
      code: 'REQUEST_KEY_MISMATCH',
    });
  });

  describe('Lineage Validation', () => {
    const lineageParams = {
      ...validParams,
      derivedFromAnalysisId: 'old-analysis-1',
      sourceClarificationId: 'clarification-1',
    };

    const mockValidClarification = () => {
      mockValidState();
      (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'clarification-1',
        impactAnalysisId: 'old-analysis-1',
        status: 'CONVERTED_TO_REVISION',
        convertedRequirementRevisionId: 'rev-1',
        impactAnalysis: {
          snapshot: {
            repository: { projectId: 'proj-1' },
          },
        },
      });
    };

    it('creates QUEUED analysis with valid lineage', async () => {
      mockValidClarification();

      const result = await useCase.execute(lineageParams);

      expect(result.id).toBe('analysis-1');
      expect(impactRepo.createQueued).toHaveBeenCalledWith(
        expect.objectContaining({
          derivedFromAnalysisId: 'old-analysis-1',
          sourceClarificationId: 'clarification-1',
        })
      );
    });

    it('rejects sourceClarificationId without derivedFromAnalysisId', async () => {
      mockValidState();
      await expect(
        useCase.execute({ ...lineageParams, derivedFromAnalysisId: undefined })
      ).rejects.toMatchObject({
        code: 'INVALID_LINEAGE',
      });
    });



    it('rejects missing source clarification', async () => {
      mockValidClarification();
      (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(useCase.execute(lineageParams)).rejects.toMatchObject({
        code: 'CLARIFICATION_NOT_FOUND',
      });
    });

    it('rejects clarification that does not belong to derived analysis', async () => {
      mockValidClarification();
      (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'clarification-1',
        impactAnalysisId: 'different-old-analysis',
        status: 'CONVERTED_TO_REVISION',
        convertedRequirementRevisionId: 'rev-1',
        impactAnalysis: {
          snapshot: {
            repository: { projectId: 'proj-1' },
          },
        },
      });

      await expect(useCase.execute(lineageParams)).rejects.toMatchObject({
        code: 'INVALID_LINEAGE',
        message: 'Clarification does not belong to the derived analysis.',
      });
    });

    it('rejects clarification not CONVERTED_TO_REVISION', async () => {
      mockValidClarification();
      (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'clarification-1',
        impactAnalysisId: 'old-analysis-1',
        status: 'ANSWERED',
        convertedRequirementRevisionId: 'rev-1',
        impactAnalysis: {
          snapshot: {
            repository: { projectId: 'proj-1' },
          },
        },
      });

      await expect(useCase.execute(lineageParams)).rejects.toMatchObject({
        code: 'INVALID_LINEAGE',
        message: 'Clarification must be CONVERTED_TO_REVISION to spawn a new analysis.',
      });
    });

    it('rejects requested revision not equal to converted revision', async () => {
      mockValidClarification();
      (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'clarification-1',
        impactAnalysisId: 'old-analysis-1',
        status: 'CONVERTED_TO_REVISION',
        convertedRequirementRevisionId: 'different-rev',
        impactAnalysis: {
          snapshot: {
            repository: { projectId: 'proj-1' },
          },
        },
      });

      await expect(useCase.execute(lineageParams)).rejects.toMatchObject({
        code: 'INVALID_LINEAGE',
        message: 'Requested requirement revision does not match the clarification converted revision.',
      });
    });

    it('rejects new analysis project different from old analysis project', async () => {
      mockValidClarification();
      (prisma.clarificationItem.findUnique as jest.Mock).mockResolvedValue({
        id: 'clarification-1',
        impactAnalysisId: 'old-analysis-1',
        status: 'CONVERTED_TO_REVISION',
        convertedRequirementRevisionId: 'rev-1',
        impactAnalysis: {
          snapshot: {
            repository: { projectId: 'different-proj' },
          },
        },
      });

      await expect(useCase.execute(lineageParams)).rejects.toMatchObject({
        code: 'INVALID_LINEAGE',
        message: 'New analysis project does not match old analysis project.',
      });
    });
  });
});
