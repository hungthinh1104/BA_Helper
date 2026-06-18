# Evaluation Pipeline Notes

- `rag-samples.v0.json` is a CASE_ONLY export artifact. It validates export shape only and is not treated as a retrieval benchmark input.
- `keyword-baseline.v0.json` is the first actual benchmark result file in this research branch.
- `bm25-baseline.v0.json` is a stronger lexical benchmark result, but it is still lexical only and not semantic retrieval.
- Any current-hybrid benchmark requires real DB-backed snapshot and index state. Until that exists as an explicit benchmark result file, it stays out of metrics aggregation.
- A future vector-only baseline must not use fake embeddings, hash vectors, random vectors, or keyword-derived pseudo-semantic vectors as evidence.
- No `vector-baseline.v0.json` should exist until real embeddings are used with documented provider provenance.
- `db-snapshot-readiness.v0.json` is a read-only environment/state probe only. It is not a retrieval benchmark result and must not be added to metrics aggregation.
- `vector-baseline-path.v0.json` is also a probe only. It selects the next feasible real vector path but does not execute retrieval.
- R1 structured embedding stays deferred until current baselines and failure evidence are established.
