# ReqImpact Interim Research Report v0

## Scope

ReqImpact is a requirement-to-code impact analysis system. The research goal is
to evaluate how well requirement text can retrieve impacted backend code
artifacts, then support evidence, unknowns, QA scenarios, and human review.

Out of scope for this report:

- repo chatbot behavior
- autonomous code generation
- generic AI coding tool claims

Branch posture:

- `main` remains the frozen product/demo branch
- `research/reqimpact-eval-v0` contains evaluation and research artifacts

## Dataset Status

- Dataset version: `cases.v0`
- Public cases: 6
- Ground truth type: changed files as proxy ground truth
- Evaluation level: file
- No method-level accuracy claim is made in v0

Implication: dataset v0 is useful for bounded retrieval comparison, but it does
not prove exact method-level impact localization.

## Methods Evaluated

Measured methods:

- `keyword-baseline-v0`
- `bm25-baseline-v0`

Both measured methods are deterministic lexical baselines only. They do not use:

- product DB state
- embeddings
- LLM calls
- `HybridRetrievalService`
- R1 structured embedding

## Aggregate Metrics Summary

| Method | Aggregate | Cases | Macro Recall@10 | Macro Precision@10 | Macro F1@10 | Macro Review Burden@10 | No-hit Cases@10 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `keyword-baseline-v0` | E2E all cases | 6 | 0.5555 | 0.3869 | 0.4212 | 1.4583 | 2 |
| `keyword-baseline-v0` | Clean retrieval subset | 6 | 0.5555 | 0.3869 | 0.4212 | 1.4583 | 2 |
| `bm25-baseline-v0` | E2E all cases | 6 | 0.5555 | 0.3869 | 0.4212 | 1.4583 | 2 |
| `bm25-baseline-v0` | Clean retrieval subset | 6 | 0.5555 | 0.3869 | 0.4212 | 1.4583 | 2 |

Source: `evaluation/results/metrics.v0.json`

## Main Interim Finding

Current evidence supports one conservative interim finding:

- `bm25-baseline-v0` did not improve aggregate file-level retrieval over `keyword-baseline-v0` on dataset v0.

Interpretation:

- lexical retrieval remains insufficient for some dataset v0 cases
- this supports evaluating a real vector-only retrieval path next
- this does not prove vector retrieval will improve performance

## Failure Analysis Summary

Per measured lexical method:

| Method | PASS_FULL | PASS_PARTIAL | FAIL_MISS |
| --- | ---: | ---: | ---: |
| `keyword-baseline-v0` | 3 | 1 | 2 |
| `bm25-baseline-v0` | 3 | 1 | 2 |

Observed lexical-baseline issue categories:

- `LEXICAL_MISMATCH`
- `DATA_MODEL_MISSED`
- `DOMAIN_ALIAS_MISSING`
- `INDIRECT_DEPENDENCY_MISSED`
- `SUPPORT_FILE_OVER_RETRIEVED`

Observed implications:

- Some cases receive zero file hits because requirement wording does not overlap strongly with artifact identifiers.
- Data-model and indirect-dependency files can be missed even when direct service/controller files are retrieved.
- PASS_FULL does not remove review burden; top-k can still include nearby support files and extra non-ground-truth files.

Source: `evaluation/results/failure-analysis.v0.json`

## Vector Readiness Status

Current vector-readiness facts:

- a vector provider gate exists
- fake, hash, random, and keyword-derived vector sources are prohibited
- DB snapshot readiness has one profile-ready aligned candidate for Case 006
- `evaluation/results/vector-baseline.v0.json` does not exist

Therefore:

- vector-only benchmark claims are not allowed yet
- no vector-only retrieval result has been measured in this workspace

## Current-Hybrid Readiness Status

Current-hybrid research posture:

- `CURRENT_HYBRID` exporter exists
- it is designed to fail safely when DB state is unavailable
- one DB-backed current-hybrid benchmark export exists for Case 006 only
- Case 006 is now clean-retrieval eligible after file-level scanner fallback and re-indexing
- the Case 006 current-hybrid export retrieves the proxy ground-truth file at rank 1, with ground-truth artifact coverage `OK`

## Allowed Claims Now

The following claims are evidence-bound and allowed:

- Dataset v0 with 6 public cases exists.
- Deterministic lexical baselines are implemented and measured.
- `keyword-baseline-v0` and `bm25-baseline-v0` achieve the reported file-level metrics on dataset v0.
- BM25 ties keyword on aggregate dataset v0 metrics.
- One guarded current-hybrid benchmark export exists for Case 006 and retrieves the proxy ground-truth file at rank 1.
- Failure analysis identifies lexical mismatch and data/indirect dependency misses as observed lexical-baseline issues.
- Vector gating and readiness probes exist and currently block vector claims in this workspace.

## Disallowed Claims Now

The following claims are not supported by current evidence:

- state-of-the-art retrieval quality
- method-level accuracy
- vector retrieval improvement
- general current-hybrid benchmark performance
- R1 structured embedding improvement
- GraphRAG comparison

## Next Valid Research Paths

1. Configure local DB state and inspect persisted `EmbeddingChunk` / snapshot readiness for DB-backed export.
2. Configure a documented local real embedding provider for a vector-only baseline.
3. Explicitly allow a network embedding provider for a manual vector-only baseline if cost/privacy tradeoffs are acceptable.
4. If vector remains blocked, expand the dataset and deepen the threat model before claiming retrieval progress.

## Threats To Validity

- Dataset v0 is small.
- Changed files are proxy ground truth, not absolute impacted files.
- Public GitHub cases may not represent enterprise systems.
- Candidate artifacts are manually constructed or scanner-equivalent approximations where applicable.
- Evaluation is file-level only.
- Only lexical baselines have been measured so far.
- No vector-only or R1 structured-embedding result has been measured yet.
- Current-hybrid has been measured only for Case 006. This single-case result must not be generalized to aggregate current-hybrid performance.
