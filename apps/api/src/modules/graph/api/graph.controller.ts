import { Controller, Get, Param } from '@nestjs/common';
import { graphResponseSchema, RequestUser } from '@ba-helper/contracts';
import { GetGraphUseCase } from '../application/get-graph.usecase';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1')
export class GraphController {
  constructor(
    private readonly getGraph: GetGraphUseCase,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/snapshots/:snapshotId/graph')
  async get(
    @Param('snapshotId') snapshotId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadSnapshot(actor, snapshotId);
    const edges = await this.getGraph.execute(snapshotId);
    const mapped = edges.map((edge: {
      id: string;
      fromArtifactId: string;
      toArtifactId: string;
      type: string;
    }) => ({
      id: edge.id,
      fromArtifactId: edge.fromArtifactId,
      toArtifactId: edge.toArtifactId,
      type: edge.type,
    }));

    return graphResponseSchema.parse({ edges: mapped });
  }
}
