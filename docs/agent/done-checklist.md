# Done Checklist

Use this checklist before reporting a task as complete. Mark an item not
applicable only when the task did not affect that area.

## Scope And Quality

- [ ] The changed behavior is tied to an existing MVP use case or explicitly
      requested extension.
- [ ] Only related modules/files changed.
- [ ] No new God service, circular dependency, or unrelated responsibility was
      introduced.
- [ ] Controller, processor, adapter, repository, and mapper boundaries follow
      [code-quality-governance.md](code-quality-governance.md).
- [ ] Large file/function thresholds in
      [code-organization.md](code-organization.md) were respected or justified.

## Input And Provenance

- [ ] Invalid or unsupported input is rejected before confident analysis.
- [ ] Requirement behavior changes preserve immutable `RequirementRevision`
      title and input history.
- [ ] Analysis/output changes preserve snapshot `commitSha` and
      `analyzerVersion` provenance.
- [ ] Moving-ref freshness uses the selected `RepositoryTarget`; it is not
      accidentally stored as mutable snapshot identity.
- [ ] Sensitive/untrusted requirement and source content is treated as data,
      is redacted before real-provider transmission, and is not treated as
      instructions.

## State And Persistence

- [ ] Lifecycle changes go through state transition policy functions.
- [ ] Status, stage, and derived freshness remain separate.
- [ ] Capability responses were updated if action availability changed.
- [ ] Retryable writes remain idempotent and are covered by stable keys or
      constraints.
- [ ] Failed scan attempts do not publish failed/in-progress snapshot records.
- [ ] Known staleness is described as persisted observation, not unverified
      remote freshness.
- [ ] Review/finalization freshness checks are protected from concurrent target
      observation updates.
- [ ] Meaningful review/state/output actions record the required audit event
      (see [auth-permissions.md](auth-permissions.md) for the full required
      event list: PROJECT_CREATED, REPOSITORY_ADDED, SCAN_STARTED,
      SCAN_COMPLETED, SCAN_FAILED, REPOSITORY_TARGET_OBSERVED,
      REQUIREMENT_CREATED, ANALYSIS_STARTED, ANALYSIS_FAILED,
      INSIGHT_CONFIRMED, INSIGHT_REJECTED, TRACEABILITY_LINK_CONFIRMED,
      TRACEABILITY_LINK_REJECTED, ANALYSIS_FINALIZED, DOCUMENT_EXPORTED).
- [ ] No asynchronous persistence/state/event operation is left as an
      untracked or floating promise.

## Evidence And AI

- [ ] `EVIDENCED` claims have direct persisted evidence.
- [ ] `INFERRED`, `UNKNOWN`, and `CONFLICTING` outputs obey their evidence and
      reasoning requirements.
- [ ] Missing policy is not converted into an invented fact.
- [ ] AI output remains schema-validated and the AI adapter does not write DB.
- [ ] AI-referenced evidence IDs are restricted to the retrieved evidence
      bundle for the analysis.
- [ ] Generated documents, and any future diagrams, consume persisted
      insight/review data and remain bound to snapshot provenance; approved
      projections use current review decisions.

## Contracts And Consumers

- [ ] Public responses use contracts/mappers, not raw Prisma relation shapes.
- [ ] Contract changes update schemas, mappers, API tests, and consumers.
- [ ] Public enum/type changes are defined in contracts rather than duplicated
      by frontend or leaked from Prisma.
- [ ] State enum changes update state docs, capabilities, and tests.

## Analyzer Changes

- [ ] Scanner/graph changes follow [analyzer-rules.md](analyzer-rules.md).
- [ ] Fixture expected artifacts/edges/coverage were updated when extraction
      behavior changed.
- [ ] Keyword-noise and unsupported-input behavior remains tested.

## Verification

While the repository remains documentation-only, verify document consistency
and record that executable checks are not available.

Once workspace scripts exist, run relevant checks before finishing:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

- [ ] Typed/stable application error codes and safe structured logs were used
      for changed failure paths.
- [ ] Logs do not expose raw source, secrets, or unredacted AI inputs/outputs.
- [ ] Security/limit diagnostics changed in backend are visible in the
      repository detail UI and covered by hostile-input tests when applicable.
- [ ] Separate web/API deploy changes keep `NEXT_PUBLIC_API_URL`,
      `CORS_ALLOWED_ORIGINS`, and workspace bootstrap behavior explicit and
      documented.

When applicable:

```text
Prisma change       migration + generate + persistence/contract tests
API contract change Zod schema + mapper + API/consumer tests
State change        enum + policy + capabilities + tests + docs
AI schema change    validation + fake provider/golden tests
Analyzer change     fixture output + extraction/retrieval tests
```
