import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { RepositorySnapshotController } from './repository-snapshot.controller';
import { GetRepositorySnapshotDriftUseCase } from '../application/get-repository-snapshot-drift.usecase';
import { ListRepositorySnapshotsUseCase } from '../application/list-repository-snapshots.usecase';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('RepositorySnapshotController (API/E2E)', () => {
  let controller: RepositorySnapshotController;
  let useCase: jest.Mocked<GetRepositorySnapshotDriftUseCase>;
  let listUseCase: jest.Mocked<ListRepositorySnapshotsUseCase>;
  let permissions: jest.Mocked<ProjectPermissionService>;

  beforeEach(async () => {
    useCase = {
      execute: jest.fn(),
    } as any;

    listUseCase = {
      execute: jest.fn(),
    } as any;

    permissions = {
      assertCanReadRepository: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepositorySnapshotController],
      providers: [
        { provide: GetRepositorySnapshotDriftUseCase, useValue: useCase },
        { provide: ListRepositorySnapshotsUseCase, useValue: listUseCase },
        { provide: ProjectPermissionService, useValue: permissions },
      ],
    }).compile();

    controller = module.get<RepositorySnapshotController>(RepositorySnapshotController);
  });

  const validProjId = '00000000-0000-0000-0000-000000000000';
  const validRepoId = '11111111-1111-1111-1111-111111111111';
  const validBaseSnapId = '22222222-2222-2222-2222-222222222222';
  const validTargetSnapId = '33333333-3333-3333-3333-333333333333';

  const mockActor = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'ADMIN' as const };
  const mockDriftResult = {
    projectId: validProjId,
    repositoryId: validRepoId,
    baseSnapshotId: validBaseSnapId,
    targetSnapshotId: validTargetSnapId,
    status: 'NO_DRIFT' as const,
    summary: {
      baseArtifactCount: 1,
      targetArtifactCount: 1,
      addedArtifactCount: 0,
      removedArtifactCount: 0,
      changedArtifactCount: 0,
      unchangedArtifactCount: 1,
      unknownChangedArtifactCount: 0,
      hashUnavailableArtifactCount: 0,
    },
    versionComparison: {
      baseScannerVersion: '0.1',
      targetScannerVersion: '0.1',
      baseAnalyzerVersion: '0.1',
      targetAnalyzerVersion: '0.1',
      scannerVersionChanged: false,
      analyzerVersionChanged: false,
    },
    coverageComparison: {
      baseCoverageStatus: 'READY',
      targetCoverageStatus: 'READY',
      coverageStatusChanged: false,
    },
    samples: {
      addedArtifacts: [],
      removedArtifacts: [],
      changedArtifacts: [],
      unknownChangedArtifacts: [],
    },
    warnings: [],
  };

  it('throws 401/403/404 if permissions service throws', async () => {
    permissions.assertCanReadRepository.mockRejectedValueOnce(new UnauthorizedException());
    await expect(controller.getSnapshotDrift(validProjId, validRepoId, validBaseSnapId, undefined, mockActor)).rejects.toThrow(UnauthorizedException);

    permissions.assertCanReadRepository.mockRejectedValueOnce(new NotFoundException());
    await expect(controller.getSnapshotDrift(validProjId, validRepoId, validBaseSnapId, undefined, mockActor)).rejects.toThrow(NotFoundException);
  });

  it('calls use case with implicit target snapshot', async () => {
    permissions.assertCanReadRepository.mockResolvedValueOnce(undefined);
    useCase.execute.mockResolvedValueOnce(mockDriftResult);

    const result = await controller.getSnapshotDrift(validProjId, validRepoId, validBaseSnapId, undefined, mockActor);

    expect(permissions.assertCanReadRepository).toHaveBeenCalledWith(mockActor, validRepoId, validProjId);
    expect(useCase.execute).toHaveBeenCalledWith({
      projectId: validProjId,
      repositoryId: validRepoId,
      baseSnapshotId: validBaseSnapId,
      targetSnapshotId: undefined,
    });
    expect(result).toBeDefined();
    expect(result.status).toBe('NO_DRIFT');
  });

  it('calls use case with explicit target snapshot', async () => {
    permissions.assertCanReadRepository.mockResolvedValueOnce(undefined);
    useCase.execute.mockResolvedValueOnce({ ...mockDriftResult, targetSnapshotId: validTargetSnapId });

    const result = await controller.getSnapshotDrift(validProjId, validRepoId, validBaseSnapId, validTargetSnapId, mockActor);

    expect(useCase.execute).toHaveBeenCalledWith({
      projectId: validProjId,
      repositoryId: validRepoId,
      baseSnapshotId: validBaseSnapId,
      targetSnapshotId: validTargetSnapId,
    });
    expect(result.targetSnapshotId).toBe(validTargetSnapId);
  });

  describe('listSnapshots', () => {
    it('returns a bounded list of usable snapshots', async () => {
      permissions.assertCanReadRepository.mockResolvedValueOnce(undefined);
      listUseCase.execute.mockResolvedValueOnce({
        items: [
          {
            id: '55555555-5555-5555-5555-555555555555',
            commitSha: 'c1',
            createdAt: '2026-06-11T00:00:00.000Z',
            coverageStatus: 'READY',
            analyzerVersion: '0.1.0',
            artifactCount: 10,
          },
        ],
      });

      const result = await controller.listSnapshots(validProjId, validRepoId, '10', mockActor);

      expect(permissions.assertCanReadRepository).toHaveBeenCalledWith(mockActor, validRepoId, validProjId);
      expect(listUseCase.execute).toHaveBeenCalledWith({
        projectId: validProjId,
        repositoryId: validRepoId,
        limit: 10,
      });
      expect(result.items).toHaveLength(1);
    });

    it('falls back to default limit when omitted or invalid', async () => {
      permissions.assertCanReadRepository.mockResolvedValueOnce(undefined);
      listUseCase.execute.mockResolvedValueOnce({ items: [] });

      await controller.listSnapshots(validProjId, validRepoId, undefined, mockActor);

      expect(listUseCase.execute).toHaveBeenCalledWith({
        projectId: validProjId,
        repositoryId: validRepoId,
        limit: 20,
      });
    });
  });
});
