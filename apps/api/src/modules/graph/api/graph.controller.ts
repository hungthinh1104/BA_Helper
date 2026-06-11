import { Controller, Get, Param } from '@nestjs/common';
import { graphResponseSchema } from '@ba-helper/contracts';
import { GetGraphUseCase } from '../application/get-graph.usecase';

@Controller('/api/v1')
export class GraphController {
  constructor(private readonly getGraph: GetGraphUseCase) {}

  @Get('/snapshots/:snapshotId/graph')
  async get(@Param('snapshotId') snapshotId: string) {
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
