# E13 Research Findings

Generated At: `2026-06-19T14:51:27.978Z`
Subset: `clean-vector-ready-v0`

## Subset Failure Analysis
- Excluded Cases: 5
- `NOT_ALIGNED_VECTOR_READY`: 5
- `SNAPSHOT_MISSING`: 4
- `INDEX_STATUS_NOT_VECTOR_READY`: 5
- `NO_CHUNKS`: 5
- `MISSING_SELECTED_EMBEDDING_PROFILE`: 5
- `MISSING_EMBEDDING_PROVIDER`: 5
- `MISSING_EMBEDDING_MODEL`: 5
- `MISSING_EMBEDDING_DIMENSIONS`: 5
- `NOT_CLEAN_RETRIEVAL_ELIGIBLE`: 5
- `SCANNER_COVERAGE_NOT_OK`: 5
- `GROUND_TRUTH_NOT_INDEXED`: 1

## Evidence Quality
- `VECTOR_ONLY`: rank1HasGroundTruth=true, signals=[VECTOR]
- `CURRENT_HYBRID`: rank1HasGroundTruth=true, signals=[LEXICAL, VECTOR, GRAPH, KIND]
- `KEYWORD`: rank1HasGroundTruth=true, signals=[KEYWORD]
- `BM25`: rank1HasGroundTruth=true, signals=[BM25]

## Method Behavior Notes
- VECTOR_ONLY captures purely semantic similarity on Case006.
- CURRENT_HYBRID combines lexical patterns, vector scores, and graph expansion.
- KEYWORD relies strictly on deterministic overlap with high-weight fields.
- BM25 distributes weights based on term frequency and inverted document frequency.

## Dataset Expansion Recommendation
- Improve Indexing Resilience: Ensure all case ground-truth files are embedded to avoid GROUND_TRUTH_NOT_INDEXED.
- Address Scanner Coverage: Ensure framework scanners do not fail or partially skip essential files, avoiding SCANNER_COVERAGE_NOT_OK.
- Increase Subsets: Currently at 1/6. We need to stabilize indexing so that at least 3/6 cases are VECTOR_READY to allow for more statistically significant comparisons.

## Known Limits
- Findings are based only on clean-vector-ready-v0.
- Subset size is 1/6 and not representative of the full dataset.
- No method superiority claim is made in E13.