# Research Summary v0

ReqImpact is a requirement-to-code impact analysis project. It is not a repo
chatbot, not a code generation agent, and not a generic AI coding tool.

## Current Measured Scope

- Dataset: 6 public cases
- Ground truth: changed files as proxy ground truth
- Evaluation level: file
- Measured methods:
  - `keyword-baseline-v0`
  - `bm25-baseline-v0`

Both measured methods are deterministic lexical baselines only. They do not use
DB state, embeddings, LLM, `HybridRetrievalService`, or R1 structured embedding.

## Aggregate Metrics

| Method | Aggregate | Cases | Macro Recall@10 | Macro Precision@10 | Macro F1@10 | Macro Review Burden@10 | No-hit Cases@10 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `keyword-baseline-v0` | E2E all cases | 6 | 0.5555 | 0.3869 | 0.4212 | 1.4583 | 2 |
| `keyword-baseline-v0` | Clean retrieval subset | 5 | 0.4667 | 0.2643 | 0.3054 | 1.5500 | 2 |
| `bm25-baseline-v0` | E2E all cases | 6 | 0.5555 | 0.3869 | 0.4212 | 1.4583 | 2 |
| `bm25-baseline-v0` | Clean retrieval subset | 5 | 0.4667 | 0.2643 | 0.3054 | 1.5500 | 2 |

## Interim Finding

- BM25 did not improve aggregate file-level retrieval over keyword on dataset v0.
- Lexical retrieval remains insufficient for some cases in dataset v0.
- This supports evaluating a real vector-only path next.
- It does not prove vector retrieval will improve.

## Failure Summary

| Method | PASS_FULL | PASS_PARTIAL | FAIL_MISS |
| --- | ---: | ---: | ---: |
| `keyword-baseline-v0` | 3 | 1 | 2 |
| `bm25-baseline-v0` | 3 | 1 | 2 |

Observed lexical issues:

- `LEXICAL_MISMATCH`
- `DATA_MODEL_MISSED`
- `DOMAIN_ALIAS_MISSING`
- `INDIRECT_DEPENDENCY_MISSED`
- `SUPPORT_FILE_OVER_RETRIEVED`
- `SCANNER_MISSING_ARTIFACT`

## Vector / Hybrid Readiness

- Vector provider gate exists.
- Fake/hash/random/keyword-derived vector sources are prohibited.
- DB snapshot readiness reports one profile-ready aligned candidate for Case 006.
- `vector-baseline.v0.json` does not exist.
- `CURRENT_HYBRID` has one guarded benchmark export for Case 006 only.
- Case 006 is an `E2E_SCANNER_COVERAGE_FAILURE`: its changed ground-truth file was not indexed as a retrievable `CodeArtifact`.

## Allowed Claims

- Dataset v0 and deterministic lexical baselines are implemented.
- Keyword and BM25 achieve the reported file-level metrics on dataset v0.
- BM25 ties keyword on aggregate dataset v0 metrics.
- Current-hybrid has one benchmark export for Case 006, interpreted as scanner coverage / E2E failure rather than clean retrieval performance.

## Disallowed Claims

- no SOTA claim
- no method-level accuracy claim
- no vector improvement claim
- no general current-hybrid performance claim
- no R1 improvement claim
- no GraphRAG comparison claim

## Next Valid Paths

1. Decide whether to fix scanner coverage for Squareboat transformer files before interpreting Case 006 as retrieval evidence.
2. Configure a documented local real embedding provider for vector-only baseline.
3. Explicitly allow a network embedding provider for a manual vector-only baseline.
4. If vector remains blocked, expand dataset size and deepen the threat model.
