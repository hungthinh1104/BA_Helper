# G2A Completion Report

**Audit date:** 2026-10-27  
**Scope:** code-comprehension study preparation, Explorer paging, and verification  
**Decision:** implementation prepared; empirical validation has not started

## Decision

The G2A study materials and the study-blocking Explorer paging control are
implemented. The task pool, scorecard, and candidate labels are ready for
independent review, but the study is still `NOT_STARTED`: there are no
participant observations, and ground-truth labels are
`PENDING_INDEPENDENT_REVIEW`. This work does not validate product value or
support a claim that Visual Test Trace improves developer performance.

**Integration recommendation: HOLD.** The working tree is uncommitted, no PR is
open, the hosted Vercel check on the audited commit is failing, and the human
validation gate is pending. No push, PR, merge, or deployment was performed.

## Repository and hosted-status audit

- Audited `HEAD`: `0130f16e042271bde29a47d414d67f0622d21ba4` on
  `codex/fix-backend-runtime-ci-boundary`.
- The cached `origin/main` is `27b388adc25638e0c9737578872baf71e9aa0d2a`.
  The feature branch is **9 commits ahead and 0 behind** (`HEAD..origin/main`
  = 0; `origin/main..HEAD` = 9). The remote feature ref matched `HEAD` in the
  GitHub API audit.
- `git fetch origin` could not update `.git/FETCH_HEAD` because the checkout
  denies writes to `.git`. The branch, main SHA, pull-request list, and checks
  were verified through GitHub instead.
- No open pull request was found. GitHub Actions CI run
  [#120](https://github.com/hungthinh1104/BA_Helper/actions/runs/40358708946)
  passed for the audited SHA. The Vercel commit check was **failure** at
  the [GitHub commit status](https://github.com/hungthinh1104/BA_Helper/commit/0130f16e042271bde29a47d414d67f0622d21ba4).
- At that `HEAD`, production graph wiring already persisted `buildGraph`
  edges, and unresolved targets were diagnostics. The remaining study UX gap
  was that the Explorer API paginated related Jest scenarios while the UI only
  displayed a notice that more scenarios existed.
- The existing BA/QA product-validation scorecard requires analysis and
  reviewed-report IDs. It was not suitable for developer comprehension, so G2A
  now has a separate strict schema and scorecard.

## Changes delivered

- The Explorer now requests 50 related scenarios at a time, merges pages in
  stable order, removes duplicate test identities, and exposes accessible
  load-more, retry, and retrieval-cap states. It still states that static
  declarations do not prove execution, pass status, or coverage.
- `EXISTING_WORKFLOW` disables the comprehension query. `TEXTUAL_EVIDENCE` and
  `VISUAL_TEST_TRACE` use the same snapshot, artifact, query key, and text
  evidence; the visual condition exposes the existing lazy-loaded graph
  controls. Study condition is presentation metadata and does not alter
  analyzer output or evidence identity.
- The study pins `suites-dev/suites-unit` to
  `8fdabcbdd12cb5144199ad3ba7b93eaed0a20275`. Its Apache-2.0 license, TypeScript
  source, Jest tests, and NestJS adapter were checked at that commit. It is a
  NestJS testing library, not a booking/payment application, so results must
  remain scoped to developer code comprehension on this repository.
- Five task families cover explaining behavior, verifying test evidence,
  predicting an unseen case, preparing a safe change, and verifying a claim.
  A six-slot counterbalanced pilot schedule covers all 15 condition/task
  family cells without assigning the same task to one participant twice.
- Candidate source labels, a blinded reviewer packet, and a blank annotation
  template are provided. Labels are explicitly candidate labels, not
  independent human ground truth. The held-out basis is limited to the
  repository being absent from local fixtures/manifests/scripts and no analyzer
  output having been generated for it.
- The strict dataset records pseudonymous session codes, pinned repository and
  tool SHAs, task timing, task outcome, rubric scores, confidence, cited source
  lines, unsupported claims, navigation actions, usefulness, and voluntary
  reuse. Abandonment remains distinct from an incorrect answer; empty metrics
  remain null. Identity fields are rejected. The protocol specifies public
  sources only and a 90-day deletion period for raw answers and evidence
  details.
- `pnpm validate:developer-study --
  tests/evaluation/developer-comprehension/dataset.template.json` produces a
  `NOT_STARTED` scorecard with zero observations. The generated scorecard is at
  `artifacts/evaluation/developer-comprehension-study-scorecard.json` and is
  ignored by Git.

## Verification results

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed on the final code state |
| `pnpm lint` | Passed with no errors; 61 existing type-only import warnings in unrelated API/backend-runtime files |
| `pnpm test:ci` | 230 suites, 1,335 tests, 1 snapshot passed |
| `pnpm test` | 236 suites, 1,346 tests, 1 snapshot passed |
| `pnpm test:web` | 27 suites, 132 tests passed before the final retry-state edit; the focused UI suite passed again after that edit |
| `pnpm test:e2e` | 22 suites, 132 tests passed |
| Focused Explorer UI tests | 2 suites, 8 tests passed after the final retry-state edit |
| Developer-study schema/scorecard test | 1 suite, 5 tests passed |
| Developer-study template validation | Passed; `NOT_STARTED`, `NOT_COLLECTED`, 0 observations |
| Static-test graph benchmark | Passed at 100, 200, and 800 cases |
| Public static trace gate | Passed: 22 cases, 10 calls, 24 test links; no false positives/negatives in this curated corpus |
| Application static trace gate | Passed: 27 cases, 22 calls, 28 test links; corpus regression only |
| Pinned comprehension proof | Passed; API verification passed |
| Pinned comprehension browser proof | 5/5 samples passed; server cleanup passed |
| `git diff --check` | No whitespace errors |

TSX-backed script commands needed a temporary invocation-only compatibility
shim: bundled Node 22.23.3 on this Windows shell throws `ENOMEM` from
`node:os.userInfo()`. The shim was kept under ignored `tmp/tooling` during the
checks and then removed; no application code was changed for the shell issue.

### Performance observations

- The synthetic static graph benchmark at 800 cases recorded p95 scan time of
  1,049.64 ms and p95 graph-build time of 398.96 ms. This is a synthetic
  scaling check, not a production workload estimate.
- The pinned repository proof recorded cold projection p50/p95 of 204/231 ms
  with 12 database queries and 16 returned rows. Warm cache-miss projection
  p50/p95 was 18/21 ms; projection cache-hit p50/p95 was 4.4/7.9 ms.
- The Jest e2e fanout workload used 641 synthetic input edges (80 callers, 8
  test cases, 80 call edges, 561 test edges). Five page-offset cache misses
  recorded p50/p95 of 84/143 ms; ten warm API samples were 13.8/15.9 ms, and
  twelve warm comprehension samples were 13.9/33.6 ms. These are isolated
  PostgreSQL-backed test workloads, not production traffic.
- Across the five pinned browser samples, time-to-usable was 2.66 s at the
  median; the slowest cold-start sample was 13.67 s. The existing browser proof
  exercises the live pinned comprehension page, not the controlled A/B/C study.
- The pinned proof ran on this dirty working tree at the audited tool SHA. It
  reports `toolWorkingTreeDirty: true`. The final retry-state edit was covered
  by the focused UI tests; the browser run does not exercise the retry-error
  state.
- Generated measurements are available at
  `artifacts/performance/static-test-graph-current.json`,
  `artifacts/evaluation/public-test-trace-scorecard.json`,
  `artifacts/evaluation/application-test-trace-scorecard.json`, and
  `artifacts/evaluation/pinned-code-comprehension-proof.json`. These outputs
  are ignored by Git.

## Evidence limits and remaining gates

1. A reviewer who did not author these labels must independently complete
   `tests/evaluation/developer-comprehension/annotation-template.csv` from the
   pinned source, reconcile disagreements, and approve the ground truth. Until
   then the candidate labels must not be used as accuracy measurements.
2. Freeze a clean tool commit and app version, then run the six-to-eight-person
   TypeScript/NestJS pilot using the published schedule and blinded answer key.
   The current dataset contains no participant records.
3. Report outcomes by condition and task family, including time, abandonment,
   correctness, evidence support, uncertainty, confidence, usefulness, and
   reuse. A small single-repository pilot cannot establish causal improvement
   or generalization.
4. Recheck the Vercel failure, open a reviewable PR when ready, and require
   hosted checks before integration. The branch is not integrated into `main`.

The earlier static-trace scorecards are also curated regression corpora, not
independent human ground truth. The pinned proof records pending review and
does not infer test execution or coverage. Those results are regression
evidence only, not substitutes for G2A participant observations.
