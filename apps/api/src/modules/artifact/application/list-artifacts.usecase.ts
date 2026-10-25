import { AppError } from '@ba-helper/shared';
import type { PrismaService, ArtifactRepository } from "@ba-helper/backend-runtime";

const PRODUCTION_ARTIFACT_TYPES = ['CONTROLLER', 'API_ROUTE', 'SERVICE', 'SERVICE_METHOD', 'ENTITY'];

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

  async search(snapshotId: string, options: { limit?: number; offset?: number; search?: string; productionOnly?: boolean }) {
    const snapshot = await this.prisma.repositorySnapshot.findUnique({ where: { id: snapshotId }, select: { id: true } });
    if (!snapshot) throw new AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found.');
    return this.repository.searchBySnapshot(snapshotId, {
      limit: options.limit ?? 50, offset: options.offset ?? 0, search: options.search,
      artifactTypes: options.productionOnly ? PRODUCTION_ARTIFACT_TYPES : undefined,
    });
  }
}
