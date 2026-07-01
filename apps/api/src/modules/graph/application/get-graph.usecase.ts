import { AppError } from '@ba-helper/shared';
import { PrismaService, GraphRepository } from "@ba-helper/backend-runtime";

export class GetGraphUseCase {
  constructor(
    private readonly repository: GraphRepository,
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
