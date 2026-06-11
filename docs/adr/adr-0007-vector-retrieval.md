# ADR-0007: Vector Retrieval Architecture & Contracts

## Context

The system currently relies on a deterministic Lexical + Graph Expansion retrieval engine to supply code evidence to the LLM. While this is sufficient for many exact-match keywords, semantic queries containing terms like "abort a purchase" or "withdraw" fail to match symbols like `cancelOrder` without hardcoded synonyms. 

To improve the semantic recall gap (measured in `vector-gap-benchmark`), we are introducing Vector Indexing & Hybrid Retrieval via `pgvector`. This document locks the design to prevent runaway complexity before the embedding worker is implemented.

## Non-goals

- **Do not replace lexical + graph retrieval.** Vector is an additive signal, not a replacement.
- **Do not block analysis when vector indexing fails.** Unavailability of the vector index must gracefully degrade to lexical+graph.
- **Do not embed raw files blindly.** We rely on AST-aware artifact chunks.
- **Do not perform global vector search across tenants/projects.** Strict tenant isolation is mandatory.
- **Do not switch to 3072d embeddings without benchmark evidence.** Stick to 1536d until proven insufficient.

## 1. Isolation Invariant

Every vector query **MUST** filter by:
- `tenantId`
- `projectId`
- `repositoryId`
- `snapshotId`

## 2. Idempotency Rule

The combination of `stableChunkId + contentHash` determines whether a chunk needs re-embedding.
- Same `stableChunkId` + same `contentHash` **MUST NOT** re-embed.
- Same `stableChunkId` + different `contentHash` **MUST** re-embed.

## 3. Fallback Rule

The system relies on `RepositorySnapshot.indexStatus` to determine routing:
- If `snapshot.indexStatus = VECTOR_FAILED`, retrieval **MUST** continue using lexical + graph.
- If `snapshot.indexStatus = LEXICAL_READY`, retrieval **MAY** run without vector.
- If `snapshot.indexStatus = VECTOR_READY`, retrieval **SHOULD** use hybrid vector + lexical + graph.

## 4. Vector Indexing Lifecycle

1. `ScanJob` transitions to `COMPLETED`.
2. `RepositorySnapshot` is created with `indexStatus = LEXICAL_READY`.
3. System enqueues an `EMBED_SNAPSHOT` job.
4. Status transitions to `VECTOR_INDEXING`.
5. Upon completion or failure, status becomes `VECTOR_READY` or `VECTOR_FAILED`.

## 5. Chunking Strategy

Chunks map directly to AST entities rather than arbitrary sliding windows.
Supported `chunkType`s:
- `ARTIFACT_SUMMARY`
- `METHOD_BODY`
- `CLASS_CONTEXT`
- `TEST_CASE`
- `ENTITY_CONTEXT`

## 6. Hybrid Ranking Formula

Vector retrieval introduces a new scoring channel, rather than a standalone pipeline. Semantic matches that lack graph edges are still evaluated, but ranked holistically:

`finalScore = lexicalScore + graphScore + vectorScore + domainBoost - noisePenalty`

## 7. Benchmark Acceptance Criteria

The vector implementation is not accepted unless `vector-gap-benchmark` strict mode passes for the following query:
> "Allow customers to abort a purchase before fulfillment and restore reserved stock."

Required recovered artifacts:
- `OrderService.cancelOrder`
- `InventoryService.releaseReservation`
- `Order`
- `StockReservation`
