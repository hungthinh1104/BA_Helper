# ReqImpact Evaluation Metrics v0

Generated at: 2026-06-19T10:49:18.840Z

| Baseline | Status | Precision | Recall | F1 | Recall@5 | Recall@10 | Evidence Coverage | Review Burden |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| keyword-baseline | COMPLETED | 0.3869 | 0.5555 | 0.4212 | 0.5139 | 0.5555 | 0.0000 | 2.5000 |
| vector-only-baseline | COMPLETED | 0.3869 | 0.5555 | 0.4212 | 0.5555 | 0.5555 | 0.0000 | 2.5000 |
| pure-llm-baseline | SKIPPED | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |

Notes:
- `keyword-baseline` is deterministic lexical overlap scoring.
- `vector-only-baseline` is deterministic sparse token-vector cosine scoring.
- `pure-llm-baseline` is intentionally manual and skipped in the default scaffold.
