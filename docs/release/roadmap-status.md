# Roadmap Closure Status

This is the authoritative engineering status and closure order for the
Booking/Payment/Refund MVP.

## Current status (2026-10-22)

This section is the current summary. Dated verification documents are
historical snapshots and do not certify a later checkout. The current analyzer
contract version is analyzer@0.10.0.

| Gate | Current state | Next evidence needed |
| --- | --- | --- |
| Release verification | The latest detailed local records are [October 21 verification](local-verification-2026-10-21.md) and [maintenance](maintenance-2026-10-21.md). This documentation pass did not rerun the release gates, and those records do not certify the current working tree or hosted CI. | Run `pnpm verify:stability` on the reviewed revision and retain commit-matched local and hosted CI evidence. |
| Analyzer and semantic evidence | Static Jest source extraction, bounded behavior claims, explicit unresolved diagnostics, and opt-in runtime-trace import are documented. The [application source-corpus report](../evaluation/application-test-trace.md) records analyzer@0.7.0 results; they are historical, not current 0.10.0 accuracy results. | Re-run the existing [analyzer and trace evaluation gates](../evaluation/static-test-trace.md) against the current version; independently adjudicate labels and add held-out source tasks before broader accuracy claims. |
| Product validation | The [reviewer-study protocol](../evaluation/product-validation.md) exists; no reviewer time or accuracy observations are recorded. | Run the counterbalanced study described in product validation and static trace evaluation. |
| SaaS | Locked. Private repository access, organizations, hosted multi-tenancy, billing, and compliance work remain outside the MVP. | Open only if provenance-backed product validation meets the entry gate in Phase 5. |

Keep the Booking/Payment/Refund MVP boundary. Use the
[documentation guide](../README.md) to find canonical policy and understand
which dated files are historical.

## Historical implementation and verification summary

The following phase descriptions summarize prior engineering work. Exact
commands, metrics, skips, and environment details belong to the dated evidence
records linked from each phase; do not treat old test counts as current status.

## Phase 1 — Close the refactor

Status: **ENGINEERING_IMPLEMENTED**

- Application and backend-runtime ownership is defined by ADR-0010.
- Package dependency boundaries and subpath exports are enforced in CI.
- Scan/document orchestration lives in application; runtime owns adapters and
  composition.
- API and worker build independently without cross-app source imports.
- `verify:architecture-boundaries` now enforces the ADR generally: any
  `*.usecase.ts` or domain `*.policy.ts` under `backend-runtime` fails the check
  (previously only two retired filenames were denylisted), app-to-app imports are
  blocked in both directions, and workspace package cycles are detected.

Tracked ADR-0010 debt (allowlisted in the checker, not yet migrated):

- `backend-runtime/.../get-impact-diff.usecase.ts` is Prisma-coupled and needs a
  repository-port extraction before it can move to `application`.
- `event-log`, `queue`, and `scanner` domain `*.policy.ts` files remain in
  `backend-runtime` pending relocation.
- Apps still import many symbols from the broad `@ba-helper/backend-runtime`
  root barrel rather than the narrow capability subpaths; this is import hygiene
  (deep `/src` imports are already blocked) and is planned, not a correctness gap.

## Phase 2 — Make analyzer quality enforceable

Status: **ENGINEERING_IMPLEMENTED**

- The quality gate now drives the **production path** — the same
  `RunScanJobUseCase` → `RunImpactAnalysisUseCase` orchestration the API/worker
  use, wired to the deterministic fake AI/embedding providers through the real
  DI graph (`tests/evaluation/adapters/production-path.adapter.ts`). It does not
  reimplement analyzer logic; it reads persisted `TraceabilityLink`, `BaInsight`,
  and `InsightEvidence` rows back from the database.
- Six metrics are computed and separated: `criticalArtifactRecall`,
  `overallArtifactRecall`, `artifactPrecision`, `evidenceCoverage`,
  `negativeControlPassRate`, `orphanEvidencedClaims`. Grading is two-layer:
  recall/critical-recall/evidence on the retrieval net, and
  precision/negative-control/orphan on the AI-adjudicated EVIDENCED-claim set.
- Per-case failure floors are enforced in addition to aggregate thresholds, so a
  single broken case cannot be hidden by an average. Blocking thresholds:
  criticalArtifactRecall 1.0, overallArtifactRecall 0.85, artifactPrecision 0.7,
  evidenceCoverage 1.0, negativeControlPassRate 1.0, orphanEvidencedClaims 0.
- `requiredEvidenceAnchors` assert that a found artifact's evidence excerpt
  contains an expected substring.
- Regression beyond tolerance fails CI and emits `analyzer-scorecard.json`
  (uploaded even on gate failure).

Known scope bounds (honest, not fabricated):

- The **20** production-path cases cover authored booking/payment, order/
  inventory and user-onboarding fixtures. Their deterministic fake-provider
  outputs check orchestration and curated scenario behavior. They do not
  measure real-provider accuracy or independent application generalization.
- The October 20 local run measured critical and overall retrieval recall 1.0,
  curated-claim precision 0.975, evidence coverage 1.0, negative-control pass
  rate 1.0 and no orphan evidenced claims, with unchanged thresholds. A positive
  case with no committed claims now fails instead of benefiting from empty-set
  precision. The previous inventory-recall note is historical; these numbers
  apply only to the current fixed fixture suite.
- The separate public trace corpus verifies upstream source hashes and counts
  misses and false positives explicitly. It records the 0.5.1 baseline and
  emits a versioned 0.6.0 scorecard without installing or running external code.
- Numeric confidence is not presented as a probability claim.

## Phase 3 — Controlled beta hardening

Status: **ENGINEERING_IMPLEMENTED / EXECUTABLE_RELEASE_EVIDENCE_AVAILABLE**

Implemented and unit/e2e-tested:

- Production uses local email/password auth; dev-login is forbidden.
- **Emails are normalized** (`trim().toLowerCase()`) at the contract boundary; a
  migration backfills legacy rows (aborting on case-variant collisions) and adds
  a case-insensitive unique index.
- **Login throttling is Redis-backed and split per-IP AND per-normalized-email**,
  and fails **closed** (typed 503) when Redis is unavailable.
- **Account lifecycle is complete**: provision, list, get, enable, disable,
  reset-password, update-role, self change-password — each audited, with an
  ADMIN audit-read endpoint and session revocation via `credentialsVersion`.
- **Health endpoints are split**: public `/system/live` (process only) and
  `/system/ready` (dependency up/down, no config/queue leak); ADMIN-only
  `/system/operations`. The public surface no longer leaks workspace mode or
  queue counts.
- **Production compose is hardened**: Postgres/Redis are not published on the
  host, Redis requires authentication, and the boot guard rejects the example
  placeholder secrets.
- **The browser reaches the API same-origin** via a Next `/api/v1/*` proxy; no
  absolute API origin is baked into the client bundle.
- **Queue recovery**: retryable/terminal error classification on all four
  processors; admin retry is audited, guarded against concurrent duplicates, and
  keyed on the product entity id; a worker-bootstrap reconcile fails stale
  `RUNNING` rows; failed-job retention is bounded; duration/retry metrics are
  emitted.
- English and Vietnamese final reports have E2E coverage.
- Public GitHub TypeScript/NestJS is the only `STABLE` beta path.

Executable release evidence:

- An **executable release drill** (`pnpm verify:release-drill`,
  `scripts/run-release-drill.ts`) builds the production images, boots the
  production compose profile in isolation (on free ephemeral ports, hermetic
  env), migrates, and asserts the release path: dev-login disabled, non-leaking
  `/live` + `/ready`, ADMIN-gated `/system/operations`, a weak-secret **boot
  guard that fails closed**, the web login page, **api + worker restart
  survival**, and a **logical backup restore** into a temporary database
  (pgvector + a seeded row survive). It emits machine-readable evidence to
  `artifacts/release/production-release-drill.json`. The live scan → analyze →
  finalize → EN/VI export leg is **skipped** (the prod boot guard forbids the
  fake provider and the drill uses no live credentials); that path is covered
  deterministically by `verify:analyzer-quality` and `demo:golden-path`.
- The **controlled-beta readiness gate** now derives its `production-startup` and
  `restore-drill` PASS from that executed drill evidence — and asserts the drill
  ran on the commit being certified (freshness) — instead of grepping
  documentation substrings.
- A **migration-upgrade / data-survival** gate (`pnpm verify:migration-upgrade`)
  applies the previous schema, seeds legacy data, applies this branch's
  migrations, and asserts the data survived and the upgrades took effect; it runs
  in per-push CI.

The full pre-tag gate runs via `pnpm verify:stability` (which now runs
`verify:release-drill` before the readiness gate).

```bash
pnpm verify:release-drill && pnpm verify:controlled-beta-readiness
```

## Phase 4 — Product validation

Status: **READY_FOR_FIELD_DATA**

The measurement schema, scorecard, provenance rules, baseline comparison, and
`PROMOTE / DEFER / INCONCLUSIVE` decision gate are complete. Actual elapsed
time, reviewer-confirmed evidence, accepted QA scenarios, useful unknowns, and
rerun/drift usefulness must come from Technical BA/QC review sessions. They
cannot be generated or inferred by the repository.

```bash
pnpm validate:product-beta -- candidate.json baseline.json
```

Phase 4 becomes evidence-complete only when real, provenance-locked datasets
produce a reviewed comparison artifact.

## Phase 5 — SaaS

Status: **LOCKED**

GitHub App, private repository access, multi-tenant isolation, SSO/OIDC,
billing, deletion/export, distributed deployment, and compliance controls are
deliberately not implemented. Phase 5 may start only after:

```bash
pnpm verify:saas-entry -- artifacts/product-validation/comparison.json
```

returns `OPEN`. A missing, inconclusive, or deferred product-validation result
keeps the phase locked.

## UI work boundary

UI improvements may proceed without expanding product scope. They must preserve
backend-derived state, evidence/review/provenance visibility, the controlled
beta capability matrix, and the Phase 5 lock.

