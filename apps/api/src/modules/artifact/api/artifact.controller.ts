import { Controller, Get, Param, Query } from '@nestjs/common';
import { artifactListResponseSchema, codeComprehensionResponseSchema, RequestUser } from '@ba-helper/contracts';
import { ListArtifactsUseCase } from '../application/list-artifacts.usecase';
import { GetCodeComprehensionUseCase } from '../application/get-code-comprehension.usecase';
import { mapArtifactResponse } from '../application/artifact-response.mapper';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class ArtifactController {
  constructor(
    private readonly listArtifacts: ListArtifactsUseCase,
    private readonly comprehension: GetCodeComprehensionUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/snapshots/:snapshotId/artifacts')
  async list(
    @Param('snapshotId') snapshotId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadSnapshot(actor, snapshotId);
    const items = await this.listArtifacts.execute(snapshotId);
    const mapped = items.map(mapArtifactResponse);

    return artifactListResponseSchema.parse({ items: mapped });
  }

  @Get('/snapshots/:snapshotId/artifacts/:artifactId/comprehension')
  async comprehensionProjection(
    @Param('snapshotId') snapshotId: string,
    @Param('artifactId') artifactId: string,
    @Query('scenarioLimit') scenarioLimitRaw: string | undefined,
    @Query('scenarioOffset') scenarioOffsetRaw: string | undefined,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadSnapshot(actor, snapshotId);
    const result = await this.comprehension.execute(snapshotId, artifactId, {
      scenarioLimit: parseQueryInteger(scenarioLimitRaw), scenarioOffset: parseQueryInteger(scenarioOffsetRaw),
    });
    return codeComprehensionResponseSchema.parse(result);
  }
}

function parseQueryInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}
