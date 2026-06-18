# Candidate Discovery Runbook

## Purpose

Phase 4F exists to stop weak public cases from leaking into dataset v0 just
because they are easy to scan or happen to reach `VECTOR_READY`.

This phase produces a shortlist only. It does not produce benchmark output.

## Why Existing v0 Cases Are Blocked

Current blocked states are different and must stay distinct:

- `ndmen/booking` has a real `VECTOR_READY` snapshot, but no aligned public
  backend case was verified for dataset use.
- `nestjs/nest` case 004 aligns by commit, but indexing failed under the real
  Google embedding quota after about 807 texts.
- `lujakob/nestjs-realworld-example-app` cases and the BA_Helper case rely on
  historical base commits that are not currently materialized by the existing
  public-ref scan workflow.
- `Saluki/nestjs-template` PR #55 proved a small repo can reach real
  `VECTOR_READY`, but the case was rejected because it mostly adds new auth
  files instead of modifying existing backend code.

## Why `VECTOR_READY` Alone Is Insufficient

`VECTOR_READY` only proves runtime viability:

- the repo can be scanned
- embeddings were created
- chunks exist

It does **not** prove evaluation quality.

A valid ReqImpact v0 case still needs:

- changed backend files that already exist in the base snapshot
- a clear behavior or logic change from public evidence
- a changed-files proxy that is meaningful at file level
- a repo small enough to stay under quota

## What Good Backend Behavior Cases Look Like

Prefer cases with:

- 1 to 5 changed backend files
- existing files modified, not mostly new files
- a public PR or commit title/body that explains the bug or behavior clearly
- backend logic such as:
  - validation rule changes
  - auth or permission bugfixes
  - service logic fixes
  - relation mapping fixes
  - controller response fixes
  - error handling fixes

## What To Reject Early

Reject candidates when they are mostly:

- docs-only
- dependency-only
- CI-only
- frontend-only
- formatting-only
- generated-file churn
- template or scaffold expansion
- large framework rewrites
- new module introductions that overpower existing-file impact

Also reject or defer when:

- the repo is too large for the current embedding quota
- the public evidence is too weak to write a defensible requirement text
- the current scan workflow cannot materialize the exact base snapshot safely

## How To Avoid Weak Template/Scaffold Cases

Avoid candidates where the changed-files proxy is dominated by:

- newly added controllers
- newly added auth modules
- newly added common infrastructure
- mass file creation under `src/modules/*`

Those cases may be valid software changes, but they are weak ReqImpact v0 file
retrieval cases because they measure greenfield implementation more than
impact-on-existing-code retrieval.

## How To Avoid Quota-Heavy Repositories

Use repo size as an early gate:

- `SMALL`: ideally under about 150 backend tree files
- `MEDIUM`: borderline; inspect carefully
- `LARGE`: reject for first aligned vector-ready case unless there is a very
  strong reason

Large repos can still be semantically good, but they are a bad first target for
the current real-embedding quota window.

## How To Avoid Snapshot Leakage

Do not force a dataset case to match an arbitrary existing local snapshot.

The invariant stays:

- choose a good public case first
- then create or reuse a local snapshot that matches the case base SHA

Not the reverse.

If the current product scan workflow cannot materialize the exact public base
SHA without runtime changes, stop and document that blocker instead of silently
using a nearby snapshot.

## Phase 4G Decision Rule

For the next phase:

1. Start from the recommended candidate only.
2. Try to create a local snapshot at the exact `baseSha`.
3. If exact checkout fails under the existing workflow, stop and document the
   workflow blocker.
4. If snapshot creation succeeds, run scan/index with the real embedding
   provider.
5. Only if the snapshot becomes `VECTOR_READY`:
   - add `Case 006`
   - add override mapping
   - regenerate `rag-samples.v0.*`
6. Do not generate current-hybrid benchmark output yet.
