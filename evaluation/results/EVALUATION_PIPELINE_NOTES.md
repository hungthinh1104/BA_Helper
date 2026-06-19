# Evaluation Pipeline Notes

- `rag-samples.v0.json` is a CASE_ONLY export artifact. It validates export shape only and is not treated as a retrieval benchmark input.
- `keyword-baseline.v0.json` is the first actual benchmark result file in this research branch.
- `bm25-baseline.v0.json` is a stronger lexical benchmark result, but it is still lexical only and not semantic retrieval.
- Any current-hybrid benchmark requires real DB-backed snapshot and index state. It stays out of lexical metrics aggregation unless the registry explicitly supports that method.
- `CURRENT_HYBRID_SMOKE` output is not benchmark evidence and must not be aggregated as a measured method.
- `CURRENT_HYBRID_BENCHMARK` is allowed only when repo/baseSha/snapshot alignment and real query embedding gates all pass.
- As of the current branch state, Case 006 has one legal `CURRENT_HYBRID_BENCHMARK` export at `evaluation/results/rag-samples.current-hybrid.v0.json`.
- Case 006 is now clean-retrieval eligible after file-level scanner fallback and re-indexing. Its changed ground-truth file is persisted as a `FILE` `CodeArtifact`.
- The current-hybrid Case 006 export is a single aligned benchmark sample only. It shows a rank-1 file-level hit for `libs/boat/src/transformers/transformer.ts`, but it is not an aggregate current-hybrid result.
- A future vector-only baseline must not use fake embeddings, hash vectors, random vectors, or keyword-derived pseudo-semantic vectors as evidence.
- No `vector-baseline.v0.json` should exist until real embeddings are used with documented provider provenance.
- `db-snapshot-readiness.v0.json` is a read-only environment/state probe only. It is not a retrieval benchmark result and must not be added to metrics aggregation.
- `vector-baseline-path.v0.json` is also a probe only. It selects the next feasible real vector path but does not execute retrieval.
- R1 structured embedding stays deferred until current baselines and failure evidence are established.
