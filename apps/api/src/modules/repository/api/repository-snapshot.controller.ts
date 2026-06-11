import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { RequestUser } from '@ba-helper/contracts';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { GetRepositorySnapshotDriftUseCase } from '../application/get-repository-snapshot-drift.usecase';
import { repositorySnapshotDriftResponseSchema } from '@ba-helper/contracts';

@Controller('/api/v1/projects/:projectId/repositories/:repositoryId/snapshots')
export class RepositorySnapshotController {
  constructor(
    private readonly permissions: ProjectPermissionService,
    private readonly getDriftUseCase: GetRepositorySnapshotDriftUseCase,
  ) {}

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
