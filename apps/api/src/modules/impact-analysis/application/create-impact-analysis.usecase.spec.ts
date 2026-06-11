import { Injectable } from "@nestjs/common";

import { CreateImpactAnalysisUseCase } from './create-impact-analysis.usecase';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { RequirementRepository } from '../../requirement/infrastructure/requirement.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { EventLogService } from '../../event-log/application/event-log.service';
import { QueueService } from '../../queue/queue.service';
import { AppError } from '../../../shared/app-error';

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
    } as unknown as jest.Mocked<ImpactAnalysisRepository>;

    requirementRepo = {
      findRevisionById: jest.fn(),
    } as unknown as jest.Mocked<RequirementRepository>;

    prisma = {
      requirement: { findUnique: jest.fn() },
      repositorySnapshot: { findUnique: jest.fn() },
      repositoryTarget: { findUnique: jest.fn() },
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
});
