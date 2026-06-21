# BA Helper: Impact Analysis Case Study

This case study visually demonstrates the end-to-end workflow of BA Helper, proving how it enforces an audit-style traceability process from raw requirement to immutable final report.

## 1. The Problem
When business logic changes, Technical BAs and QA engineers historically rely on manual codebase searches or tribal knowledge to map backend impacts. This process is brittle, un-auditable, and prone to costly QA regressions.

## 2. Requirement Change
We inject a typical, high-risk business requirement:
> "When a booking is cancelled after payment, the system must release room inventory, mark the booking as cancelled, and prevent duplicate refund requests."

The system consumes this text alongside a static snapshot of the backend repository.

![Analysis workspace](./assets/01-analysis-workspace.png)

## 3. Analysis Output
The backend parses the AST and generates a dependency graph, proposing likely impacted backend artifacts.
Expected impacted artifacts for the demo include `BookingService`, `InventoryService`, `RefundController`, or equivalent modules depending on the analyzed repository structure.

![Impacted artifacts](./assets/02-impacted-artifacts.png)

## 4. Evidence and Traceability
BA Helper does not hallucinate. Every proposed impact is strictly tethered to code-level evidence. The Evidence Inspector provides the exact file path and line numbers justifying the impact.

![Evidence inspector](./assets/03-evidence-inspector.png)

The Evidence Quality Table allows the analyst to audit the precision of the LLM's retrieval.

![Evidence quality table](./assets/04-evidence-quality-table.png)

## 5. Human Review
The system enforces a strict human-in-the-loop workflow. The analyst must transition every traceability link to a validated decision (`ACCEPTED`, `REJECTED`, `NEEDS_MORE_EVIDENCE`).

![Human review decisions](./assets/05-human-review-decisions.png)

## 6. Immutable Snapshot
Once the review is 100% complete, the analyst triggers a snapshot. This performs a deep copy of the decisions and evidence, locking them into an append-only state in the database.

![Locked snapshot](./assets/06-locked-snapshot.png)

## 7. Final Reviewed Export
With 0 unreviewed links and a locked snapshot, the deterministic review gate unlocks. The system generates a final Markdown export directly from the frozen snapshot, completely bypassing any live AI generation.

![Final review gate and export](./assets/07-final-review-gate-export.png)

## 8. Tested Guarantees
This audit workflow is not just conceptual; it is strictly enforced by our CI/CD pipeline:
- **E17A Backend Tests:** Asserts that the API blocks exports if a snapshot is missing or links are unreviewed.
- **E17B Frontend Tests:** Asserts the UI correctly disables export functions and serves deterministic Blob downloads when the gate is passed.

## 9. Known Limits
- The system is an impact analyzer, not a formal verification engine.
- AI proposals are hints; human review is always required.
- Current deep parser support is optimized for TypeScript/NestJS repositories.
