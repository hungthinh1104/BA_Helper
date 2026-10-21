Landing = Letters-inspired light style
Workspace = Linear-inspired dark style
Do not mix them blindly
Landing prioritizes clarity/trust
Workspace prioritizes density/evidence review

Login inputs and submission remain disabled while the client auth session is
loading, so early interaction cannot submit the server-rendered native form
before hydration. Typography uses the existing CSS token stacks; do not load
unused remote font families during compilation.

After a review decision, auto-advance to the next visible `needs_review` item,
wrapping to earlier pending items. Skip accepted/rejected items and keep the
selection when there is no pending successor. Manual navigation may still open
reviewed items; finalization continues to use backend capabilities.

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

Report diagrams use Mermaid strict mode with SVG text labels and a separate
DOMPurify SVG-only sanitization before DOM insertion. Suppress Mermaid's error
markup and show the original chart as escaped text on failure. Clear a previous
diagram on input changes and ignore late results from earlier render requests.

For `testCase.parameterized: true`, show the localized source-declaration
notice in both live and saved traces. Keep title placeholders intact and make
clear that data rows have not been expanded. Markdown/PDF appendices carry the
same notice. Never display generated row counts or execution results from it.
