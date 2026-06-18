# Research Summary v0

ReqImpact is a requirement-to-code impact analysis project. It is not a repo
chatbot, not a code generation agent, and not a generic AI coding tool.

## Current Measured Scope

- Dataset: 5 public cases
- Ground truth: changed files as proxy ground truth
- Evaluation level: file
- Measured methods:
  - `keyword-baseline-v0`
  - `bm25-baseline-v0`

Both measured methods are deterministic lexical baselines only. No DB,
embeddings, LLM, `HybridRetrievalService`, or R1 structured embedding has been
measured here.

## Aggregate Metrics

| Method | Macro Recall@10 | Macro Precision@10 | Macro F1@10 | Macro Review Burden@10 | No-hit Cases@10 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `keyword-baseline-v0` | 0.4667 | 0.2643 | 0.3054 | 1.5500 | 2 |
| `bm25-baseline-v0` | 0.4667 | 0.2643 | 0.3054 | 1.5500 | 2 |

## Interim Finding

- BM25 did not improve aggregate file-level retrieval over keyword on dataset v0.
- Lexical retrieval remains insufficient for some cases in dataset v0.
- This supports evaluating a real vector-only path next.
- It does not prove vector retrieval will improve.

## Failure Summary

| Method | PASS_FULL | PASS_PARTIAL | FAIL_MISS |
| --- | ---: | ---: | ---: |
| `keyword-baseline-v0` | 2 | 1 | 2 |
| `bm25-baseline-v0` | 2 | 1 | 2 |

Observed lexical issues:

- `LEXICAL_MISMATCH`
- `DATA_MODEL_MISSED`
- `DOMAIN_ALIAS_MISSING`
- `INDIRECT_DEPENDENCY_MISSED`
- `SUPPORT_FILE_OVER_RETRIEVED`

## Vector / Hybrid Readiness

- Vector provider gate exists.
- Fake/hash/random/keyword-derived vector sources are prohibited.
- Vector path probe currently reports `selectedPath = NONE`.
- DB snapshot readiness currently reports `NO_DATABASE_URL`.
- `vector-baseline.v0.json` does not exist.
- `CURRENT_HYBRID` exporter exists, but no DB-backed current-hybrid benchmark has run.

## Allowed Claims

- Dataset v0 and deterministic lexical baselines are implemented.
- Keyword and BM25 achieve the reported file-level metrics on dataset v0.
- BM25 ties keyword on aggregate dataset v0 metrics.

## Disallowed Claims

- no SOTA claim
- no method-level accuracy claim
- no vector improvement claim
- no current-hybrid benchmark claim
- no R1 improvement claim
- no GraphRAG comparison claim

## Next Valid Paths

1. Configure local DB state for persisted snapshot / embedding inspection.
2. Configure a documented local real embedding provider for vector-only baseline.
3. Explicitly allow a network embedding provider for a manual vector-only baseline.
4. If vector remains blocked, expand dataset size and deepen the threat model.
