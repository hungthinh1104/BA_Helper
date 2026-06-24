# BA Helper: Impact Analysis Case Study

This case study visually demonstrates the end-to-end workflow of BA Helper and shows how it enforces an audit-style traceability process from raw requirement to reviewed final report.

## 1. Problem
When business logic changes, Technical BAs and QA engineers historically rely on manual codebase searches or tribal knowledge to map backend impacts. This process is brittle, un-auditable, and prone to costly QA regressions.

## 2. Requirement Change
We inject a typical, high-risk business requirement:
> "When a booking is cancelled after payment, the system must release room inventory, mark the booking as cancelled, and prevent duplicate refund requests."

The system consumes this text alongside a static snapshot of the backend repository to prepare for impact analysis.

## 3. Repository Scan + Graph
The backend parses the AST and generates a dependency graph. This provides a structural map of the codebase before any AI inference begins.

![Repository scan + graph edges](./assets/01-repository-scan-graph.png)

## 4. Evidence-backed Impact Analysis
BA Helper does not fabricate claims. Every proposed impact is strictly tethered to code-level evidence. The Evidence Inspector provides the exact file path and code excerpts justifying the impact.

![Evidence-backed impact analysis](./assets/02-evidence-backed-impact-analysis.png)

## 5. Audit Timeline
Every significant action—from the initial scan to analysis creation, human review, and finalization—is recorded in an immutable audit timeline, ensuring full historical traceability.

![Audit timeline](./assets/03-audit-timeline.png)

## 6. Human Review Gate
The system enforces a strict human-in-the-loop workflow. The analyst must transition every traceability link to a validated decision (e.g., `ACCEPTED`, `REJECTED`, or `NEEDS_MORE_EVIDENCE`).

![Human review gate](./assets/04-human-review-gate.png)

## 7. Reviewed Snapshot
Once the review is 100% complete, the analyst triggers a snapshot. This locks the decisions and evidence into an append-only state, securing the historical record against future code changes.

![Reviewed snapshot viewer](./assets/05-reviewed-snapshot-viewer.png)

## 8. Async Final Report Generation
With the snapshot locked, an asynchronous document job is enqueued to generate a deterministic final Markdown report directly from the frozen database payload, without using any active LLM calls.

![Async document job status + final report](./assets/06-async-document-job-final-report.png)

## 9. Snapshot Drift
As the underlying codebase evolves, the system calculates drift. If newer commits diverge from the frozen snapshot, a warning is raised to highlight that the analysis may be stale.

![Snapshot drift drawer](./assets/07-snapshot-drift-drawer.png)

## 10. Re-analysis Lineage / Diff
When a new analysis is triggered due to drift or requirement updates, the system tracks the lineage between the old and new analysis, highlighting changed artifacts, unknowns, and QA scenarios.

![Re-run analysis lineage / diff](./assets/08-rerun-lineage-diff.png)

## 11. Tested Guarantees
This audit workflow is not just conceptual; it is strictly enforced by our CI/CD pipeline:
- **E17A Backend Tests:** Asserts that the API blocks exports if a snapshot is missing or links are unreviewed.
- **E17B Frontend Tests:** Asserts the UI correctly disables export functions and serves deterministic Blob downloads when the gate is passed.

## 12. Known Limits
- The system is an impact analyzer, not a proof system.
- AI proposals are hints; human review is always required.
- Current deep parser support is optimized for TypeScript/NestJS repositories.
- Pilot language adapters demonstrate extraction contracts, not full compiler-level semantic analysis.
