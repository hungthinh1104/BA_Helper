# BA Helper: Portfolio & Demo Narrative

## 1. One-Line Product Definition
**BA Helper is a Requirement-to-Code Impact Analyzer.**

## 2. Problem Statement
When a business requirement changes (e.g., "allow users to cancel paid bookings for a refund"), Technical Business Analysts (BAs) and QA Engineers must manually trace how that change cascades through the backend architecture. This process is slow, prone to human error, and lacks an immutable audit trail, often resulting in missed edge cases, outdated documentation, and unhandled regression risks.

## 3. Target Users
- **Technical Business Analysts (BAs):** Needing to map business logic changes to technical impacts.
- **QA / QC Engineers:** Looking for precise code boundaries to build targeted acceptance criteria and test scenarios.
- **Backend Engineers:** Reviewing architectural impacts before writing code.

## 4. Core Workflow
BA Helper automates the heavy lifting of traceability while enforcing strict human oversight:
1. **Input:** The system takes a requirement change and a snapshot of the NestJS repository.
2. **Extraction & Analysis:** It maps likely impacted backend artifacts, constructs dependency graphs, and exposes unknowns, risks, and QA scenarios.
3. **Evidence Linking:** Every impacted artifact is strictly linked to specific code evidence.
4. **Human Review:** The system requires an analyst to explicitly review and make a decision (`ACCEPTED`, `REJECTED`, `NEEDS_REVIEW`, `NEEDS_MORE_EVIDENCE`) on every extracted traceability link.
5. **Snapshotting:** Once reviewed, the state is locked into an immutable reviewed snapshot.
6. **Export:** A deterministic, human-reviewed final report is generated strictly from the locked snapshot.

## 5. Audit Workflow Explanation
BA Helper enforces an **audit-style workflow**. It does not allow users to simply "generate and download" an AI hallucination. Instead, the final output is gated by a deterministic `ReviewCompletionGate`. The gate ensures that every single traceability link has been reviewed and that an immutable snapshot of those decisions has been captured in the database. Only then does the system permit the download of the final human-reviewed report.

## 6. Why This Is Not a Generic AI Repo Chatbot
Generic repository chatbots answer ad-hoc questions without verifiable boundaries or state persistence. BA Helper is fundamentally different:
- **Stateful & Persistent:** It generates structured, persisted entities (impact analyses, code artifacts, evidence excerpts).
- **Evidence-Backed Impact Analysis:** Every insight *must* link to a persisted `Evidence` record. No free-form AI guessing is presented without a hard link to the codebase.
- **Strict Human-in-the-Loop:** It behaves as a workflow management tool; it requires humans to validate the machine's work rather than trusting the machine blindly.
- **Targeted Domain:** It focuses solely on extracting requirement-to-code traceability, not writing code or summarizing pull requests.

## 7. Key Technical Decisions
- **Modular Monolith (NestJS):** Segregated APIs, workers, and domains.
- **Asynchronous Workers (BullMQ):** Heavy AST extraction, git history scanning, and LLM orchestration are delegated to background queues.
- **CQRS / Idempotency:** Queue processors execute idempotent use cases backed by strict Postgres unique constraints.
- **Next.js UI with API Separation:** The UI acts exclusively as a consumer of backend contracts (`@ba-helper/contracts`) and does not perform any direct database mutations or business logic.

## 8. Evidence & Traceability Model
The system creates a deterministic graph mapping Requirements → Impacts → Artifacts → Evidence. 
Every node is backed by real code lines (e.g., `booking.service.ts: L45-60`). If the extraction parser cannot find evidence, the system defaults to flagging the impact as an `UNKNOWN` or a risk, rather than inventing fake evidence.

## 9. Human Review & Final Report Guarantees
The system guarantees that the **Final Reviewed Report** is strictly tied to an immutable reviewed snapshot.
When a "Snapshot" is taken, all live decisions are deeply copied into a `ReviewedReportSnapshot`. The final report is derived *exclusively* from this snapshot. Post-snapshot decision drift (if a user continues editing) does not mutate the historical snapshot, ensuring the downloaded `.md` file is a perfect, deterministic reflection of the audited state at the exact millisecond the snapshot was taken.

## 10. Testing Story (E17A + E17B)
To prove the reliability of the audit workflow, the system is backed by strict invariants:
- **E17A (Backend Integration):** E2E test suites enforce that missing snapshots or unreviewed links fail the gate, and that post-snapshot modifications do not alter the exported payload.
- **E17B (Frontend Integration):** UI test suites (using MSW and JSDOM) enforce that the download gate correctly blocks interactions when incomplete, and properly triggers a Blob download constructed strictly from the frozen payload when complete.

## 11. Demo Flow
The optimal way to demonstrate BA Helper is sequentially:
1. Show the **Analysis Workspace** where the impact graph is visualized.
2. Open the **Evidence Quality Table** to show the strict linkage between impacts and code.
3. Perform **Review Decisions** on traceability links, transitioning them to `ACCEPTED` or `REJECTED`.
4. Trigger the **Snapshot** action to lock the state.
5. Display the **Final Review Gate** transitioning from blocked to complete.
6. Open the **Final Reviewed Report** read-only viewer.
7. Execute the **Markdown Download**, demonstrating the deterministic file output.

## 12. Known Limits & Honest Boundaries
- **Language Lock-in:** Currently, deep parser confidence is limited to TypeScript/NestJS repositories.
- **Vector Boundaries:** Embedding retrieval is strictly scoped by commit SHA.
- **No Production AI Modification:** The LLM does not write or push code. It acts strictly as an analytical reader to propose traceability links.
- **Not a Formal Verification Engine:** While the workflow ensures human oversight and immutable snapshotting, the underlying extraction relies on heuristics and LLM mapping, making it a robust BA assistance tool, not a strictly proven formal verification engine.
