import type { RepositorySnapshotListResponse } from '@ba-helper/contracts';
import { PrismaService } from "@ba-helper/backend-runtime";
import { readScannerVersion } from './scanner-version.reader';

export class ListRepositorySnapshotsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(params: {
    projectId: string;
    repositoryId: string;
    limit?: number;
  }): Promise<RepositorySnapshotListResponse> {
    const limit = Math.max(1, Math.min(params.limit || 20, 50));

    const snapshots = await this.prisma.repositorySnapshot.findMany({
      where: {
        repositoryId: params.repositoryId,
        repository: { projectId: params.projectId },
        coverageStatus: { in: ['READY', 'PARTIAL'] },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: limit,
      include: {
        profile: true,
        _count: {
          select: { artifacts: true },
        },
      },
    });

    return {
      items: snapshots.map((s) => ({
        id: s.id,
        commitSha: s.commitSha,
        createdAt: s.createdAt.toISOString(),
        coverageStatus: s.coverageStatus,
        analyzerVersion: s.analyzerVersion,
        scannerVersion: readScannerVersion(s.diagnostics),
        profileVersion: s.profile?.profileVersion,
        artifactCount: s._count.artifacts,
      })),
    };
  }
}
