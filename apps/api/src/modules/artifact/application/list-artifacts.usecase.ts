import { ArtifactRepository } from '../infrastructure/artifact.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { AppError } from '../../../shared/app-error';

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
