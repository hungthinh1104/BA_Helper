import type { PrismaService } from '../../../apps/api/src/modules/prisma/prisma.service';

export type RagExportSnapshotMetadata = {
  snapshotId: string;
  repositoryId: string;
  projectId: string;
  repositoryCanonicalUrl: string;
  commitSha: string;
  analyzerVersion: string;
  coverageStatus: string;
  indexStatus: string;
  createdAt: string;
};

export type RagExportEmbeddingState = {
  chunkCount: number;
  embeddingProfileIds: string[];
  embeddingProviders: string[];
  embeddingModels: string[];
  embeddingDimensions: number[];
  embeddingConfigHashes: string[];
  chunkerVersions: string[];
  profiles: Array<{
    embeddingProfileId: string;
    embeddingProvider: string | null;
    embeddingModel: string | null;
    embeddingDimensions: number | null;
    embeddingConfigHash: string | null;
    chunkCount: number;
  }>;
};

export async function readSnapshotMetadata(params: {
  prisma: PrismaService;
  snapshotId: string;
}) {
  return params.prisma.repositorySnapshot.findUnique({
    where: { id: params.snapshotId },
    include: {
      repository: {
        select: {
          id: true,
          projectId: true,
          canonicalUrl: true,
        },
      },
    },
  });
}

export async function readArtifactEvidenceExcerpt(params: {
  prisma: PrismaService;
  snapshotId: string;
  artifactId: string;
}): Promise<string | undefined> {
  const evidence = await params.prisma.evidence.findFirst({
    where: {
      snapshotId: params.snapshotId,
      artifactId: params.artifactId,
    },
    orderBy: [{ endLine: 'desc' }, { startLine: 'asc' }, { createdAt: 'asc' }],
    select: {
      excerpt: true,
    },
  });

  return evidence?.excerpt ?? undefined;
}

export async function readEmbeddingState(params: {
  prisma: PrismaService;
  snapshotId: string;
}): Promise<RagExportEmbeddingState> {
  const rows = await params.prisma.embeddingChunk.findMany({
    where: {
      snapshotId: params.snapshotId,
    },
    select: {
      embeddingProfileId: true,
      embeddingProvider: true,
      embeddingModel: true,
      embeddingDimensions: true,
      embeddingConfigHash: true,
      chunkerVersion: true,
    },
  });

  const profileMap = new Map<
    string,
    {
      embeddingProfileId: string;
      embeddingProvider: string | null;
      embeddingModel: string | null;
      embeddingDimensions: number | null;
      embeddingConfigHash: string | null;
      chunkCount: number;
    }
  >();

  for (const row of rows) {
    if (!row.embeddingProfileId) {
      continue;
    }

    const existing = profileMap.get(row.embeddingProfileId);
    if (existing) {
      existing.chunkCount += 1;
    } else {
      profileMap.set(row.embeddingProfileId, {
        embeddingProfileId: row.embeddingProfileId,
        embeddingProvider: row.embeddingProvider,
        embeddingModel: row.embeddingModel,
        embeddingDimensions: row.embeddingDimensions,
        embeddingConfigHash: row.embeddingConfigHash,
        chunkCount: 1,
      });
    }
  }

  return {
    chunkCount: rows.length,
    embeddingProfileIds: Array.from(
      new Set(rows.map((row) => row.embeddingProfileId).filter(Boolean)),
    ).sort() as string[],
    embeddingProviders: Array.from(
      new Set(rows.map((row) => row.embeddingProvider).filter(Boolean)),
    ).sort() as string[],
    embeddingModels: Array.from(
      new Set(rows.map((row) => row.embeddingModel).filter(Boolean)),
    ).sort(),
    embeddingDimensions: Array.from(
      new Set(
        rows
          .map((row) => row.embeddingDimensions)
          .filter((value): value is number => typeof value === 'number'),
      ),
    ).sort((a, b) => a - b),
    embeddingConfigHashes: Array.from(
      new Set(rows.map((row) => row.embeddingConfigHash).filter(Boolean)),
    ).sort() as string[],
    chunkerVersions: Array.from(
      new Set(
        rows
          .map((row) => row.chunkerVersion)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort(),
    profiles: Array.from(profileMap.values()).sort((a, b) =>
      a.embeddingProfileId.localeCompare(b.embeddingProfileId),
    ),
  };
}

export function mapSnapshotMetadata(snapshot: {
  id: string;
  repositoryId: string;
  repository: { projectId: string; canonicalUrl: string };
  commitSha: string;
  analyzerVersion: string;
  coverageStatus: string;
  indexStatus: string;
  createdAt: Date;
}): RagExportSnapshotMetadata {
  return {
    snapshotId: snapshot.id,
    repositoryId: snapshot.repositoryId,
    projectId: snapshot.repository.projectId,
    repositoryCanonicalUrl: snapshot.repository.canonicalUrl,
    commitSha: snapshot.commitSha,
    analyzerVersion: snapshot.analyzerVersion,
    coverageStatus: snapshot.coverageStatus,
    indexStatus: snapshot.indexStatus,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
