import { Injectable } from '@nestjs/common';
import { AppError } from '@ba-helper/shared';
import { EmbeddingChunkRepository } from '../infrastructure/embedding-chunk.repository';
import { EmbeddingProvider } from '../domain/embedding-provider.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ArtifactChunkBuilder, CHUNK_BUILDER_VERSION } from '../domain/artifact-chunk.builder';
import { matchChunksForReuse, CurrentChunkItem, MatchResult } from '../domain/embedding-reuse-matcher';
import { createHash } from 'node:crypto';
import { AiPolicy } from '@ba-helper/shared';
import type {
  DiagnosticItem,
  EmbeddingReusePlanPayload,
  EmbeddingReuseExecutionSummaryPayload,
} from '@ba-helper/contracts';

const SAMPLE_LIMIT = 20 as const;

@Injectable()
export class EmbedSnapshotArtifactsUseCase {
  constructor(
    private readonly chunkRepo: EmbeddingChunkRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly prisma: PrismaService,
  ) {}

  async execute(params: { snapshotId: string }): Promise<void> {
    const snapshot = await this.prisma.repositorySnapshot.findUnique({
      where: { id: params.snapshotId },
      include: { repository: true },
    });
    if (!snapshot) throw new AppError('SNAPSHOT_NOT_FOUND', 'Snapshot not found');

    const { projectId } = snapshot.repository;
    const { repositoryId, commitSha } = snapshot;

    await this.prisma.repositorySnapshot.update({
      where: { id: snapshot.id },
      data: { indexStatus: 'VECTOR_INDEXING' },
    });

    try {
      const artifacts = await this.prisma.codeArtifact.findMany({
        where: { snapshotId: params.snapshotId },
        include: { evidences: true },
      });

      if (artifacts.length === 0) {
        await this.prisma.repositorySnapshot.update({
          where: { id: snapshot.id },
          data: { indexStatus: 'VECTOR_READY' },
        });
        return;
      }

      // Idempotency guard: skip chunks already persisted for this snapshot
      const existingChunks = await this.chunkRepo.listBySnapshot(
        params.snapshotId,
        this.embeddingProvider.providerName,
      );
      const existingByStableId = new Map<string, string>(
        existingChunks.map((c) => [c.stableChunkId, c.contentHash]),
      );

      // Build all chunks from current artifacts
      const allItems: CurrentChunkItem[] = artifacts.map((artifact) => {
        const built = ArtifactChunkBuilder.build({ artifact, evidence: artifact.evidences });
        const contentHash = createHash('sha256').update(built.content).digest('hex');
        return {
          artifactKey: artifact.artifactKey,
          artifactId: artifact.id,
          filePath: artifact.filePath,
          symbolName: artifact.name,
          artifactType: artifact.artifactType,
          chunkType: built.chunkType,
          stableChunkId: built.stableChunkId,
          content: built.content,
          contentHash,
          chunkerVersion: built.chunkerVersion,
        };
      });

      // Remove already-persisted chunks (idempotent re-run)
      const needsProcessing = allItems.filter(
        (i) => existingByStableId.get(i.stableChunkId) !== i.contentHash,
      );
      if (needsProcessing.length === 0) {
        await this.prisma.repositorySnapshot.update({
          where: { id: snapshot.id },
          data: { indexStatus: 'VECTOR_READY' },
        });
        return;
      }

      // Load reuse plan from snapshot diagnostics
      const reusePlan = this.extractReusePlan(snapshot.diagnostics);

      let matchResult: MatchResult | null = null;
      let baseSnapshotId: string | null = reusePlan?.baseSnapshotId ?? null;

      if (reusePlan?.baseSnapshotId && reusePlan.reuseSafety !== 'VERSION_CHANGED_REVIEW_REQUIRED') {
        matchResult = await this.buildMatchResult(
          needsProcessing,
          reusePlan,
          artifacts,
        );
      }

      const toReuse = matchResult?.toReuse ?? [];
      const toGenerate = matchResult ? matchResult.toGenerate : needsProcessing;
      const matchCounts = matchResult?.counts ?? {
        missingPreviousChunkCount: 0,
        versionBlockedChunkCount: 0,
        modelMismatchChunkCount: 0,
        chunkHashMismatchCount: 0,
        legacyChunkerVersionBlockedCount: 0,
      };

      // ── 1. Copy reusable chunks (vector stays in DB) ──────────────────────
      let copiedCount = 0;
      for (const candidate of toReuse) {
        const { current, previousArtifactId } = candidate;
        const copied = await this.chunkRepo.copyChunk({
          baseSnapshotId: reusePlan!.baseSnapshotId!,
          oldArtifactId: previousArtifactId,
          embeddingModel: this.embeddingProvider.providerName,
          chunkerVersion: CHUNK_BUILDER_VERSION,
          contentHash: current.contentHash,
          tenantId: projectId,
          projectId,
          repositoryId,
          targetSnapshotId: params.snapshotId,
          newArtifactId: current.artifactId,
          newStableChunkId: current.stableChunkId,
          commitSha,
          filePath: current.filePath,
          symbolName: current.symbolName,
          artifactType: current.chunkType,
          content: current.content,
          tokenCount: Math.ceil(current.content.length / 4),
        });
        if (copied) copiedCount++;
        else toGenerate.push(current); // copy source missing → fall back to generation
      }

      // ── 2. Generate embeddings for ineligible/new/blocked items ──────────
      let generatedCount = 0;
      if (toGenerate.length > 0) {
        const redacted = toGenerate.map((item) => ({
          ...item,
          redactedContent: AiPolicy.redactPayload(item.content).redactedPayload,
        }));

        const result = await this.embeddingProvider.embed({
          texts: redacted.map((r) => r.redactedContent),
        });

        const chunksToInsert = redacted.map((item, idx) => ({
          tenantId: projectId,
          projectId,
          repositoryId,
          snapshotId: params.snapshotId,
          artifactId: item.artifactId,
          stableChunkId: item.stableChunkId,
          commitSha,
          filePath: item.filePath,
          symbolName: item.symbolName,
          artifactType: item.chunkType,
          content: item.redactedContent,
          contentHash: item.contentHash,
          tokenCount: Math.ceil(item.redactedContent.length / 4),
          chunkerVersion: item.chunkerVersion,
          embeddingModel: result.model,
          embedding: result.embeddings[idx],
        }));

        await this.chunkRepo.insertMany(chunksToInsert);
        generatedCount = chunksToInsert.length;
      }

      // ── 3. Persist execution diagnostic ──────────────────────────────────
      const blocked = matchResult?.blocked ?? [];
      const executionSummary: EmbeddingReuseExecutionSummaryPayload = {
        mode: 'SNAPSHOT_SCOPED_COPY',
        baseSnapshotId,
        targetSnapshotId: params.snapshotId,
        embeddingModel: this.embeddingProvider.providerName,
        chunkerVersion: CHUNK_BUILDER_VERSION,
        copiedChunkCount: copiedCount,
        generatedChunkCount: generatedCount,
        ineligibleChunkCount: needsProcessing.length - toReuse.length - (needsProcessing.length - toGenerate.length - toReuse.length),
        missingPreviousChunkCount: matchCounts.missingPreviousChunkCount,
        versionBlockedChunkCount: matchCounts.versionBlockedChunkCount,
        modelMismatchChunkCount: matchCounts.modelMismatchChunkCount,
        chunkHashMismatchCount: matchCounts.chunkHashMismatchCount,
        legacyChunkerVersionBlockedCount: matchCounts.legacyChunkerVersionBlockedCount,
        sampleLimit: SAMPLE_LIMIT,
        samples: {
          copied: toReuse.slice(0, SAMPLE_LIMIT).map((r) => ({
            artifactKey: r.current.artifactKey,
            filePath: r.current.filePath,
            chunkType: r.current.chunkType,
          })),
          generated: toGenerate.slice(0, SAMPLE_LIMIT).map((i) => ({
            artifactKey: i.artifactKey,
            filePath: i.filePath,
            chunkType: i.chunkType,
          })),
          blocked: blocked.slice(0, SAMPLE_LIMIT).map((b) => ({
            artifactKey: b.current.artifactKey,
            filePath: b.current.filePath,
            chunkType: b.current.chunkType,
            reason: b.reason,
          })),
        },
      };

      const existingDiagnostics = Array.isArray(snapshot.diagnostics)
        ? (snapshot.diagnostics as unknown as DiagnosticItem[])
        : [];
      const updatedDiagnostics: DiagnosticItem[] = [
        ...existingDiagnostics,
        {
          code: 'EMBEDDING_REUSE_EXECUTION_SUMMARY',
          severity: 'INFO',
          message: `Embedding complete: ${copiedCount} reused, ${generatedCount} generated`,
          category: 'SCANNER',
          payload: executionSummary as unknown as Record<string, unknown>,
        },
      ];

      await this.prisma.repositorySnapshot.update({
        where: { id: snapshot.id },
        data: {
          indexStatus: 'VECTOR_READY',
          diagnostics: updatedDiagnostics as unknown as import('@prisma/client').Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      await this.prisma.repositorySnapshot.update({
        where: { id: snapshot.id },
        data: { indexStatus: 'VECTOR_FAILED' },
      });
      throw error;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private extractReusePlan(diagnostics: unknown): EmbeddingReusePlanPayload | null {
    if (!Array.isArray(diagnostics)) return null;
    const item = (diagnostics as DiagnosticItem[]).find((d) => d.code === 'EMBEDDING_REUSE_PLAN');
    if (!item?.payload) return null;
    try {
      return item.payload as unknown as EmbeddingReusePlanPayload;
    } catch {
      return null;
    }
  }

  private async buildMatchResult(
    needsProcessing: CurrentChunkItem[],
    reusePlan: EmbeddingReusePlanPayload,
    currentArtifacts: Array<{ artifactKey: string; id: string; contentHash: string | null }>,
  ): Promise<MatchResult> {
    const baseSnapshotId = reusePlan.baseSnapshotId!;

    // Load previous artifacts for this snapshot
    const previousArtifacts = await this.prisma.codeArtifact.findMany({
      where: { snapshotId: baseSnapshotId },
      select: { id: true, artifactKey: true, contentHash: true },
    });

    const previousArtifactByKey = new Map(
      previousArtifacts.map((a) => [a.artifactKey, { id: a.id, contentHash: a.contentHash }]),
    );
    const previousArtifactContentHashByKey = new Map(
      previousArtifacts.map((a) => [a.artifactKey, a.contentHash]),
    );
    const currentArtifactContentHashByKey = new Map(
      currentArtifacts.map((a) => [a.artifactKey, a.contentHash]),
    );

    // Load previous chunks (metadata only) for candidate artifact IDs
    const candidateArtifactIds = needsProcessing
      .map((i) => previousArtifactByKey.get(i.artifactKey)?.id)
      .filter((id): id is string => !!id);

    const previousChunks = await this.chunkRepo.listForReuseByArtifacts({
      snapshotId: baseSnapshotId,
      artifactIds: candidateArtifactIds,
      embeddingModel: this.embeddingProvider.providerName,
      chunkerVersion: CHUNK_BUILDER_VERSION,
    });

    const previousChunkByArtifactId = new Map(
      previousChunks.map((c) => [
        c.artifactId,
        { contentHash: c.contentHash, chunkerVersion: c.chunkerVersion, embeddingModel: c.embeddingModel },
      ]),
    );

    return matchChunksForReuse({
      currentItems: needsProcessing,
      previousArtifactByKey,
      previousChunkByArtifactId,
      currentArtifactContentHashByKey,
      previousArtifactContentHashByKey,
      targetEmbeddingModel: this.embeddingProvider.providerName,
      versionChangeBlocked: reusePlan.reuseSafety === 'VERSION_CHANGED_REVIEW_REQUIRED',
    });
  }
}
