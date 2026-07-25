# Roadmap Closure Status

This is the authoritative engineering status before the next UI improvement
cycle.

## Phase 1 — Close the refactor

Status: **DONE**

- Application and backend-runtime ownership is defined by ADR-0010.
- Package dependency boundaries and subpath exports are enforced in CI.
- Scan/document orchestration lives in application; runtime owns adapters and
  composition.
- API and worker build independently without cross-app source imports.

## Phase 2 — Make analyzer quality enforceable

Status: **DONE**

- The stable fixture suite has explicit recall, precision, evidence, negative
  control, and orphan-claim thresholds.
- Regression beyond tolerance fails CI and emits a scorecard artifact.
- Three pinned public NestJS repositories have extraction review evidence.
- Numeric confidence is not presented as a probability claim.

## Phase 3 — Controlled beta hardening

Status: **DONE**

- Production uses local email/password auth; dev-login is forbidden.
- Login throttling is Redis-backed and account lifecycle actions are audited.
- Production Docker images have passed startup verification.
- Queue retry/recovery, request correlation, operator, backup/restore,
  incident, and rollback paths are documented and tested.
- English and Vietnamese final reports have E2E coverage.
- Public GitHub TypeScript/NestJS is the only `STABLE` beta path.

Run the release evidence gate:

```bash
pnpm verify:controlled-beta-readiness
```

CI uploads `artifacts/release/controlled-beta-readiness.json`.

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

