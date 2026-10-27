# G2A Completion Report

**Audit date:** 2026-10-27
**Decision:** PARTIAL
**Scope:** developer comprehension study preparation and study-mode controls

## 1. Baseline

- Starting tool HEAD and live branch tip: 72c37a6f892793fab2a4269de689574b46e94ae8 on codex/fix-backend-runtime-ci-boundary.
- Final worktree commit SHA is still 72c37a6f892793fab2a4269de689574b46e94ae8; no commit was created. The dirty worktree contains the G2A route/test/report edits and a separate G2B analyzer/verification delta.
- Live main: 27b388adc25638e0c9737578872baf71e9aa0d2a. The branch is 10 commits ahead and 0 behind.
- A fetch was attempted first, but Git could not write .git/FETCH_HEAD. GitHub API refs and compare results confirmed the branch heads and divergence.
- No open pull request exists. The branch is not integrated. At G2A audit start the worktree was clean; this review adds an uncommitted route fix, tests, and report update. The current worktree also contains a separate G2B analyzer/verification delta, excluded from G2A scope. No commit, push, merge, PR, or deployment was made.
- GitHub Actions run [#121](https://github.com/hungthinh1104/BA_Helper/actions/runs/40429982126) passed at the exact starting SHA, including analyzer gates, typecheck, lint, tests, pinned API proof, and browser proof.
- The separate Vercel check on that SHA is failing: [commit status](https://github.com/hungthinh1104/BA_Helper/commit/72c37a6f892793fab2a4269de689574b46e94ae8). Its deployment logs were not available here.
- Integration recommendation: HOLD until the Vercel failure is diagnosed and the final local delta receives hosted checks.

Remote branches compared with main:

- No unique commits relative to main: chore/v0.1-debt-closure, feature/p3-async-document-pipeline, feature/product-updates-from-research, pr5/demo-proof-pack-refresh, refactor/auth-mode-cleanup, refactor/backend-runtime-deduplicate-repositories, release/phase4-async-pipeline.
- Unmerged: codex/fix-backend-runtime-ci-boundary (10 ahead, 0 behind), refactor/decision-first-analysis-ui (1 ahead, 9 behind), research/reqimpact-eval-v0 (88 ahead, 206 behind).

| Capability | Implemented | Verification | G2A gap |
| --- | --- | --- | --- |
| Code-first artifact discovery | Yes | VERIFIED by pinned API and browser proof | None identified |
| Source conditions and dependencies | Yes | VERIFIED by persisted comprehension projection and source provenance checks | None identified |
| Related Jest scenario discovery | Yes | VERIFIED by public/application trace gates and pinned proof | Static references do not prove execution |
| Assertion and invocation associations | Yes | PARTIALLY VERIFIED by analyzer fixtures, projection, and UI | Some associations remain explicitly unresolved |
| Mock boundaries and uncertainty | Yes | VERIFIED as static claims and limitations | Requires independent study scoring |
| Evidence provenance validation | Yes | VERIFIED by pinned source/commit checks | None identified in the checked slice |
| Scenario pagination UI | Yes | VERIFIED by API E2E, pagination tests, and hosted run #121 | None identified |
| Textual evidence mode | Yes | VERIFIED by route parity test | No participant validation |
| Interactive visual mode | Yes | PARTIALLY VERIFIED by browser proof and route tests | Study-route graph not exercised in a hosted browser session |
| Independent ground truth | Candidate package prepared | NOT APPROVED | Independent reviewer must adjudicate all labels |
| Human study instrumentation | Schema, validator, scorecard | VERIFIED with tests and empty-template validation | No participant observations exist |

## 2. Implemented Changes

The branch already contains the study protocol, task pool, answer key, blinded reviewer packet, blank annotation template, candidate source labels, strict observation schema, scorecard, and scenario pagination.

This review found two study-mode leaks and closed them in the Explorer:

- B/C no longer show the Back to repository link, which could return participants to the normal workspace during a timed task.
- Duplicate or unsupported studyCondition values fail closed. The page displays an unsupported-condition state and disables the comprehension query instead of silently opening normal Explorer mode.
- The normal route remains unchanged when no study condition is supplied.
- A route-level test compares B/C selected artifact and source evidence, scenario identity, setup/input/invocation/assertion/mock/outcome/association claims, limitations, rendered evidence text, and query arguments. It verifies that only visual graph availability changes, A leaves the query disabled, and normal Explorer navigation remains available.

The G2A-specific changes in this review are the comprehension page, its study-condition test, the study protocol note, and this report. Separate G2B analyzer/CI edits are present in the worktree and are not part of this report's G2A implementation scope.

## 3. Evidence Reliability

- The existing pinned 18-link evaluation for leosuncin/nest-api-example at b49ae92a6c0b0db39b6542338a2ffea3eda15717 is a curated analyzer regression slice. Its labels are not held out from resolver development and have not received independent human review.
- The G2A candidate is suites-dev/suites-unit at 8fdabcbdd12cb5144199ad3ba7b93eaed0a20275. The pinned LICENSE and package metadata identify Apache-2.0; the pinned TypeScript/Jest source includes a NestJS adapter. The repository is a NestJS testing library, not a booking/payment application.
- Six candidate test/target annotations include direct, setup-mediated, and absent relationships. I checked the pinned source ranges and repository suitability material; this is not independent human adjudication. The packet tells a separate reviewer not to open candidate labels or analyzer output before annotating.
- candidate-ground-truth.json remains PENDING_INDEPENDENT_REVIEW. The repository is absent from tests/fixtures, packages/analyzer, and scripts, and no analyzer output was generated for it. Do not report candidate labels as accuracy.
- Static source and Jest declarations do not establish test execution, pass status, runtime coverage, or business behavior. Missing and ambiguous links remain unresolved.

## 4. Experiment Readiness

The study package defines five task families: explain behavior, verify test evidence, predict an unseen case, prepare a safe change, and verify a claim. Its six-slot schedule covers all 15 condition/task-family cells without repeating a task for one participant across conditions.

- A: normal IDE, repository search, source/tests, and a consistent AI assistant; BA Helper is unavailable.
- B: the same underlying comprehension projection as C, with graph controls hidden.
- C: that same projection with the existing lazy graph and evidence navigation.
- The route test verifies identical B/C projection text and identical snapshot/artifact query arguments.
- The dataset records pseudonymous session code, condition, task, repository/tool SHAs, timing, answers, rubric scores, evidence references, unsupported claims, completion, confidence, usefulness, and voluntary reuse. The validator rejects identity fields and inconsistent provenance.
- Empty observations report NOT_COLLECTED with null metrics. The template is NOT_STARTED with zero observations. COMPLETED requires approved labels and the declared task/case/session coverage; it does not mean the product hypothesis passed.
- Raw answers are limited to public study source and the protocol sets a 90-day deletion period for raw answers and evidence details.

Study condition is supplied by an assigned URL. In-app navigation out of B/C is removed and duplicate or unsupported values fail closed. Without a studyCondition parameter, the ordinary Explorer remains active. The operator must distribute fixed URLs and prevent manual URL edits; condition is not bound to a participant session in the backend.

## 5. Performance

The ignored local artifact `artifacts/evaluation/pinned-code-comprehension-proof.json` records Windows, Node v22.23.3, Intel Core 5 120U, 12 logical cores, and 16.86 GB reported memory. It identifies toolCommitSha `72c37a6f892793fab2a4269de689574b46e94ae8`, `toolWorkingTreeDirty=true`, and analyzer `0.16.0`. The dirty worktree includes the separate G2B analyzer/verification delta, so these are measurements of the combined local tree rather than a clean G2A-only change.

The previous G2A report recorded a local reference at tool SHA `0130f16e042271bde29a47d414d67f0622d21ba4`: cold projection 204/231 ms, warm cache miss 18/21 ms, cache hit 4.4/7.9 ms, and browser time-to-usable median 2.66 s with a slowest sample of 13.67 s. Its exact artifact and sample counts are not available in this checkout, so use it as historical context only. The comparison also crosses tool revisions and analyzer versions; it is not a controlled before/after result.

| Current combined-tree measurement | Samples | p50 / p95 | Additional evidence |
| --- | ---: | ---: | --- |
| Projection in fresh Node processes; module/DB initialization excluded | 5 | 313 / 356 ms | 12 queries, 16 rows, 22,457-byte response |
| First projection after scan in shared process | 1 | 244 / 244 ms | 12 queries, 16 rows |
| Warm infrastructure, projection cache miss | 10 | 29.8 / 35.3 ms | 12 queries, 16 rows |
| Populated projection cache hit | 10 | 6.9 / 8.4 ms | 2 queries, 2 rows |
| Browser time to usable | 5 | 4.13 / 17.82 s | p95 includes a cold development-server sample |
| Scenario expansion / graph readiness / evidence inspection | 5 each | 143 / 170 ms; 570 / 698 ms; 143 / 173 ms | Pinned proof route |
| Method switch / scenario switch | 5 each | 3.63 / 4.36 s; 599 / 610 ms | Five browser samples |

The same proof records process memory snapshots: RSS/heap before projection was 581/468 MB, after the first projection 256/144 MB, after cache misses 263/151 MB, and at end 288/161 MB. These are noisy process-level snapshots, not incremental endpoint memory. The pinned API proof passed 18/18 declared tests and 21/21 direct test-to-method cases for the pinned corpus. Those source labels are not held out from resolver development and remain pending independent review, so the exact match is a regression result rather than an accuracy estimate. The pinned browser proof passed all five repeated runs. These local samples are descriptive, not production latency or capacity estimates. Some current projection medians are more than 20% above the historical figures, but the underlying revisions and run conditions are not controlled; no performance regression can be attributed or ruled out from this comparison. A same-environment, interleaved baseline/candidate run is still needed before making a no-regression claim for the study-mode change.

## 6. Tests and Checks

Current local checks:

| Command/check | Result |
| --- | --- |
| `pnpm test:web` | PASS: 28 suites, 137 tests, including B/C parity with populated evidence claims |
| `pnpm --dir apps/web exec jest --config jest.config.ts --runInBand --runTestsByPath 'src/app/(app)/repositories/[repositoryId]/snapshots/[snapshotId]/artifacts/[artifactId]/study-conditions.test.tsx'` | PASS after final parity assertion: 1 suite, 5 tests |
| `pnpm test:ci` | PASS: 231 suites, 1,348 tests, 1 snapshot |
| `pnpm test:integration` | PASS: 1 suite, 1 test |
| Developer-study schema/scorecard test | PASS: 1 suite, 5 tests |
| pnpm validate:developer-study -- tests/evaluation/developer-comprehension/dataset.template.json | PASS: NOT_STARTED, NOT_COLLECTED, 0 observations |
| `pnpm typecheck` | PASS across backend, web, and scripts |
| Focused ESLint on the changed web page and study-condition test | PASS |
| `pnpm lint` | PASS: 61 existing type-only-import warnings, 0 errors |
| GitHub Actions run #121 at 72c37a6 | PASS: full hosted workflow, including builds, tests, pinned API/browser proof |
| git diff --check | PASS; Git reported only expected CRLF conversion notices |
| Focused comprehension API E2E | PASS: 1 suite, 11 tests, isolated PostgreSQL and Redis |
| `pnpm test:e2e` | PASS: 22 suites, 132 tests, isolated PostgreSQL and Redis |
| `pnpm prove:pinned-comprehension` | PASS: 18/18 declared tests and 21/21 cases; independent review remains pending |
| `pnpm verify:pinned-comprehension-browser` | PASS: 5/5 repeated browser runs against the persisted pinned snapshot |
| `pnpm test:pw` | INCOMPLETE: six browser specs passed and the dedicated pinned spec was skipped; the runner did not exit after the final spec and was interrupted during cleanup |

The route tests first reproduced the Back-link and unsupported-condition leaks, then passed after the fix. The parity fixture now contains non-empty setup, input, invocation, assertion, mock, expected-outcome, and association claims; the test checks both their rendered text and full structured equality across B/C, including snapshot context and related scenarios. The final focused rerun passed after that full-projection assertion was added. Two rerun attempts failed before Jest started because Windows NODE_OPTIONS path parsing did not resolve the temporary shim; the successful run used a quoted forward-slash shim path. The shell has no global pnpm; checks used the repository-local Node/pnpm tooling. Node 22.23.3 raises ENOMEM from os.userInfo() in this Windows environment, so the developer-study validator and final focused rerun used a temporary process-local shim. The shim was removed after verification.

An initial focused Jest invocation forwarded an extra `--` into Jest and matched no tests. The strengthened fixture's first run also exposed that jsdom lacked `structuredClone`; replacing it with a JSON clone fixed the test setup. The final full web suite passed. These were test invocation/setup issues, not product failures.

The local API E2E rerun and pinned proofs used disposable PostgreSQL/Redis resources. An earlier E2E attempt accidentally configured the test app to use the persistent development Redis at `localhost:6379/0`; assertions passed, but the command later exited with an unhandled BullMQ `Connection is closed` error. The Redis state was not inspected or cleaned. The successful rerun used isolated test Redis. A later Playwright run used isolated Redis databases; its six completed browser specs passed, but the aggregate runner did not exit cleanly and was interrupted after cleanup stalled.

The hosted run certifies the starting commit, not the uncommitted route fix or the current combined dirty tree. No hosted CI result is claimed for the final local delta.

## 7. Risks and Limits

- Independent review of candidate labels is pending.
- No developer has participated; the study status remains NOT_STARTED and product value is unvalidated.
- The task pool uses one NestJS testing-library repository and does not establish generalization to NestJS business applications.
- Task difficulty matching and answer-key validity still need review by someone other than the candidate author.
- Operators must control assigned condition URLs; removing the query parameter returns to ordinary Explorer, and there is no server-side condition/session lock.
- The current local UI change has focused tests and typecheck, but no hosted run. The separate Vercel check on the starting commit is failing and its cause is unknown.
- Browser timings include local development compilation, have five samples, and do not establish production latency or capacity.

## 8. Product Decision

PARTIAL. Engineering materials, scorecard validation, scenario paging, and B/C evidence parity are prepared. G2A_READY is not supported because independent ground truth and real participant observations are missing, the final local delta has not received hosted CI, and the Vercel failure remains unexplained. This work makes no product-value or causal-effect claim.

## 9. Next Human Action

1. A reviewer who did not author the candidate labels should use the blinded packet and pinned source to complete annotation-template.csv, record a pseudonymous reviewer code, reconcile disagreements, and approve or correct each label. Keep the status pending until that work is complete.
2. Diagnose the Vercel failure and run hosted checks on a clean commit containing the local route fix before integration.
3. Freeze the app/tool SHA and assigned URLs, recruit 6–8 TypeScript/NestJS developers unfamiliar with the study repository, and run the counterbalanced pilot. Record real observations only; report correctness, evidence support, uncertainty, timing, abandonment, confidence, usefulness, and reuse by condition and task family.
4. Do not claim that BA Helper or Visual Test Trace improves developer performance until independently reviewed labels and human study results support that conclusion.
