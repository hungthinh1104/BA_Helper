import { NotFoundException } from '@nestjs/common';
import { GetAnalysisDriftFreshnessUseCase } from './get-analysis-drift-freshness.usecase';
import { ImpactAnalysisRepository } from '../infrastructure/impact-analysis.repository';
import { GetRepositorySnapshotDriftUseCase } from '../../repository/application/get-repository-snapshot-drift.usecase';
import { PrismaService } from '../../prisma/prisma.service';

describe('GetAnalysisDriftFreshnessUseCase', () => {
  let useCase: GetAnalysisDriftFreshnessUseCase;
  let analysisRepo: jest.Mocked<ImpactAnalysisRepository>;
  let prisma: any;
  let getDrift: jest.Mocked<GetRepositorySnapshotDriftUseCase>;

  const mockProjectId = 'proj-1';
  const mockAnalysisId = 'analysis-1';
  const mockRepositoryId = 'repo-1';
  const mockSnapshotId = 'snap-1';
  
  beforeEach(() => {
    analysisRepo = {
      findById: jest.fn(),
    } as any;

    prisma = {
      repositorySnapshot: {
        findFirst: jest.fn(),
      },
    };

    getDrift = {
      execute: jest.fn(),
    } as any;

    useCase = new GetAnalysisDriftFreshnessUseCase(analysisRepo, prisma, getDrift);
  });

  it('throws NotFoundException if analysis does not exist', async () => {
    analysisRepo.findById.mockResolvedValueOnce(null);
    await expect(useCase.execute(mockProjectId, mockAnalysisId)).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException if analysis projectId mismatch', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshot: { repository: { projectId: 'other-proj' } } } as any);
    await expect(useCase.execute(mockProjectId, mockAnalysisId)).rejects.toThrow(NotFoundException);
  });

  it('returns UNKNOWN if no usable snapshot is found', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshot: { repositoryId: mockRepositoryId, repository: { projectId: mockProjectId } } } as any);
    prisma.repositorySnapshot.findFirst.mockResolvedValueOnce(null);

    const result = await useCase.execute(mockProjectId, mockAnalysisId);
    expect(result.status).toBe('UNKNOWN');
    expect(result.severity).toBe('WARN');
    expect(result.shouldReviewBeforeUse).toBe(true);
    expect(result.shouldRerunAnalysis).toBe(false);
  });

  it('returns CURRENT if latest usable snapshot matches analysis snapshot', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshotId: mockSnapshotId, snapshot: { repositoryId: mockRepositoryId, repository: { projectId: mockProjectId } } } as any);
    prisma.repositorySnapshot.findFirst.mockResolvedValueOnce({ id: mockSnapshotId });

    const result = await useCase.execute(mockProjectId, mockAnalysisId);
    expect(result.status).toBe('CURRENT');
    expect(result.severity).toBe('INFO');
    expect(result.shouldReviewBeforeUse).toBe(false);
    expect(result.shouldRerunAnalysis).toBe(false);
  });

  it('returns CURRENT if NO_DRIFT is returned by drift use case', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshotId: mockSnapshotId, snapshot: { repositoryId: mockRepositoryId, repository: { projectId: mockProjectId } } } as any);
    prisma.repositorySnapshot.findFirst.mockResolvedValueOnce({ id: 'snap-2' });
    getDrift.execute.mockResolvedValueOnce({ status: 'NO_DRIFT', summary: {} } as any);

    const result = await useCase.execute(mockProjectId, mockAnalysisId);
    expect(result.status).toBe('CURRENT');
    expect(result.severity).toBe('INFO');
    expect(result.shouldReviewBeforeUse).toBe(false);
    expect(result.shouldRerunAnalysis).toBe(false);
  });

  it('returns INCOMPATIBLE if INCOMPATIBLE is returned by drift use case', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshotId: mockSnapshotId, snapshot: { repositoryId: mockRepositoryId, repository: { projectId: mockProjectId } } } as any);
    prisma.repositorySnapshot.findFirst.mockResolvedValueOnce({ id: 'snap-2' });
    getDrift.execute.mockResolvedValueOnce({ status: 'INCOMPATIBLE', summary: {} } as any);

    const result = await useCase.execute(mockProjectId, mockAnalysisId);
    expect(result.status).toBe('INCOMPATIBLE');
    expect(result.severity).toBe('HIGH');
    expect(result.shouldReviewBeforeUse).toBe(true);
    expect(result.shouldRerunAnalysis).toBe(true);
  });

  it('returns DRIFTED (WARN) if only additions exist', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshotId: mockSnapshotId, snapshot: { repositoryId: mockRepositoryId, repository: { projectId: mockProjectId } } } as any);
    prisma.repositorySnapshot.findFirst.mockResolvedValueOnce({ id: 'snap-2' });
    getDrift.execute.mockResolvedValueOnce({ 
      status: 'DRIFTED', 
      summary: { addedArtifactCount: 5, removedArtifactCount: 0, changedArtifactCount: 0 } 
    } as any);

    const result = await useCase.execute(mockProjectId, mockAnalysisId);
    expect(result.status).toBe('DRIFTED');
    expect(result.severity).toBe('WARN');
    expect(result.shouldReviewBeforeUse).toBe(true);
    expect(result.shouldRerunAnalysis).toBe(false);
  });

  it('returns DRIFTED (HIGH) if changes or removals exist', async () => {
    analysisRepo.findById.mockResolvedValueOnce({ snapshotId: mockSnapshotId, snapshot: { repositoryId: mockRepositoryId, repository: { projectId: mockProjectId } } } as any);
    prisma.repositorySnapshot.findFirst.mockResolvedValueOnce({ id: 'snap-2' });
    getDrift.execute.mockResolvedValueOnce({ 
      status: 'DRIFTED', 
      summary: { addedArtifactCount: 5, removedArtifactCount: 1, changedArtifactCount: 0 } 
    } as any);

    const result = await useCase.execute(mockProjectId, mockAnalysisId);
    expect(result.status).toBe('DRIFTED');
    expect(result.severity).toBe('HIGH');
    expect(result.shouldReviewBeforeUse).toBe(true);
    expect(result.shouldRerunAnalysis).toBe(true);
  });
});
