# ReqImpact Comparison Matrix

| Dimension | Pure LLM | Keyword Baseline | Vector-only Baseline | ReqImpact |
| --- | --- | --- | --- | --- |
| Repository evidence | None by default | Weak lexical evidence | Weak lexical/vector evidence | Persisted code evidence |
| Static artifact model | No | No | No | Yes |
| Human review state | No | No | No | Yes |
| Unknown / risk handling | Prompt dependent | No | No | Explicit |
| QA scenario support | Prompt dependent | No | No | Yes |
| Approved report provenance | No | No | No | Yes |
| CI-safe deterministic mode | No | Yes | Yes | Yes for fake-provider path |

## Interpretation

- Pure LLM is useful as a comparison point for context-free reasoning.
- Keyword and vector-only baselines provide bounded retrieval comparisons.
- ReqImpact is the only pipeline in this matrix that keeps evidence, review,
  and report provenance together.
