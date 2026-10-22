# BA Helper: Impact Analysis Case Study

This text-only case study describes the end-to-end workflow. It is an illustrative
product narrative, not a record of a current run or a reviewer study.

> Screenshot status: image assets are not included in this repository. See the
> [screenshot checklist](screenshot-checklist.md) before publishing a visual
> portfolio version.

## 1. Problem
When business logic changes, Technical BAs and QA engineers historically rely on manual codebase searches or tribal knowledge to map backend impacts. This process is brittle, un-auditable, and prone to costly QA regressions.

## 2. Requirement Change
We inject a typical, high-risk business requirement:
> "When a booking is cancelled after payment, the system must release room inventory, mark the booking as cancelled, and prevent duplicate refund requests."

The system consumes this text alongside a static snapshot of the backend repository to prepare for impact analysis.

## 3. Repository Scan + Graph
The backend parses the AST and generates a dependency graph. This provides a structural map of the codebase before any AI inference begins.


## 4. Evidence-backed Impact Analysis
BA Helper does not fabricate claims. Every proposed impact is strictly tethered to code-level evidence. The Evidence Inspector provides the exact file path and code excerpts justifying the impact.


## 5. Audit Timeline
Every significant action—from the initial scan to analysis creation, human review, and finalization—is recorded in an immutable audit timeline, ensuring full historical traceability.


## 6. Human Review Gate
The system enforces a strict human-in-the-loop workflow. The analyst must transition every traceability link to a validated decision (e.g., `ACCEPTED`, `REJECTED`, or `NEEDS_MORE_EVIDENCE`).


## 7. Reviewed Snapshot
Once the review is 100% complete, the analyst triggers a snapshot. This locks the decisions and evidence into an append-only state, securing the historical record against future code changes.


## 8. Async Final Report Generation
With the snapshot locked, an asynchronous document job is enqueued to generate a deterministic final Markdown report directly from the frozen database payload, without using any active LLM calls.


## 9. Snapshot Drift
As the underlying codebase evolves, the system calculates drift. If newer commits diverge from the frozen snapshot, a warning is raised to highlight that the analysis may be stale.


## 10. Re-analysis Lineage / Diff
When a new analysis is triggered due to drift or requirement updates, the system tracks the lineage between the old and new analysis, highlighting changed artifacts, unknowns, and QA scenarios.


## 11. Tested Guarantees
Relevant API, web, and browser checks are listed in the
[testing strategy](../agent/testing-strategy.md). Their results must be read
from a dated verification record for the exact checkout; this narrative does
not certify the current CI state.

## 12. Known Limits
- The system is an impact analyzer, not a proof system.
- AI proposals are hints; human review is always required.
- Current deep parser support is optimized for TypeScript/NestJS repositories.
- Pilot language adapters demonstrate extraction contracts, not full compiler-level semantic analysis.
