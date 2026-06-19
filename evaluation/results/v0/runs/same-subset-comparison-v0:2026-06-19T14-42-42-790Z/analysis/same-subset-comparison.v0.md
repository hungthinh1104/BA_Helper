# Same-Subset Comparison Report

Subset: `clean-vector-ready-v0` (Size: 1)

| Method | Artifact | hitAt1 | hitAt5 | hitAt10 | MRR |
| --- | --- | ---: | ---: | ---: | ---: |
| `VECTOR_ONLY` | `evaluation/results/v0/baselines/vector-baseline.v0.json` | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| `CURRENT_HYBRID` | `evaluation/results/v0/baselines/current-hybrid-clean-subset-baseline.v0.json` | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| `KEYWORD` | `evaluation/results/v0/baselines/keyword-clean-subset-baseline.v0.json` | 1.0000 | 1.0000 | 1.0000 | 1.0000 |
| `BM25` | `evaluation/results/v0/baselines/bm25-clean-subset-baseline.v0.json` | 1.0000 | 1.0000 | 1.0000 | 1.0000 |

## Comparison Policy
- sameSubsetRequired: true
- sameCaseIdsRequired: true
- winnerAllowed: false
- interpretation: ILLUSTRATIVE_ONLY

## Known Limits
- Measured only on clean-vector-ready-v0.
- Subset size is 1/6 and not representative of the full dataset.
- Do not generalize method superiority from this comparison.