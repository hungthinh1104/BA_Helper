import { AppError } from '@ba-helper/shared';
import { PrismaService, ArtifactRepository } from "@ba-helper/backend-runtime";

export class ListArtifactsUseCase {
  constructor(
    private readonly repository: ArtifactRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(snapshotId: string) {
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) {
      throw new AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found.');
    }

    return this.repository.listBySnapshot(snapshotId);
  }
}
