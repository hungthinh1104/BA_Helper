import { CHUNK_BUILDER_VERSION } from './artifact-chunk.builder';

/** Represents a current snapshot artifact and its built chunk ready for processing. */
export type CurrentChunkItem = {
  artifactKey: string;
  artifactId: string;
  filePath: string;
  symbolName: string | null;
  artifactType: string;
  chunkType: string;
  stableChunkId: string;
  content: string;
  contentHash: string;
  chunkerVersion: string;
};

/** Previous snapshot artifact metadata (content hash only — no vector). */
export type PreviousArtifact = {
  id: string;
  contentHash: string | null;
};

/** Previous snapshot chunk metadata (no vector — only for eligibility matching). */
export type PreviousChunk = {
  contentHash: string;
  chunkerVersion: string | null;
  embeddingModel: string;
};

export type ReuseCandidate = {
  current: CurrentChunkItem;
  previousArtifactId: string;
};

export type BlockedItem = {
  current: CurrentChunkItem;
  reason: string;
};

export type MatchCounts = {
  missingPreviousChunkCount: number;
  versionBlockedChunkCount: number;
  modelMismatchChunkCount: number;
  chunkHashMismatchCount: number;
  legacyChunkerVersionBlockedCount: number;
};

export type MatchResult = {
  toReuse: ReuseCandidate[];
  toGenerate: CurrentChunkItem[];
  blocked: BlockedItem[];
  counts: MatchCounts;
};

/**
 * Pure matching function: classifies each current chunk as reuse-eligible or generate-required.
 * Has no side effects and does not access the database.
 *
 * Reuse eligibility requires ALL of:
 *  - previous artifact exists for the same artifactKey
 *  - both artifact contentHashes exist and match
 *  - previous chunk exists for the previous artifact
 *  - previous chunk.chunkerVersion === CHUNK_BUILDER_VERSION (no legacy/null)
 *  - previous chunk.embeddingModel === targetEmbeddingModel
 *  - previous chunk.contentHash === current built chunk contentHash
 *
 * Blocked items (version/model/hash mismatch) fall back to normal generation.
 * They must never be silently skipped.
 */
export function matchChunksForReuse(params: {
  currentItems: CurrentChunkItem[];
  previousArtifactByKey: Map<string, PreviousArtifact>;
  previousChunkByArtifactId: Map<string, PreviousChunk>;
  currentArtifactContentHashByKey: Map<string, string | null>;
  previousArtifactContentHashByKey: Map<string, string | null>;
  targetEmbeddingModel: string;
  versionChangeBlocked: boolean;
}): MatchResult {
  const {
    currentItems,
    previousArtifactByKey,
    previousChunkByArtifactId,
    currentArtifactContentHashByKey,
    previousArtifactContentHashByKey,
    targetEmbeddingModel,
    versionChangeBlocked,
  } = params;

  const toReuse: ReuseCandidate[] = [];
  const blocked: BlockedItem[] = [];
  const counts: MatchCounts = {
    missingPreviousChunkCount: 0,
    versionBlockedChunkCount: 0,
    modelMismatchChunkCount: 0,
    chunkHashMismatchCount: 0,
    legacyChunkerVersionBlockedCount: 0,
  };

  for (const item of currentItems) {
    if (versionChangeBlocked) {
      counts.versionBlockedChunkCount++;
      blocked.push({ current: item, reason: 'VERSION_CHANGED_REVIEW_REQUIRED' });
      continue; // remains in allToGenerate below
    }

    const prevArtifact = previousArtifactByKey.get(item.artifactKey);
    if (!prevArtifact) {
      continue; // New artifact — remains in allToGenerate
    }

    const currentArtifactHash = currentArtifactContentHashByKey.get(item.artifactKey) ?? null;
    const previousArtifactHash = previousArtifactContentHashByKey.get(item.artifactKey) ?? null;
    if (!currentArtifactHash || !previousArtifactHash || currentArtifactHash !== previousArtifactHash) {
      continue; // Artifact content changed — remains in allToGenerate
    }

    const prevChunk = previousChunkByArtifactId.get(prevArtifact.id);
    if (!prevChunk) {
      counts.missingPreviousChunkCount++;
      continue;
    }

    if (!prevChunk.chunkerVersion || prevChunk.chunkerVersion !== CHUNK_BUILDER_VERSION) {
      counts.legacyChunkerVersionBlockedCount++;
      blocked.push({ current: item, reason: 'LEGACY_CHUNKER_VERSION' });
      continue;
    }

    if (prevChunk.embeddingModel !== targetEmbeddingModel) {
      counts.modelMismatchChunkCount++;
      blocked.push({ current: item, reason: 'MODEL_MISMATCH' });
      continue;
    }

    if (prevChunk.contentHash !== item.contentHash) {
      counts.chunkHashMismatchCount++;
      blocked.push({ current: item, reason: 'CHUNK_HASH_MISMATCH' });
      continue;
    }

    toReuse.push({ current: item, previousArtifactId: prevArtifact.id });
  }

  // toGenerate = every item that was NOT placed in toReuse.
  // Blocked items fall back to embedding generation — never silently skip.
  const reuseKeys = new Set(toReuse.map((r) => r.current.artifactKey));
  const toGenerate = currentItems.filter((i) => !reuseKeys.has(i.artifactKey));

  return { toReuse, toGenerate, blocked, counts };
}
