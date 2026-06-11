import { Controller, Get, Param } from '@nestjs/common';
import { artifactListResponseSchema } from '@ba-helper/contracts';
import { ListArtifactsUseCase } from '../application/list-artifacts.usecase';

@Controller('/api/v1')
export class ArtifactController {
  constructor(private readonly listArtifacts: ListArtifactsUseCase) {}

  @Get('/snapshots/:snapshotId/artifacts')
  async list(@Param('snapshotId') snapshotId: string) {
    const items = await this.listArtifacts.execute(snapshotId);
    const mapped = items.map((artifact: {
      id: string;
      artifactKey: string;
      name: string;
      artifactType: string;
      filePath: string;
      startLine: number | null;
      endLine: number | null;
      language: string | null;
    }) => ({
      id: artifact.id,
      artifactKey: artifact.artifactKey,
      name: artifact.name,
      artifactType: artifact.artifactType,
      filePath: artifact.filePath,
      startLine: artifact.startLine,
      endLine: artifact.endLine,
      language: artifact.language,
    }));

    return artifactListResponseSchema.parse({ items: mapped });
  }
}
