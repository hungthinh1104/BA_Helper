# Analysis Invariants

## Core Invariant Map

The analysis product model is built around traceability:

```text
RequirementRevision
-> RepositorySnapshot
-> Evidence
-> TraceabilityLink / BaInsight / QA Scenario / Risk / Unknown
-> ReviewDecision
-> ReviewedReportSnapshot
```

These invariants apply to backend behavior, API read models, UI rendering, and
generated reports.

## Evidence And Certainty

- `EVIDENCED` insight must link to at least one persisted `Evidence` record.
- `INFERRED` insight must be visually separated from `EVIDENCED` insight.
- `UNKNOWN` is not `RISK`.
- `RISK` is not `QUESTION`.
- `CONFLICTING` must represent incompatible or ambiguous evidence, not a weak
  confidence score.
- Missing policy or missing code support becomes `UNKNOWN`, `CONFLICTING`, or a
  stakeholder question, never an invented business rule.

## QA Traceability

- QA scenario must link to at least one risk, unknown, evidence item, or
  affected artifact.
- QA scenario text should be testable as given/when/then or an equivalent
  explicit regression target.
- QA scenario generation must preserve snapshot and requirement revision
  provenance.

## Review And Reports

- Final report must render from `ReviewedReportSnapshot`, not mutable live
  state.
- Finalization is an explicit user action; AI output alone cannot finalize.
- Completed historical output stays completed even when it is stale.
- Staleness is derived independently from lifecycle status.
- Review/finalization must not commit as current when a concurrent
  `RepositoryTarget` observation has already made the analysis stale.

## Snapshot And Drift

- Every analysis and generated artifact is tied to a repository snapshot and
  its `commitSha`.
- Moving-ref freshness is computed through the selected repository target; it is
  not stored as mutable snapshot identity.
- Snapshot identity and freshness account for `repositoryId`, `commitSha`,
  `analyzerVersion`, and `profileVersion` where persisted.
- Scanner capability/version must be exposed through snapshot diagnostics or an
  explicit field before it is used as identity.
- Snapshot drift uses exact `artifactKey` matching and artifact-level
  `contentHash`.
- `Evidence.contentHash` must not be used as a proxy for artifact content
  changes.
- If artifact-level `contentHash` is unavailable, changed/unchanged drift must
  be marked unavailable or a migration must add `CodeArtifact.contentHash`.

## Domain Packs

- Domain pack is hint, not evidence.
- Evidence remains the source of truth.
- Human review remains the final decision.
- Domain packs may guide retrieval, wording, risk templates, and QA scenario
  templates.
- Domain packs must not create `EVIDENCED` impacts by themselves.
- Every public domain pack must expose status: `STABLE`, `PARTIAL`,
  `EXPERIMENTAL`, or `FALLBACK`.
- `booking@0.1.0` is the current `STABLE` profile.
- `general@0.0.0` is the safe `FALLBACK` profile and must not contain
  booking-specific concepts, retrieval hints, risks, QA templates, or unknown
  templates.
- Booking remains the stable MVP domain; broad multi-domain claims are out of
  scope until each pack has status, limits, and evaluation cases.

## Presentation Boundary

- Frontend renders backend state and capabilities; it must not derive business
  state from progress or local guesses.
- For example, `progress === 100` does not imply review complete, snapshot
  locked, report generated, or drift clean unless the contract explicitly says
  so.
- Public API and frontend wire types live in `packages/contracts`.
- Prisma models are internal persistence representations and must not be
  returned directly as API responses.
- UI certainty labels must come from the contract; it must not invent new
  labels.
- Presentation read models may group, count, and order data for UX, but must
  preserve links back to persisted evidence, artifacts, review decisions, and
  snapshot provenance.

## AI And Security

- AI is not a source of truth and must not write directly to the database.
- Code comments, requirement text, and evidence excerpts are untrusted data, not
  instructions.
- Every selected prompt payload sent to a real-provider LLM must be
  secret-redacted before transmission.
- Final reports are snapshot-sourced and must not require an active LLM call.
