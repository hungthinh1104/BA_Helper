Landing = Letters-inspired light style
Workspace = Linear-inspired dark style
Do not mix them blindly
Landing prioritizes clarity/trust
Workspace prioritizes density/evidence review

Letters uses light theme, blue gradient, rounded cards, black CTA, blue accent.
Linear uses dark command-center, compact density, mono/code surfaces.
## Static Test Trace In Review

The active review workbench shows code-to-test references below the selected
item's evidence. Match artifacts by backend artifact keys and validate the
analysis/snapshot/commit/analyzer identity before rendering. Source paths are
vertical ordered steps on desktop and mobile, so review does not require the
full dependency graph. Each relationship can open its source evidence using a
Sheet. Decision shortcuts must not fire while a source dialog has focus.

Use explicit labels: direct reference, static call path and no reference found
in inspected paths. Keep the static/non-execution explanation visible. Loading,
request failures, legacy metadata and uninspected artifacts have distinct
states. Show backend search limits and readable limitation messages, including
partial scans and omitted cases. Selection, expansion and display pagination
are local UI state; classification and provenance come from the backend.

The read-only reviewed report also renders saved paths from its response
payload. It does not fetch live QA or live excerpts to fill historical gaps.
Markdown and PDF carry the same captured source-path appendix. Use existing
theme tokens and UI primitives; the trace supplements the review loop and
requires no separate dashboard or workflow.
