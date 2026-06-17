# ReqImpact Architecture Research View

## Product name vs paper name

- GitHub/product repository name: `BA_Helper`
- Research/tool name in paper context: `ReqImpact`

## Research-facing pipeline

```text
Requirement revision
-> Repository snapshot
-> Static artifact extraction
-> Hybrid retrieval
-> LLM reasoning
-> Evidence-backed insights
-> Human review
-> Approved traceability report
```

## Why this architecture is research-relevant

The pipeline exposes measurable internal checkpoints:
- extracted artifact inventory
- retrieved candidate set
- evidence links
- insight certainty
- review decisions
- approved report provenance

That makes evaluation more auditable than end-to-end LLM output alone.

## Explicit non-goals

- no generic repository chatbot
- no autonomous coding agent
- no code generation benchmark framing
- no broad multi-domain expansion unless evaluation requires it
