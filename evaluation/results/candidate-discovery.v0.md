# Candidate Discovery v0

Generated at: 2026-06-18T06:05:19Z

- Phase: `4F-candidate-discovery`
- Inspected candidates: `7`
- Quality PASS: `1`
- Recommended next candidate: `candidate-001-squareboat-default-includes`

This is not a benchmark result.
No retrieval was executed.
No `vector-baseline.v0.json` was created.
No `rag-samples.current-hybrid.v0.*` output was created.

## Summary Table

| Candidate | Repo | Change | Scan Size | Existing File Ratio | Behavior Signal | Base Resolvable | Decision | Why |
| --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| `candidate-001-squareboat-default-includes` | `squareboat/nestjs-boilerplate` | PR #37 | SMALL | 1.00 | STRONG | yes | PASS | Best compact existing-file backend bugfix found in this sweep. |
| `candidate-002-squareboat-db-config-bug` | `squareboat/nestjs-boilerplate` | commit `104ca22` | SMALL | 1.00 | MEDIUM | yes | NEEDS_MORE_INSPECTION | Good shape, but public evidence is only a commit title. |
| `candidate-003-saluki-authentication-pr55` | `Saluki/nestjs-template` | PR #55 | SMALL | 0.36 | STRONG | yes | REJECT | Mostly new auth scaffolding, not impact on existing backend code. |
| `candidate-004-sociologin-refresh-token-once` | `adisusilayasa/sociologin` | commit `0e58e08` | LARGE | 0.92 | STRONG | yes | REJECT | Good auth logic change, but repo is too large for current quota-safe discovery. |
| `candidate-005-saluki-health-check-pr33` | `Saluki/nestjs-template` | PR #33 | SMALL | 0.50 | MEDIUM | yes | REJECT | Mostly new endpoint addition, weak file-level impact proxy. |
| `candidate-006-spaceuy-auth0-pr15` | `SpaceUY/NestJS-Template` | PR #15 | LARGE | 0.67 | STRONG | yes | REJECT | Broad auth replacement on a quota-heavy repo. |
| `candidate-007-spaceuy-logger-pr25` | `SpaceUY/NestJS-Template` | PR #25 | LARGE | 0.41 | WEAK | yes | REJECT | Logging infrastructure refactor, not requirement-to-behavior impact. |

## Recommended Candidate

### `candidate-001-squareboat-default-includes`

- Repo: `https://github.com/squareboat/nestjs-boilerplate`
- PR: `https://github.com/squareboat/nestjs-boilerplate/pull/37`
- Base SHA: `33ca78792610f1b0ece552767ef370bcb1978205`
- Head SHA: `355af958495378cb6d24e75316d1a41128699653`
- Changed backend files:
  - `libs/boat/src/transformers/transformer.ts`

Why this is the best current candidate:

- single existing backend file change
- explicit bug statement in the PR body
- backend tree size is about 116 files, which is inside the current quota-safe target band
- supports file-level changed-files proxy ground truth cleanly

Remaining risk before Phase 4G:

- the case passes the **quality gate**
- it does **not** automatically pass the **current public-ref scan workflow**
- Phase 4G must prove that the exact `baseSha` can be materialized locally without changing product runtime behavior

## Candidate Notes

### `candidate-002-squareboat-db-config-bug`

- Commit: `https://github.com/squareboat/nestjs-boilerplate/commit/104ca22ae5faff545c012d00d9d7441a69195a41`
- Base SHA: `b2a464354d9ba786204909daa4bf232f9b273ffa`
- Changed backend files:
  - `config/database.ts`

Why it was not recommended first:

- very compact and likely cheap to scan
- but public evidence is only the commit title `FIX: db config bug`
- requirement text derivation would be weaker than the PR-backed squareboat candidate

### `candidate-003-saluki-authentication-pr55`

- PR: `https://github.com/Saluki/nestjs-template/pull/55`
- Base SHA: `d10b46097021e9d1fe8286995a0b685c8a444dfe`
- This is the candidate that already reached real `VECTOR_READY` locally.

Why it was rejected:

- the PR is dominated by newly introduced auth files
- changed-files proxy would describe greenfield implementation work more than impact on existing backend code
- `VECTOR_READY` alone is insufficient for ReqImpact dataset quality

### `candidate-004-sociologin-refresh-token-once`

- Commit: `https://github.com/adisusilayasa/sociologin/commit/0e58e0872a852eaa5e0013fd2e81a9fffe2740b1`
- Changed backend files include:
  - `src/auth/auth.controller.ts`
  - `src/auth/auth.service.ts`
  - `src/session/session.service.ts`

Why it was rejected:

- strong auth behavior signal
- but backend tree size is around 262 files
- current embedding quota risk is too high for a first vector-ready research case

### `candidate-005-saluki-health-check-pr33`

- PR: `https://github.com/Saluki/nestjs-template/pull/33`
- Changed backend files:
  - `src/modules/common/common.module.ts`
  - `src/modules/common/controller/healthz.controller.ts`

Why it was rejected:

- clean public evidence and small repo
- but the main backend artifact is a newly added health-check controller
- this is closer to feature scaffolding than impact over established code

### `candidate-006-spaceuy-auth0-pr15`

- PR: `https://github.com/SpaceUY/NestJS-Template/pull/15`
- This is a broad Auth0 migration across many auth files.

Why it was rejected:

- wide auth subsystem replacement
- open PR base can drift
- repo backend tree is around 203 files, above the preferred quota-safe threshold

### `candidate-007-spaceuy-logger-pr25`

- PR: `https://github.com/SpaceUY/NestJS-Template/pull/25`
- This change introduces provider-agnostic logger infrastructure.

Why it was rejected:

- not a strong requirement/domain behavior case
- most value sits in newly added logger abstraction files
- poor fit for the ReqImpact requirement-to-code evaluation story

## Phase 4G Plan

If Phase 4G proceeds with the recommended candidate:

1. Use the existing product workflow to create a local snapshot at `candidate-001` base SHA.
2. If exact base SHA checkout cannot be materialized without runtime changes, stop and document the blocker.
3. If snapshot creation succeeds:
   - run scan/index with the real embedding provider
   - rerun DB readiness probe
   - rerun case-snapshot alignment
4. Only if the snapshot becomes `VECTOR_READY`:
   - add `Case 006`
   - add override mapping
   - regenerate `rag-samples.v0.*`
5. Do not generate current-hybrid benchmark output in Phase 4G.

