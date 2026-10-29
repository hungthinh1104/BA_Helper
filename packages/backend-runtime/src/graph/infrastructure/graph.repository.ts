import type { DependencyEdgeType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';

type GraphPrismaClient = PrismaService | Prisma.TransactionClient;

export type PersistedDependencyEdgeInput = {
  snapshotId: string;
  fromArtifactId: string;
  toArtifactId: string;
  type: DependencyEdgeType;
  confidence?: number;
  metadata?: Prisma.InputJsonValue;
};

export class GraphRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listBySnapshot(snapshotId: string) {
    return this.prisma.dependencyEdge.findMany({
      where: snapshotScopedEdgeWhere(snapshotId),
    });
  }

  async listIncomingBySnapshotAndTargets(
    snapshotId: string,
    targetArtifactIds: string[],
    types: DependencyEdgeType[] = ['CALLS', 'TESTS'],
    take?: number,
  ) {
    if (targetArtifactIds.length === 0 || types.length === 0) return [];
    const boundedTake = normalizeTake(take);
    return this.prisma.dependencyEdge.findMany({
      where: {
        ...snapshotScopedEdgeWhere(snapshotId),
        toArtifactId: { in: [...new Set(targetArtifactIds)] },
        type: { in: types },
      },
      orderBy: [{ toArtifactId: 'asc' }, { fromArtifactId: 'asc' }, { id: 'asc' }],
      ...(boundedTake ? { take: boundedTake } : {}),
    });
  }

  async listOutgoingBySnapshotAndSources(
    snapshotId: string,
    sourceArtifactIds: string[],
    types?: DependencyEdgeType[],
    take?: number,
  ) {
    if (sourceArtifactIds.length === 0 || types?.length === 0) return [];
    const boundedTake = normalizeTake(take);
    return this.prisma.dependencyEdge.findMany({
      where: {
        ...snapshotScopedEdgeWhere(snapshotId),
        fromArtifactId: { in: [...new Set(sourceArtifactIds)] },
        ...(types ? { type: { in: types } } : {}),
      },
      orderBy: [{ fromArtifactId: 'asc' }, { toArtifactId: 'asc' }, { id: 'asc' }],
      ...(boundedTake ? { take: boundedTake } : {}),
    });
  }

  async listIncomingTestSourceIds(snapshotId: string, targetArtifactIds: string[], afterId: string | undefined, take: number): Promise<string[]> {
    if (targetArtifactIds.length === 0) return [];
    const rows = await this.prisma.dependencyEdge.groupBy({
      by: ['fromArtifactId'],
      where: { ...snapshotScopedEdgeWhere(snapshotId), type: 'TESTS', toArtifactId: { in: [...new Set(targetArtifactIds)] },
        ...(afterId ? { fromArtifactId: { gt: afterId } } : {}) },
      orderBy: { fromArtifactId: 'asc' },
      take: normalizeTake(take) ?? 1,
    });
    return rows.map(row => row.fromArtifactId);
  }

  async listTestEdgesBySourcesAndTargets(snapshotId: string, sourceArtifactIds: string[], targetArtifactIds: string[]) {
    if (sourceArtifactIds.length === 0 || targetArtifactIds.length === 0) return [];
    const sources = [...new Set(sourceArtifactIds)];
    const targets = [...new Set(targetArtifactIds)];
    return this.prisma.dependencyEdge.findMany({
      where: { ...snapshotScopedEdgeWhere(snapshotId), type: 'TESTS', fromArtifactId: { in: sources }, toArtifactId: { in: targets } },
      orderBy: [{ fromArtifactId: 'asc' }, { toArtifactId: 'asc' }, { id: 'asc' }],
      take: sources.length * targets.length,
    });
  }

  async expandFromSeeds(snapshotId: string, seedArtifactIds: string[]): Promise<string[]> {
    if (seedArtifactIds.length === 0) return [];

    const edges = await this.prisma.dependencyEdge.findMany({
      where: {
        ...snapshotScopedEdgeWhere(snapshotId),
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

  async createDependencyEdges(edges: PersistedDependencyEdgeInput[], client: GraphPrismaClient = this.prisma): Promise<void> {
    if (!edges || edges.length === 0) {
      return;
    }

    await client.dependencyEdge.createMany({
      data: edges,
      skipDuplicates: true,
    });
  }
}

function normalizeTake(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const take = Math.trunc(value);
  return take > 0 ? take : undefined;
}

function snapshotScopedEdgeWhere(snapshotId: string) {
  return {
    snapshotId,
    fromArtifact: { snapshotId },
    toArtifact: { snapshotId },
  };
}
