import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { EmbeddingChunkRepository } from '../infrastructure/embedding-chunk.repository';
import { EmbeddingProvider } from '../domain/embedding-provider.interface';
import { EmbeddingPolicy } from '../domain/embedding.policy';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmbedSnapshotArtifactsUseCase {
  constructor(
    private readonly artifactRepo: ArtifactRepository,
    private readonly chunkRepo: EmbeddingChunkRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: { snapshotId: string }) {
    // 1. Get the snapshot details to get projectId and repositoryId
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: params.snapshotId },
      include: { repository: true },
    });

    if (!snapshot) {
      throw new AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found');
    }

    const projectId = snapshot.repository.projectId;
    const repositoryId = snapshot.repositoryId;
    const commitSha = snapshot.commitSha;

    // Update status to indexing
    await this.prisma.repositorySnapshot.update({
      where: { id: snapshot.id },
      data: { indexStatus: 'VECTOR_INDEXING' },
    });

    try {
      // 2. Get all artifacts for this snapshot
      const artifacts = await this.artifactRepo.listBySnapshot(params.snapshotId);
      
      if (artifacts.length === 0) {
        // Nothing to embed
        await this.prisma.repositorySnapshot.update({
          where: { id: snapshot.id },
          data: { indexStatus: 'VECTOR_READY' },
        });
        return;
      }

      // 3. Get existing chunks for this snapshot to check cache
      const existingChunks = await this.chunkRepo.listBySnapshot(
        params.snapshotId,
        this.embeddingProvider.providerName
      );
      // Build a map of stableChunkId -> contentHash for fast cache lookup
      const existingByStableId = new Map<string, string>(
        existingChunks.map((c: any) => [c.stableChunkId, c.contentHash]),
      );

      // 4. Prepare artifacts for embedding
      const itemsToProcess = artifacts.map(artifact => {
        const content = EmbeddingPolicy.buildArtifactContent(artifact);
        const contentHash = EmbeddingPolicy.computeContentHash(content);
        const stableChunkId = `artifact:${artifact.artifactKey}:${contentHash}`;
        return { artifact, content, contentHash, stableChunkId };
      });

      // Filter: skip artifacts whose stableChunkId+contentHash already exists for this model
      const itemsToEmbed = itemsToProcess.filter(
        item => existingByStableId.get(item.stableChunkId) !== item.contentHash,
      );

      if (itemsToEmbed.length > 0) {
        // 5. Redact secrets
        const redactedItems = itemsToEmbed.map(item => ({
          ...item,
          redactedContent: EmbeddingPolicy.redactForEmbedding(item.content),
        }));

        // 6. Embed in batches (or let provider handle it, but here we pass all at once to provider)
        // Note: For very large repos, you might need to chunk `redactedItems` into batches of ~1000 before sending to provider.
        // For MVP, we send all at once.
        const result = await this.embeddingProvider.embed({
          texts: redactedItems.map(item => item.redactedContent),
        });

        // 7. Insert new chunks
        const chunksToInsert = redactedItems.map((item, index) => ({
          tenantId: projectId,   // MVP: tenantId = projectId; future = organizationId
          projectId,
          repositoryId,
          snapshotId: params.snapshotId,
          artifactId: item.artifact.id,
          stableChunkId: item.stableChunkId,
          commitSha,
          filePath: item.artifact.filePath,
          symbolName: item.artifact.name,
          artifactType: item.artifact.artifactType,
          content: item.redactedContent,
          contentHash: item.contentHash,
          tokenCount: EmbeddingPolicy.estimateTokenCount(item.redactedContent),
          embeddingModel: result.model,
          embedding: result.embeddings[index],
        }));

        await this.chunkRepo.insertMany(chunksToInsert);
      }

      // Update status to ready
      await this.prisma.repositorySnapshot.update({
        where: { id: snapshot.id },
        data: { indexStatus: 'VECTOR_READY' },
      });

    } catch (error) {
      // Update status to failed
      await this.prisma.repositorySnapshot.update({
        where: { id: snapshot.id },
        data: { indexStatus: 'VECTOR_FAILED' },
      });
      throw error;
    }
  }
}
