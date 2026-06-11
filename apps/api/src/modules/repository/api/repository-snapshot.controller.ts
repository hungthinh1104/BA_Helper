import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { RequestUser } from '@ba-helper/contracts';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { GetRepositorySnapshotDriftUseCase } from '../application/get-repository-snapshot-drift.usecase';
import { ListRepositorySnapshotsUseCase } from '../application/list-repository-snapshots.usecase';
import { repositorySnapshotDriftResponseSchema, repositorySnapshotListResponseSchema } from '@ba-helper/contracts';

@Controller('/api/v1/projects/:projectId/repositories/:repositoryId/snapshots')
export class RepositorySnapshotController {
  constructor(
    private readonly permissions: ProjectPermissionService,
    private readonly getDriftUseCase: GetRepositorySnapshotDriftUseCase,
    private readonly listSnapshotsUseCase: ListRepositorySnapshotsUseCase,
  ) {}

  @Get('/')
  async listSnapshots(
    @Param('projectId') projectId: string,
    @Param('repositoryId') repositoryId: string,
    @Query('limit') limitRaw: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadRepository(actor, repositoryId, projectId);

    const limit = limitRaw ? parseInt(limitRaw, 10) : 20;

    const result = await this.listSnapshotsUseCase.execute({
      projectId,
      repositoryId,
      limit: isNaN(limit) ? 20 : limit,
    });

    return repositorySnapshotListResponseSchema.parse(result);
  }

  @Get('/:baseSnapshotId/drift')
  async getSnapshotDrift(
    @Param('projectId') projectId: string,
    @Param('repositoryId') repositoryId: string,
    @Param('baseSnapshotId') baseSnapshotId: string,
    @Query('targetSnapshotId') targetSnapshotId: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadRepository(actor, repositoryId, projectId);

    const drift = await this.getDriftUseCase.execute({
      projectId,
      repositoryId,
      baseSnapshotId,
      targetSnapshotId,
    });

    return repositorySnapshotDriftResponseSchema.parse(drift);
  }
}
