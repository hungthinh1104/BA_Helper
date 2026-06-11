# Embedding Chunk Reuse Feasibility Audit

**Phase:** 31D-0 (Audit) / 31D-1 (Schema Foundation Completed)  
**Date:** 2026-06-11 (Audit) / 2026-06-12 (Foundation)  
**Auditor:** Antigravity Agent  
**Status:** 31D-1 COMPLETE — `chunkerVersion` blocker resolved. Actual reuse not yet implemented.

---

## 1. Current Schema Summary

### `EmbeddingChunk` model (`apps/api/prisma/schema.prisma:690`)

| Field | Type | Present | Notes |
|---|---|---|---|
| `tenantId` | String (uuid) | ✅ | Indexed. MVP: tenantId = projectId |
| `projectId` | String (uuid) | ✅ | Indexed |
| `repositoryId` | String (uuid) | ✅ | Indexed |
| `snapshotId` | String (uuid) | ✅ | Indexed. FK → `RepositorySnapshot` |
| `artifactId` | String? (uuid) | ✅ | Nullable FK → `CodeArtifact`. Indexed. |
| `stableChunkId` | String | ✅ | `"{snapshotId}:{artifactKey}:{chunkType}"` |
| `commitSha` | String | ✅ | Indexed |
| `embeddingModel` | String | ✅ | Set from `EmbeddingResult.model` at generation time |
| `content` | String | ✅ | Redacted before storage |
| `contentHash` | String | ✅ | SHA-256 of the redacted content |
| `tokenCount` | Int | ✅ | Rough estimate (`length / 4`) |
| `embedding` | `vector(1536)` | ✅ | pgvector column |
| `createdAt` | DateTime | ✅ | |
| **`chunkerVersion`** | String? | ✅ **ADDED (31D-1)** | `'artifact-chunker@0.1.0'` for new chunks; `null` for legacy rows (not reuse-eligible) |
| **`analyzerVersion`** | — | ❌ **MISSING** | No field linking to the scanner/analyzer version used during extraction |

**Idempotency key:** `@@unique([snapshotId, stableChunkId, embeddingModel])`

**RAG query isolation (present in `searchSimilar`):** `tenantId`, `projectId`, `repositoryId`, `snapshotId` — all four filters are enforced. ✅

---

## 2. Current Embedding Generation Flow

```
RunScanJobUseCase
  └─ snapshot upserted (empty diagnostics)
  └─ artifacts persisted (CodeArtifact rows)
  └─ Evidence rows persisted (with excerpt)
  └─ snapshot.indexStatus = LEXICAL_READY
  └─ queueService.enqueueSnapshotEmbedding(snapshotId)
       │
       ▼
EmbedSnapshotArtifactsUseCase  (worker process)
  1. Load RepositorySnapshot → get projectId, repositoryId, commitSha
  2. snapshot.indexStatus = VECTOR_INDEXING
  3. Load all CodeArtifact rows (with evidences) for this snapshot
  4. Build chunks via ArtifactChunkBuilder.build()
       stableChunkId = "{snapshotId}:{artifactKey}:{chunkType}"
       content       = [artifactKey, symbol, type, file, excerpt].join('\n')
       contentHash   = SHA-256(content)
  5. listBySnapshot(snapshotId, embeddingProvider.providerName)
       → existing chunks for THIS snapshot only (idempotent re-run guard)
  6. Filter: skip if stableChunkId already present with same contentHash
  7. Redact secrets via AiPolicy.redactPayload
  8. embeddingProvider.embed(redacted texts)
       → returns { embeddings[][], model: string, dimensions }
  9. insertMany(chunks) with ON CONFLICT DO UPDATE (upsert)
  10. snapshot.indexStatus = VECTOR_READY
```

**Key observation:** The cache check in step 5–6 only looks within the **same** snapshot. It does not read from any previous snapshot. No cross-snapshot chunk reading currently occurs.

### `ArtifactChunkBuilder` details

- `stableChunkId` includes `snapshotId`, making it **inherently snapshot-scoped**.
- `chunkType` is derived from `artifactType` via a static mapping table (`mapArtifactType`).
- No chunker strategy version is embedded in the `stableChunkId` or stored as a schema field.

---

## 3. Snapshot-Scoped Chunk Reuse: Safety Assessment

### What "reuse" means in this context

Instead of calling the embedding API for an unchanged artifact, copy the vector row from the **previous** snapshot to the **new** snapshot, updating `snapshotId` and `artifactId` to point to the new snapshot's records.

### Pre-conditions for safe reuse

| Condition | Current State | Gap? |
|---|---|---|
| Isolation: RAG queries filter by `snapshotId` | ✅ Enforced in `searchSimilar` | None |
| New snapshot owns its own chunk rows (no shared rows) | ✅ `stableChunkId` includes `snapshotId` — copying creates new rows | None |
| `contentHash` match validates unchanged content | ✅ `contentHash` present on both `CodeArtifact` and `EmbeddingChunk` | None |
| Embedding model version must match | ✅ `embeddingModel` field stored per chunk, used in `listBySnapshot` filter | None |
| Chunk strategy/chunker version must match | ❌ **No `chunkerVersion` field.** If `ArtifactChunkBuilder` logic changes between scans, reused vectors would silently represent different chunk text than what the model was trained on | **BLOCKER** |
| Analyzer version compatibility validated | ❌ `EmbeddingChunk` has no `analyzerVersion` field. `EMBEDDING_REUSE_PLAN` in `INCREMENTAL_SCAN_SUMMARY` already captures `VERSION_CHANGED_REVIEW_REQUIRED` — but this information is not stored on the chunk itself | **MINOR GAP** |
| Reused chunks point to current `snapshotId` | ✅ Will be enforced by copy logic (not yet written) | None (future) |
| Reused chunks point to current `CodeArtifact.id` | ✅ Will be enforced by copy logic (not yet written) | None (future) |
| No query reads old snapshot chunks directly | ✅ All queries filter by `snapshotId` | None |

### Verdict: **CONDITIONALLY SAFE — pending Phase 31D implementation**

**Phase 31D-1 resolved the blocking gap.** `chunkerVersion` is now:
- Present as a nullable column on `EmbeddingChunk`
- Populated with `CHUNK_BUILDER_VERSION = 'artifact-chunker@0.1.0'` on every new chunk
- `null` on all pre-31D-1 legacy rows
- Excluded from `ON CONFLICT DO UPDATE` so idempotent re-inserts never silently change the recorded version
- Returned by `listBySnapshot` for future reuse eligibility checks

**Legacy chunk rule (enforced by design):**
> Chunks with `chunkerVersion = null` or any value ≠ `CHUNK_BUILDER_VERSION` are NOT reuse-eligible.
> They remain fully valid for retrieval (RAG queries do not filter by `chunkerVersion`).

Actual vector/chunk copying is not yet implemented. No retrieval behavior was changed.

---

## 4. Required Schema Gaps

### ~~Gap 1 (BLOCKER): `chunkerVersion` missing from `EmbeddingChunk`~~ — RESOLVED in Phase 31D-1

**Resolution:**
- `chunkerVersion String?` added to `EmbeddingChunk` (migration `20260611173129_add_embedding_chunker_version`)
- `CHUNK_BUILDER_VERSION = 'artifact-chunker@0.1.0'` exported from `ArtifactChunkBuilder`
- Every new chunk persists this value via `insertMany`
- `listBySnapshot` now returns `chunkerVersion`
- `ON CONFLICT DO UPDATE` intentionally excludes `chunkerVersion` (creation-time value is immutable)

### Gap 2 (MINOR): `analyzerVersion` not stored on `EmbeddingChunk`

The chunk content includes artifact data (symbolName, filePath, excerpt) derived from a specific analyzer run. If analyzer extraction logic changes but `contentHash` is the same (e.g. filePath normalization change), the chunk content can silently drift.

**Assessment:** Lower risk than chunker version because `contentHash` on `CodeArtifact` already gates reuse in the `EMBEDDING_REUSE_PLAN` — a hash change means ineligible. The `INCREMENTAL_SCAN_SUMMARY` `VERSION_CHANGED_REVIEW_REQUIRED` flag also provides a signal. Can be deferred to Phase 31D-2.

**Recommended addition (deferred):**
```prisma
model EmbeddingChunk {
  analyzerVersion String?
}
```

---

## 5. Required Code Changes for Actual Reuse

Once Gap 1 is resolved, these changes would be needed to implement reuse:

### 5a. `ArtifactChunkBuilder` — export version constant

```typescript
export const CHUNK_BUILDER_VERSION = 'artifact-chunk-builder@0.1.0';
```

### 5b. `EmbeddingChunkRepository` — add `copyChunks` method

```typescript
async copyChunks(params: {
  sourceSnapshotId: string;
  targetSnapshotId: string;
  targetArtifactIdByKey: Map<string, string>; // artifactKey -> new CodeArtifact.id
  chunkerVersion: string;
  embeddingModel: string;
}): Promise<number> // returns count of copied chunks
```

This method must:
- Read source chunks by `sourceSnapshotId` + `chunkerVersion` + `embeddingModel`
- Write new rows with `targetSnapshotId` and the new `artifactId` from `targetArtifactIdByKey`
- Preserve all vector data, `contentHash`, `tokenCount`
- Use `ON CONFLICT DO NOTHING` (idempotent)
- Never read from old snapshot in any RAG query path — this copy is write-time only

### 5c. `EmbedSnapshotArtifactsUseCase` — consume `EMBEDDING_REUSE_PLAN`

When a new snapshot has a persisted `EMBEDDING_REUSE_PLAN` diagnostic with `reuseMode: 'PLAN_ONLY'` and eligible artifacts, the use case should:
1. Load the reuse plan from `snapshot.diagnostics`
2. Call `chunkRepo.copyChunks()` for eligible artifacts
3. Still call `embeddingProvider.embed()` for ineligible artifacts (ADDED / CHANGED / HASH_UNAVAILABLE)
4. Persist metrics (reused count vs. re-embedded count) as a diagnostic

### 5d. `EmbeddingChunkRepository.listBySnapshot` — include `chunkerVersion`

```typescript
async listBySnapshot(snapshotId: string, embeddingModel: string, chunkerVersion: string)
```

---

## 6. Recommended Next Phase

### → Phase 31D: Actual Snapshot-Scoped Chunk Reuse

**Phase 31D-1 is complete.** The schema foundation is in place.

Phase 31D scope:
- Implement `EmbeddingChunkRepository.copyChunks(sourceSnapshotId, targetSnapshotId, artifactIdMap, chunkerVersion, embeddingModel)`
- In `EmbedSnapshotArtifactsUseCase`, load the `EMBEDDING_REUSE_PLAN` diagnostic from `snapshot.diagnostics`
- For each eligible artifact in the plan: call `copyChunks` instead of embedding
- Still call `embeddingProvider.embed()` for ineligible artifacts (ADDED / CHANGED / HASH_UNAVAILABLE / null chunkerVersion)
- Persist a reuse metrics diagnostic (reused count vs. re-embedded count)
- Tests must cover: copy path, ineligible path, mixed path, version mismatch path

**Pre-conditions for Phase 31D (all met after 31D-1):**
- [x] `chunkerVersion` stored per chunk
- [x] `CHUNK_BUILDER_VERSION` exported from builder
- [x] `listBySnapshot` returns `chunkerVersion`
- [x] `EMBEDDING_REUSE_PLAN` diagnostic computed per scan
- [x] RAG isolation enforced on all queries (no cross-snapshot reads)
- [ ] `copyChunks` method implemented (Phase 31D)

---

## RAG Isolation Invariants (Preserved)

All invariants from `AGENTS.md` remain intact after Phase 31D-1:

- Every vector query still filters by: `tenantId`, `projectId`, `repositoryId`, `snapshotId`
- Embedding chunks from old snapshots are **never read** by any RAG query path
- Reuse copies produce new rows owned by the new snapshot — no shared rows
- MVP: `tenantId = projectId` (no change)
- Future: `tenantId = organizationId` (not affected by this schema addition)
