import type { PrismaService } from '../../prisma/prisma.service';
import type { RepositorySnapshotListResponse } from '@ba-helper/contracts';

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
        scannerVersion: (s.profile as any)?.scannerVersion || undefined, // scannerVersion typically isn't in profile but keeping per prompt
        profileVersion: s.profile?.profileVersion,
        artifactCount: s._count.artifacts,
      })),
    };
  }
}
