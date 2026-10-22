# Agent Context Routing Index

Follow [repository instructions](../../AGENTS.md) first. Read the narrow,
task-specific document below; do not load the whole documentation tree by
default. [`docs/README.md`](../README.md) explains document ownership and the
difference between current guidance and historical records.

## Task routes

| Task | Read first |
| --- | --- |
| Any backend/API/worker change | [Architecture](architecture.md), [data model](data-model.md), [state machine](state-machine.md), [testing strategy](testing-strategy.md) |
| API endpoint or wire contract | [API contracts](api-contracts.md), then the owning module and its tests |
| Scanner, graph, or semantic test evidence | [Analyzer rules](analyzer-rules.md), [input quality](input-quality.md), [testing strategy](testing-strategy.md), relevant [evaluation](../evaluation/static-test-trace.md) |
| Persistence, state, or worker flow | [Data model](data-model.md), [state machine](state-machine.md), [architecture](architecture.md) |
| AI or retrieval | [AI rules](ai-rules.md), [analyzer rules](analyzer-rules.md), [input quality](input-quality.md) |
| Auth, roles, or project access | [Auth and permissions](auth-permissions.md), [API contracts](api-contracts.md) |
| UI behavior or styling | [UI stack](ui-tech-stack.md), [UI design](ui-design.md), [CSS ownership](css-ownership.md), [API contracts](api-contracts.md) |
| Performance or scan bounds | [Scale and performance model](scale-and-performance-model.md), [analyzer rules](analyzer-rules.md), [testing strategy](testing-strategy.md) |
| Security or untrusted repository input | [Security hardening model](security-hardening-model.md), [input quality](input-quality.md), [AI rules](ai-rules.md) |
| Evaluation or product validation | [Impact evaluation](../evaluation/impact-evaluation.md), [test-trace evaluation](../evaluation/static-test-trace.md), [product validation](../evaluation/product-validation.md) |
| Demo, deployment, or release | [Documentation guide](../README.md), [local demo](../demo/run-local-demo.md), [smoke checklist](../deployment/smoke-checklist.md), [roadmap status](../release/roadmap-status.md) |
| Documentation cleanup | [Documentation guide](../README.md), this index, and [done checklist](done-checklist.md) |

## Current rules

- Code, contracts, migrations, and executable evaluation definitions are the
  source of truth for implementation behavior.
- Keep public APIs, persistence ownership, and report compatibility within the
  boundaries in [architecture](architecture.md) and
  [code-quality governance](code-quality-governance.md).
- Unsupported or ambiguous analysis becomes a diagnostic or unknown. Do not
  invent graph edges, execution, coverage, or business behavior.
- Treat dated release and drill documents as records of their stated commit and
  environment. Use [roadmap status](../release/roadmap-status.md) for open gates.
- Preserve the Booking/Payment/Refund MVP scope unless the user explicitly
  expands it.
