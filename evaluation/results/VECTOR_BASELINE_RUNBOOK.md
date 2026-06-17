# Vector Baseline Runbook

## Purpose

This runbook defines when `vector-baseline.v0.json` is allowed to exist.

No `vector-baseline.v0.json` should exist until real embeddings are used.

## Why fake embeddings are prohibited

Fake embeddings, hash vectors, random vectors, keyword-derived vectors, and CASE_ONLY export order are not semantic retrieval evidence. Publishing those outputs as vector benchmark results would make the evaluation misleading.

## Acceptable vector sources

1. Persisted real `EmbeddingChunk` rows from an indexed snapshot.
2. Local real embedding model with documented model name and version.
3. Network embedding provider only when explicitly allowed and cost/privacy tradeoffs are accepted.

## Required metadata for any real vector baseline result

- `providerName`
- `embeddingModel`
- `embeddingSource`
- `generatedAt`
- dataset version
- `topK`
- whether network was used
- whether DB was used

## Retrieval method boundaries

- `keyword-baseline-v0`: deterministic keyword-overlap lexical retrieval.
- `bm25-baseline-v0`: deterministic BM25 lexical retrieval.
- `vector-baseline-v0`: vector-only retrieval over real embeddings only.
- current hybrid retrieval: product retrieval path requiring real DB snapshot/index state.
- `R1` structured embedding: later experiment after current baselines and failure evidence are established.

## Provider gate

The vector baseline provider gate rejects:

- provider names containing `fake`
- `source=fake`
- `source=hash`
- `source=random`
- `source=keyword`
- `isFake=true`
- missing `embeddingModel`
- network embedding use without `REQIMPACT_ALLOW_NETWORK_VECTOR_BASELINE=1`

## Phase 2F status

`run-vector-baseline.ts` may be used to validate provider configuration, but it must refuse to emit `vector-baseline.v0.json` unless a real provider is explicitly configured.
