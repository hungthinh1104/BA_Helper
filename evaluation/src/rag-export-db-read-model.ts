import type { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';

export type RagExportSnapshotMetadata = {
  snapshotId: string;
  repositoryId: string;
  projectId: string;
  commitSha: string;
  analyzerVersion: string;
  coverageStatus: string;
  indexStatus: string;
  createdAt: string;
};

export type RagExportEmbeddingState = {
  chunkCount: number;
  embeddingModels: string[];
  chunkerVersions: string[];
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
      embeddingModel: true,
      chunkerVersion: true,
    },
  });

  return {
    chunkCount: rows.length,
    embeddingModels: Array.from(
      new Set(rows.map((row) => row.embeddingModel).filter(Boolean)),
    ).sort(),
    chunkerVersions: Array.from(
      new Set(
        rows
          .map((row) => row.chunkerVersion)
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort(),
  };
}

export function mapSnapshotMetadata(snapshot: {
  id: string;
  repositoryId: string;
  repository: { projectId: string };
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
    commitSha: snapshot.commitSha,
    analyzerVersion: snapshot.analyzerVersion,
    coverageStatus: snapshot.coverageStatus,
    indexStatus: snapshot.indexStatus,
    createdAt: snapshot.createdAt.toISOString(),
  };
}
