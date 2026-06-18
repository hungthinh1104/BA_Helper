import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export type SimilarChunk = {
  id: string;
  artifactId: string | null;
  filePath: string;
  symbolName: string | null;
  artifactType: string;
  content: string;
  similarity: number;
};

@Injectable()
export class EmbeddingChunkRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertMany(
    chunks: Array<{
      tenantId: string;
      projectId: string;
      repositoryId: string;
      snapshotId: string;
      artifactId: string | null;
      stableChunkId: string;
      commitSha: string;
      filePath: string;
      symbolName: string | null;
      artifactType: string;
      content: string;
      contentHash: string;
      tokenCount: number;
      chunkerVersion: string | null;
      embeddingProfileId: string;
      embeddingProvider: string;
      embeddingModel: string;
      embeddingDimensions: number;
      embeddingConfigHash: string;
      embedding: number[];
    }>,
  ): Promise<void> {
    if (chunks.length === 0) return;

    for (const chunk of chunks) {
      const vectorStr = `[${chunk.embedding.join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO "EmbeddingChunk" (
          id, "tenantId", "projectId", "repositoryId", "snapshotId", "artifactId",
          "stableChunkId", "commitSha", "filePath", "symbolName", "artifactType",
          content, "contentHash", "tokenCount", "chunkerVersion",
          "embeddingProfileId", "embeddingProvider", "embeddingModel",
          "embeddingDimensions", "embeddingConfigHash", embedding, "createdAt"
        ) VALUES (
          gen_random_uuid(),
          ${chunk.tenantId}::uuid, ${chunk.projectId}::uuid,
          ${chunk.repositoryId}::uuid, ${chunk.snapshotId}::uuid,
          ${chunk.artifactId ? Prisma.sql`${chunk.artifactId}::uuid` : Prisma.sql`NULL`},
          ${chunk.stableChunkId}, ${chunk.commitSha},
          ${chunk.filePath}, ${chunk.symbolName}, ${chunk.artifactType},
          ${chunk.content}, ${chunk.contentHash}, ${chunk.tokenCount},
          ${chunk.chunkerVersion ?? null}, ${chunk.embeddingProfileId},
          ${chunk.embeddingProvider}, ${chunk.embeddingModel},
          ${chunk.embeddingDimensions}, ${chunk.embeddingConfigHash},
          ${vectorStr}::vector, NOW()
        )
        ON CONFLICT ("snapshotId", "stableChunkId", "embeddingProfileId")
        DO UPDATE SET
          "content" = EXCLUDED."content",
          "contentHash" = EXCLUDED."contentHash",
          "tokenCount" = EXCLUDED."tokenCount",
          "embedding" = EXCLUDED."embedding",
          "artifactId" = EXCLUDED."artifactId",
          "filePath" = EXCLUDED."filePath",
          "symbolName" = EXCLUDED."symbolName",
          "artifactType" = EXCLUDED."artifactType",
          "commitSha" = EXCLUDED."commitSha",
          "embeddingProvider" = EXCLUDED."embeddingProvider",
          "embeddingModel" = EXCLUDED."embeddingModel",
          "embeddingDimensions" = EXCLUDED."embeddingDimensions",
          "embeddingConfigHash" = EXCLUDED."embeddingConfigHash"
          -- NOTE: chunkerVersion is intentionally excluded from DO UPDATE
          -- so re-runs never silently change the version recorded at creation time.
      `;
    }
  }

  async searchSimilar(params: {
    tenantId: string;
    projectId: string;
    repositoryId: string;
    snapshotId: string;
    queryEmbedding: number[];
    limit?: number;
    artifactTypes?: string[];
  }): Promise<SimilarChunk[]> {
    const vectorStr = `[${params.queryEmbedding.join(',')}]`;
    const limit = params.limit ?? 20;

    if (params.artifactTypes && params.artifactTypes.length > 0) {
      return this.prisma.$queryRaw<SimilarChunk[]>`
        SELECT id, "artifactId", "filePath", "symbolName", "artifactType",
               content, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
        FROM "EmbeddingChunk"
        WHERE "tenantId"     = ${params.tenantId}
          AND "projectId"    = ${params.projectId}
          AND "repositoryId" = ${params.repositoryId}
          AND "snapshotId"   = ${params.snapshotId}
          AND "artifactType" = ANY(${params.artifactTypes})
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `;
    }

    return this.prisma.$queryRaw<SimilarChunk[]>`
      SELECT id, "artifactId", "filePath", "symbolName", "artifactType",
             content, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM "EmbeddingChunk"
      WHERE "tenantId"     = ${params.tenantId}
        AND "projectId"    = ${params.projectId}
        AND "repositoryId" = ${params.repositoryId}
        AND "snapshotId"   = ${params.snapshotId}
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;
  }

  async listBySnapshot(snapshotId: string, embeddingProfileId: string) {
    return this.prisma.embeddingChunk.findMany({
      where: { snapshotId, embeddingProfileId },
      select: {
        stableChunkId: true,
        contentHash: true,
        artifactId: true,
        chunkerVersion: true,
        embeddingProfileId: true,
        embeddingConfigHash: true,
      },
    });
  }

  async deleteBySnapshot(snapshotId: string) {
    return this.prisma.embeddingChunk.deleteMany({
      where: { snapshotId },
    });
  }

  async deleteByRepository(repositoryId: string) {
    return this.prisma.embeddingChunk.deleteMany({
      where: { repositoryId },
    });
  }

  async deleteByArtifact(artifactId: string) {
    return this.prisma.embeddingChunk.deleteMany({
      where: { artifactId },
    });
  }

  /**
   * Returns chunk metadata (no vector) for a set of artifact IDs in a given snapshot.
   * Used at embed-time to determine which previous-snapshot chunks are reuse-eligible.
   */
  async listForReuseByArtifacts(params: {
    snapshotId: string;
    artifactIds: string[];
    embeddingProfileId: string;
    chunkerVersion: string;
  }): Promise<
    Array<{
      artifactId: string;
      contentHash: string;
      chunkerVersion: string | null;
      embeddingProfileId: string | null;
      embeddingConfigHash: string | null;
    }>
  > {
    if (params.artifactIds.length === 0) return [];
    return this.prisma.embeddingChunk.findMany({
      where: {
        snapshotId: params.snapshotId,
        artifactId: { in: params.artifactIds },
        embeddingProfileId: params.embeddingProfileId,
        chunkerVersion: params.chunkerVersion,
      },
      select: {
        artifactId: true,
        contentHash: true,
        chunkerVersion: true,
        embeddingProfileId: true,
        embeddingConfigHash: true,
      },
    }) as Promise<
      Array<{
        artifactId: string;
        contentHash: string;
        chunkerVersion: string | null;
        embeddingProfileId: string | null;
        embeddingConfigHash: string | null;
      }>
    >;
  }

  /**
   * Copies the embedding vector from a previous snapshot's chunk into a new snapshot-scoped row.
   * The SELECT reads the vector entirely inside PostgreSQL — it never leaves the DB.
   * All identifying fields (snapshotId, artifactId, stableChunkId) are the NEW snapshot's values.
   * Content is provided by the caller (current built content, whose hash must match).
   * Returns true if a source chunk was found and the row was inserted; false if no source exists.
   */
  async copyChunk(params: {
    baseSnapshotId: string;
    oldArtifactId: string;
    embeddingProfileId: string;
    embeddingProvider: string;
    embeddingModel: string;
    embeddingDimensions: number;
    embeddingConfigHash: string;
    chunkerVersion: string;
    contentHash: string;
    // New row fields
    tenantId: string;
    projectId: string;
    repositoryId: string;
    targetSnapshotId: string;
    newArtifactId: string;
    newStableChunkId: string;
    commitSha: string;
    filePath: string;
    symbolName: string | null;
    artifactType: string;
    content: string;
    tokenCount: number;
  }): Promise<boolean> {
    const result = await this.prisma.$executeRaw`
      INSERT INTO "EmbeddingChunk" (
        id, "tenantId", "projectId", "repositoryId", "snapshotId", "artifactId",
        "stableChunkId", "commitSha", "filePath", "symbolName", "artifactType",
        content, "contentHash", "tokenCount", "chunkerVersion",
        "embeddingProfileId", "embeddingProvider", "embeddingModel",
        "embeddingDimensions", "embeddingConfigHash", embedding, "createdAt"
      )
      SELECT
        gen_random_uuid(),
        ${params.tenantId}::uuid, ${params.projectId}::uuid,
        ${params.repositoryId}::uuid, ${params.targetSnapshotId}::uuid,
        ${params.newArtifactId}::uuid,
        ${params.newStableChunkId}, ${params.commitSha},
        ${params.filePath}, ${params.symbolName}, ${params.artifactType},
        ${params.content}, ${params.contentHash}, ${params.tokenCount},
        ${params.chunkerVersion}, ${params.embeddingProfileId},
        ${params.embeddingProvider}, ${params.embeddingModel},
        ${params.embeddingDimensions}, ${params.embeddingConfigHash},
        embedding, NOW()
      FROM "EmbeddingChunk"
      WHERE "snapshotId"   = ${params.baseSnapshotId}::uuid
        AND "artifactId"   = ${params.oldArtifactId}::uuid
        AND "embeddingProfileId" = ${params.embeddingProfileId}
        AND "embeddingModel" = ${params.embeddingModel}
        AND "embeddingConfigHash" = ${params.embeddingConfigHash}
        AND "chunkerVersion" = ${params.chunkerVersion}
        AND "contentHash"  = ${params.contentHash}
      LIMIT 1
      ON CONFLICT ("snapshotId", "stableChunkId", "embeddingProfileId") DO NOTHING
    `;
    return result > 0;
  }
}
