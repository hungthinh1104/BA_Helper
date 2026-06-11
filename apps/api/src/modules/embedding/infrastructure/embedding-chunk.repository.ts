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
      embeddingModel: string;
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
          content, "contentHash", "tokenCount", "embeddingModel",
          embedding, "createdAt"
        ) VALUES (
          gen_random_uuid(),
          ${chunk.tenantId}::uuid, ${chunk.projectId}::uuid,
          ${chunk.repositoryId}::uuid, ${chunk.snapshotId}::uuid,
          ${chunk.artifactId ? Prisma.sql`${chunk.artifactId}::uuid` : Prisma.sql`NULL`},
          ${chunk.stableChunkId}, ${chunk.commitSha},
          ${chunk.filePath}, ${chunk.symbolName}, ${chunk.artifactType},
          ${chunk.content}, ${chunk.contentHash}, ${chunk.tokenCount},
          ${chunk.embeddingModel}, ${vectorStr}::vector, NOW()
        )
        ON CONFLICT ("snapshotId", "stableChunkId", "embeddingModel")
        DO NOTHING
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
        WHERE "tenantId"     = ${params.tenantId}::uuid
          AND "projectId"    = ${params.projectId}::uuid
          AND "repositoryId" = ${params.repositoryId}::uuid
          AND "snapshotId"   = ${params.snapshotId}::uuid
          AND "artifactType" = ANY(${params.artifactTypes})
        ORDER BY embedding <=> ${vectorStr}::vector
        LIMIT ${limit}
      `;
    }

    return this.prisma.$queryRaw<SimilarChunk[]>`
      SELECT id, "artifactId", "filePath", "symbolName", "artifactType",
             content, 1 - (embedding <=> ${vectorStr}::vector) AS similarity
      FROM "EmbeddingChunk"
      WHERE "tenantId"     = ${params.tenantId}::uuid
        AND "projectId"    = ${params.projectId}::uuid
        AND "repositoryId" = ${params.repositoryId}::uuid
        AND "snapshotId"   = ${params.snapshotId}::uuid
      ORDER BY embedding <=> ${vectorStr}::vector
      LIMIT ${limit}
    `;
  }

  async listBySnapshot(snapshotId: string, embeddingModel: string) {
    return this.prisma.embeddingChunk.findMany({
      where: { snapshotId, embeddingModel },
      select: { stableChunkId: true, contentHash: true, artifactId: true },
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
}
