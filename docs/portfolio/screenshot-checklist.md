# BA Helper: Portfolio Screenshot & Recording Checklist

To effectively present BA Helper in a portfolio or case study, capture the following visual assets. Ensure sensitive data (if any) is mocked or obfuscated.

## 1. Analysis Workspace (The Impact Graph)
- **Goal:** Show the complexity and structure of the parsed backend.
- **Visuals:** 
  - The node/edge visualization of impacted services, controllers, and database models.
  - Sidebar showing the raw business requirement.

## 2. Evidence Quality Table
- **Goal:** Prove the system is grounded in real code, not black-box hallucinations.
- **Visuals:**
  - Table displaying Impacted Artifacts mapped to specific `ProvenanceKey`s (e.g., file paths and exact line numbers).
  - Code excerpt snippets visible in the UI.

## 3. Human Review Decisions
- **Goal:** Highlight the human-in-the-loop workflow.
- **Visuals:**
  - A traceability link card or table row showing the dropdown/buttons for `ACCEPTED`, `REJECTED`, `NEEDS_MORE_EVIDENCE`.
  - Visual indicators showing progress (e.g., "3/5 Reviewed").

## 4. Final Review Gate (Blocked State)
- **Goal:** Demonstrate the strict audit enforcement.
- **Visuals:**
  - The Final Review Gate panel clearly displaying the `UNREVIEWED_TRACEABILITY_LINKS` and `REVIEWED_SNAPSHOT_MISSING` blocking reasons.
  - The "View Final Reviewed Report" and "Download .md" buttons visibly disabled.

## 5. Snapshot Locked State
- **Goal:** Show the transition to immutability.
- **Visuals:**
  - A toast notification or visual badge confirming "Snapshot Created Successfully".
  - The Final Review Gate updating to 100% complete with 0 unreviewed links.

## 6. Final Reviewed Report Viewer
- **Goal:** Show the deterministic output payload.
- **Visuals:**
  - The read-only markdown rendering of the final report.
  - The explicit distinction between AI-proposed state and human-verified final state.

## 7. Markdown Download Action
- **Goal:** Prove the offline export capability.
- **Visuals:**
  - A short GIF or recording clicking "Download .md".
  - The downloaded file opened in an editor, highlighting the deterministic naming convention (`final-reviewed-report-{analysisId}-{snapshotId}.md`).
