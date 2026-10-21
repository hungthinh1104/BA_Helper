# Roadmap Closure Status

This is the authoritative engineering status and closure order for the
Booking/Payment/Refund MVP.

## Current completion order

The agreed closure order is:

1. **P0 — Release verification:** resolve failing assertions and full web
   typechecking, enforce web/browser CI gates, and execute migrations, upgrade
   survival and the scan/review/report E2E path. Implementation alone does not
   close this phase; passing evidence must identify the tested commit.
2. **P1 — Analyzer accuracy:** evaluate independent NestJS repositories pinned
   to commits against independently authored ground truth; measure precision,
   recall and unsupported patterns.
3. **P2 — Resolver improvement:** address `TestingModule.get()` and other
   patterns according to the measured failures, with regression fixtures.
4. **P3 — Product validation:** measure whether visual traces improve review
   accuracy or time, comparing the same workflow with and without traces.

P0 has executed local database, browser, test and production Docker gates;
see [the October 20 verification record](local-verification-2026-10-20.md).
Release certification still requires CI on a reviewed committed revision.
Keep the Booking/Payment/Refund scope throughout this sequence. The SaaS entry
policy below remains in force.

October 20 implementation progress:

- PostgreSQL/Redis, additive migrations, legacy-data upgrade/retry verification
  and the production Docker drill have executed locally. Final verification is
  against the current working tree; it is not certification of a clean commit
  or a hosted CI run.
- Browser verification now starts the real document worker, reviews through
  the UI, inspects source evidence and checks frozen report paths after the
  live edge is removed. It also caught and repaired pending-item navigation
  and early login interaction defects.
- P1 has an initial source-audited corpus from three external repositories:
  22 cases, 24 TESTS and 10 CALLS relationships. These are selected samples,
  not full-application accuracy measurements or human-adjudicated labels.
- P2 resolves the measured TestingModule class-token acquisition pattern in
  `analyzer@0.6.0`; the same fixed corpus is now a regression set. Broader
  held-out application repositories and independent human review remain.
- P3 has a comparison protocol; no reviewer time/accuracy results have been
  collected. See [static trace evaluation](../evaluation/static-test-trace.md).

October 21 application evaluation:

Local checks passed: 1,128 root tests, 103 API E2E tests, 199 analyzer tests,
backend/web typecheck, lint, quality and regression gates. See
[October 21 verification](local-verification-2026-10-21.md).

- P1 now includes source slices from pinned Amplication and Novu application
  commits: 27 source test declarations, 28 desired TESTS and 22 CALLS. Labels
  were frozen before the first analyzer run; no independent human adjudication
  has occurred. This remains selected-source accuracy, not whole-app impact
  accuracy. Novu's unbound Mocha globals are explicitly a parser syntax
  assumption, not proof of Jest runner identity.
- P2 `analyzer@0.6.1` restores two CALLS to private service helpers and three
  TESTS through a bounded local constructor factory. On these unchanged labels,
  CALLS recall is 22/22 and TESTS recall improves from 21/28 to 24/28, with no
  observed false positives. Four `it.each` source declarations remain missed;
  overall accuracy stays incomplete. CI checks the precise regression budget
  separately and uploads the full scorecard.
- Next engineering work is to model parameterized source declarations without
  claiming runtime case expansion, then repeat evaluation on new source tasks.
  P3 still requires real reviewers. See [application evaluation](../evaluation/application-test-trace.md).

October 21 parameterized declarations and cleanup:

Latest local verification passed: 1,147 root tests, 213 analyzer tests, 101 web
tests, 103 API E2E tests, three browser scenarios, typecheck/lint and corpus/
quality gates. Production Docker verification passed 11 checks and explicitly
skipped real-provider live analysis because credentials are absent. Details:
[0.7.0 verification](local-verification-2026-10-21.md#analyzer-070-follow-up).

- `analyzer@0.7.0` closes all four measured inline-array `it.each` misses. The
  frozen application corpus now finds 27/27 source declarations, 28/28 TESTS
  and 22/22 CALLS with no observed false positives. CI permits zero misses.
- Optional parameterized metadata is preserved through database mappings, QA
  paths and frozen reports. Live/saved UI and Markdown/PDF show the unexpanded
  source-declaration notice. Ordinary case identities and historical metadata
  retain their meaning; no database migration is needed.
- Fixture and selected-file scanners now share extraction and default coverage
  construction, removing duplicate class/test extraction logic. No product
  workflow or domain was added.
- P1 still needs independent human adjudication and P3 still needs real
  reviewer observations. Hosted CI on a reviewed commit remains outstanding.

## October 21 closure review

The P0–P3 order remains appropriate. Treat the source-corpus regression result
as a bounded engineering result; it does not close independent impact accuracy
or product validation.

| Priority | Completion criterion | Remaining work |
| --- | --- | --- |
| P0 | Reproducible release checks on a reviewed commit | Refresh dependency/security evidence after upgrades, then hosted CI on the reviewed revision |
| P1 | Independently adjudicated source labels and held-out MVP impact tasks | A second reviewer must audit the pinned labels; selected-source scores do not measure whole-application impact recall |
| P2 | Fix measured misses while preserving false-positive controls | Current measured misses are closed; optimize measured work and require new source failures before extending resolver syntax |
| P3 | Same-build trace-visible/trace-hidden observations from real reviewers | Collect counterbalanced matched tasks, pre-established ground truth and elapsed-time/accuracy records using the existing protocol |

The existing product-beta version comparator intentionally requires different
tool commits. It cannot isolate traces in a same-build study; retain those
condition observations separately as described in
[static trace evaluation](../evaluation/static-test-trace.md). No reviewer
results or promotion decision exist yet.

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

