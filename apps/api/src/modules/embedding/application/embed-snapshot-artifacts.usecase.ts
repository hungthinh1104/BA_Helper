import { Injectable } from '@nestjs/common';
import { AppError } from '../../../shared/app-error';
import { ArtifactRepository } from '../../artifact/infrastructure/artifact.repository';
import { EmbeddingChunkRepository } from '../infrastructure/embedding-chunk.repository';
import { EmbeddingProvider } from '../domain/embedding-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ArtifactChunkBuilder } from '../domain/artifact-chunk.builder';
import { createHash } from 'node:crypto';
import { AiPolicy } from '../../ai/domain/ai.policy';

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
      // 2. Get all artifacts and their evidences for this snapshot
      const artifacts = await this.prisma.codeArtifact.findMany({
        where: { snapshotId: params.snapshotId },
        include: { evidences: true },
      });
      
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

      // 4. Prepare artifacts for embedding using the Builder
      const itemsToProcess = artifacts.map((artifact) => {
        const builtChunk = ArtifactChunkBuilder.build({
          artifact,
          evidence: artifact.evidences,
        });
        
        const contentHash = createHash('sha256').update(builtChunk.content).digest('hex');
        
        return { 
          artifact, 
          content: builtChunk.content, 
          contentHash, 
          stableChunkId: builtChunk.stableChunkId,
          chunkType: builtChunk.chunkType
        };
      });

      // Filter: skip artifacts whose stableChunkId+contentHash already exists for this model
      const itemsToEmbed = itemsToProcess.filter(
        item => existingByStableId.get(item.stableChunkId) !== item.contentHash,
      );

      if (itemsToEmbed.length > 0) {
        // 5. Redact secrets
        const redactedItems = itemsToEmbed.map(item => ({
          ...item,
          redactedContent: AiPolicy.redactPayload(item.content).redactedPayload,
        }));

        // 6. Embed in batches
        const result = await this.embeddingProvider.embed({
          texts: redactedItems.map(item => item.redactedContent),
        });

        // 7. Insert new chunks
        const chunksToInsert = redactedItems.map((item, index) => ({
          tenantId: projectId,
          projectId,
          repositoryId,
          snapshotId: params.snapshotId,
          artifactId: item.artifact.id,
          stableChunkId: item.stableChunkId,
          commitSha,
          filePath: item.artifact.filePath,
          symbolName: item.artifact.name,
          artifactType: item.chunkType, // Use the mapped chunkType
          content: item.redactedContent,
          contentHash: item.contentHash,
          tokenCount: Math.ceil(item.redactedContent.length / 4), // rough estimate
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
