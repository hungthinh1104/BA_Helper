import { PrismaService } from '../../prisma/prisma.service';

export class GraphRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBySnapshot(snapshotId: string) {
    return this.prisma.dependencyEdge.findMany({
      where: { snapshotId },
    });
  }

  async expandFromSeeds(snapshotId: string, seedArtifactIds: string[]): Promise<string[]> {
    if (seedArtifactIds.length === 0) return [];

    const edges = await this.prisma.dependencyEdge.findMany({
      where: {
        snapshotId,
        OR: [
          { fromArtifactId: { in: seedArtifactIds } },
          { toArtifactId: { in: seedArtifactIds } },
        ],
      },
    });

    const expandedIds = new Set<string>();
    for (const edge of edges) {
      if (edge.fromArtifactId) expandedIds.add(edge.fromArtifactId);
      if (edge.toArtifactId) expandedIds.add(edge.toArtifactId);
    }
    
    // Remove seeds from result if desired, or keep them
    // Returning just the expansion or the whole set
    return Array.from(expandedIds);
  }
}
