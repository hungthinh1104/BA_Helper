import { Controller, Get, Param } from '@nestjs/common';
import { artifactListResponseSchema, RequestUser } from '@ba-helper/contracts';
import { ListArtifactsUseCase } from '../application/list-artifacts.usecase';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class ArtifactController {
  constructor(
    private readonly listArtifacts: ListArtifactsUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/snapshots/:snapshotId/artifacts')
  async list(
    @Param('snapshotId') snapshotId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadSnapshot(actor, snapshotId);
    const items = await this.listArtifacts.execute(snapshotId);
    const mapped = items.map((artifact) => ({
      id: artifact.id,
      artifactKey: artifact.artifactKey,
      name: artifact.name,
      artifactType: artifact.artifactType,
      universalKind: artifact.universalKind ?? 'UNKNOWN',
      filePath: artifact.filePath,
      startLine: artifact.startLine,
      endLine: artifact.endLine,
      language: artifact.language,
    }));

    return artifactListResponseSchema.parse({ items: mapped });
  }
}
