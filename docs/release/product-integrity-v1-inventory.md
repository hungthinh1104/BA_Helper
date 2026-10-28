# BA_Helper Product Integrity v1.0 Inventory

## Baseline

- Started: 2026-10-28
- Repository HEAD inspected: `89fc655cb427b1894a57d29497dda6753d1951c1`
- Branch inspected: `codex/fix-backend-runtime-ci-boundary`
- Local worktree already contained six modified code-comprehension UI files before this iteration; preserve those changes independently.
- This is a live work inventory, not a release certification. An item marked uncovered is a gate still to close.

## User-Facing Route Inventory

Routes are derived from `apps/web/src/app/**/page.tsx`, with route groups removed. Parameter names are illustrative.

| Route | Current browser coverage | Route-state coverage still needed |
| --- | --- | --- |
| `/` | `route-smoke.pw.ts` | refresh, dashboard empty/error states, navigation |
| `/analyses` | `route-smoke.pw.ts`; `app-sidebar.test.tsx` | pagination/query state, empty/error/forbidden |
| `/analyses/:analysisId` | `route-smoke.pw.ts`; `app-sidebar.test.tsx`; `responsive-sweep.pw.ts`; `decision-to-report.pw.ts`, `decision-mobile.pw.ts`, `decision-keyboard.pw.ts` | invalid/missing/stale/forbidden states, locale/query preservation across all browser actions |
| `/analyses/runs` | `route-smoke.pw.ts`; `app-sidebar.test.tsx`; `responsive-sweep.pw.ts` | empty/error/forbidden |
| `/analyses/runs/:runId` | `route-smoke.pw.ts` (missing-run not-found) | valid run, stale/error states |
| `/analyses/runs/:runId/merged-report` | `route-smoke.pw.ts` (missing-run not-found) | review/finalize/export states, valid/missing/forbidden/error |
| `/reports` | `route-smoke.pw.ts`; `responsive-sweep.pw.ts`; `decision-to-report.pw.ts` | query preservation, empty/error/forbidden |
| `/repositories` | `route-smoke.pw.ts` | empty/error/forbidden |
| `/repositories/:repositoryId` | `route-smoke.pw.ts` (seeded repository); `responsive-sweep.pw.ts` | scan states, missing/forbidden/error |
| `/repositories/:repositoryId/snapshots/:snapshotId/artifacts/:artifactId` | `route-smoke.pw.ts` (seeded deep link and mismatched repository identity); `responsive-sweep.pw.ts`; `code-comprehension-trace.pw.ts`, optional pinned proof | missing/stale/partial/error |
| `/requirements` | `route-smoke.pw.ts` | empty/error/forbidden |
| `/requirements/:requirementId` | `route-smoke.pw.ts` (seeded requirement); `responsive-sweep.pw.ts` | missing/forbidden/error; revision query/navigation |
| `/settings` | `route-smoke.pw.ts` | error/forbidden |
| `/settings/profile` | `route-smoke.pw.ts`; `responsive-sweep.pw.ts` | invalid/save/network failure |
| `/settings/members` | `route-smoke.pw.ts`; `responsive-sweep.pw.ts` | authorization, empty/error, duplicate/retry |
| `/welcome` | `route-smoke.pw.ts` | first-run and recovery states |
| `/reports/:analysisId/print` | `route-smoke.pw.ts` (seeded finalized report); `responsive-sweep.pw.ts` | print layout, missing/error, print interaction |
| `/login` | `route-smoke.pw.ts`; login setup in other browser journeys | validation, auth error, retry, redirect and return URL |

Playwright directly visits all 18 inventoried routes. The route smoke uses seeded resources, checks missing-run recovery, translation/runtime errors and API 5xx responses, and exercises query preservation through refresh/back/forward. It passed as one desktop test in 5.9 minutes. This is route smoke coverage, not full per-route state coverage. `responsive-sweep.pw.ts` additionally covers nine critical workspace routes at 320, 375, 768, 1024 and 1440px in light and dark themes. It found no page-level horizontal overflow across 90 route/theme/viewport combinations. Axe 4.14.0 scanned those nine routes at 375px and 1440px in both themes (36 scans) against WCAG 2.0, 2.1 and 2.2 A/AA tags; the final run had zero critical or serious violations. It does not assert every control is unclipped or exercise every dialog/form state. Error/loading/not-found boundaries exist for some route segments, but their user-visible states are not comprehensively exercised.

Route source cross-check (2026-10-28): the App Router contains 18 `page.tsx` routes, and all 18 map to the direct-navigation entries above; there are no unlisted user-facing page files.

### Repository Identity Mismatch (2026-10-28)

- Red browser reproduction: `route-smoke.pw.ts` opened a valid snapshot/artifact under a different `repositoryId`. The page rendered `BookingService.cancelBooking` and its persisted source excerpt while the Back link pointed to the unrelated URL repository.
- Cause: the route received `repositoryId` but queried comprehension by `snapshotId` and `artifactId` only, then rendered the response without comparing its authoritative `snapshotContext.repositoryId` to the URL.
- Fix: the page now fails closed on an identity mismatch, suppresses artifact evidence, and links to the repository that owns the snapshot. The mismatch state is localized in English and Vietnamese.
- Red/green verification: the focused browser test failed before the guard and passed after it (1/1) against the running API and Next.js servers. The regular Playwright web-server startup separately failed twice in worker stale-job recovery with Prisma `P2028`; the focused route test does not require the worker. The worker failure is a reproducible release gate, separate from the route fix.
- FE/BE parity check: comprehension permission is checked for the requested snapshot, `snapshotContext.repositoryId` is mapped from the persisted snapshot, and the controller parses the shared schema. Artifact list DTO mapping and pagination also match the FE consumer schema; the focused artifact API/use-case/repository/mapper suites passed 5/5 suites, 35/35 tests.

### Worker Startup and Playwright Teardown (2026-10-28 to 2026-10-29)

- Standard focused Playwright startup failed twice before test execution while starting `apps/worker`; `StaleJobRecoveryService` failed at its first `scanJob.updateMany()` with Prisma `P2028: Unable to start a transaction in the given time`.
- Isolation probes against `ba_helper_test` passed: the same three-model batch transaction returned `0,0,0`, and the real `StaleJobRecoveryService` with `PrismaService` returned zero recovered rows. The DB had no `RUNNING` scan jobs, impact analyses, or document jobs at inspection. During full bootstrap, `$connect()` left the `pg.Pool` lazy; the first recovery transaction timed out while the initial pool client was still connecting. Running `SELECT 1` first completed that connection and made the same recovery transaction pass.
- Fix: `PrismaService.onModuleInit()` now checks out and releases one pool client after Prisma connects, so worker startup waits for PostgreSQL readiness before stale-job recovery runs. Pool connection establishment has a 10-second timeout. Lifecycle tests cover connection acquisition/release and failure propagation; focused Jest suite passed 2/2.
- Two regular Playwright runs completed migrations, started the configured worker, and reported the repository-identity route regression passed 1/1 (26.9s and 27.7s). Neither parent process returned a clean exit after the assertion; both were interrupted after more than two minutes, so neither counts as a completed Playwright pass. A `PW_PRESTARTED_SERVERS=1` control completed the same test cleanly (1 passed, exit 0).
- `DEBUG=pw:webserver` confirmed teardown begins after the worker is started, but waits at worker-process termination on Windows. That debug run also failed during `seedDemo()` with Prisma `P1017` (`Server has closed the connection`) before reaching the route assertion. A subsequent read-only migration-status check against `ba_helper_test` succeeded and reported the schema up to date; the transient connection close still needs reproduction.
- The original startup `P2028` did not recur in either run that reached the assertion. Treat that startup fix as locally verified, while keeping the configured Playwright lifecycle gate open until the worker process shuts down cleanly and the test exits 0.

## Frontend API Consumer Inventory

Success JSON calls through `apps/web/src/lib/api-client.ts` now require a Zod response schema in TypeScript and reject calls without one at runtime. All current typed callsites are checked by `pnpm --filter web typecheck`. The direct credentials login request uses `loginResponseSchema`. `apiGetFile` is a deliberate binary response path for Markdown/PDF exports and is not JSON-schema validated.

| Consumer | Endpoint family | Current contract status |
| --- | --- | --- |
| `use-analyses.ts` | analysis list/detail/create, workspace, lineage, drift, graph, review queue, diff | Schema passed at every JSON callsite; endpoint-by-endpoint backend parity audit pending |
| `use-approved-report.ts` | approved and final-reviewed report | Backend controller parses the same shared schemas consumed by FE; successful final-report and approved-report GETs plus provenance rejection are E2E-covered. Approved `snapshotId` is the source `RepositorySnapshot.id`; final-reviewed `snapshotId` is the immutable `ReviewedReportSnapshot.id`, and FE does not compare them. |
| `use-clarifications.ts` | clarification CRUD/revision and review clarification lifecycle | Runtime schemas passed at transport boundary; backend parity audit pending |
| `use-code-comprehension.ts` | snapshot artifact list and artifact comprehension | Runtime schema and backend parity confirmed: list maps fields through `mapArtifactResponse` with bounded pagination, and comprehension authorizes by snapshot then returns persisted `snapshot.repositoryId`; both controller paths parse the shared contracts |
| `use-documents.ts` | final-reviewed report and latest reviewed snapshot | Latest snapshot now validates with `reviewedReportSnapshotSchema`; parity audit pending |
| `use-domain-packs.ts` | domain-pack registry | Schema passed; backend parity audit pending |
| `use-event-logs.ts` | scan-job and analysis event lists | Both now validate with `eventLogListResponseSchema`; parity audit pending |
| `use-impact-matrix.ts` | multi-repo matrix and row detail | Schema passed; backend parity audit pending |
| `use-insights.ts` | insights, traceability, insight review, traceability review | Lists use response schemas; review mutations now validate `{ ok: true }` |
| `use-localization.ts` | localized report generation and status | Both now use `localizedReportArtifactSchema` / `localizationStatusResponseSchema`; parity audit pending |
| `use-multi-repo-runs.ts` | multi-repo create/detail/list | Schema passed; backend parity audit pending |
| `use-projects.ts` | workspace/project/member reads and writes | All use response schemas; member removal now validates `{ removed: true }` |
| `use-qa-coverage.ts` | QA coverage | Schema passed; backend parity audit pending |
| `use-reports.ts` | merged draft/approval and analysis finalize | Analysis finalize now validates `impactAnalysisResponseSchema`; multi-repo calls use schemas |
| `use-repositories.ts` | repository list/detail/create and drift | Schema passed; backend parity audit pending |
| `use-repository-snapshots.ts` | snapshot list | Schema passed; backend parity audit pending |
| `use-requirements.ts` | requirement list/create/detail | Create, revision, qualify, list and detail responses verified against shared contracts; project scoping E2E covered below |
| `use-review-coverage.ts` | review coverage | Schema passed; backend parity audit pending |
| `use-review-decisions.ts` | single- and multi-repo review decisions | Schema passed; backend parity audit pending |
| `use-review-item-decision.ts` | target-aware review decision | Now validates `submitReviewItemDecisionResponseSchema`; backend parity confirmed in this iteration |
| `use-review-notes.ts` | review-note list/create | Now validates list and item schemas; backend parity confirmed in this iteration |
| `use-review-completion.ts` | review completion | Schema passed; backend parity audit pending |
| `use-scan-jobs.ts` | scan-job creation | Schema passed; backend parity audit pending |
| `use-snapshot-drift.ts` | snapshot drift | Schema passed; backend parity audit pending |
| `use-system.ts` | readiness and operations | Schema passed; backend parity audit pending |
| `use-test-trace-evidence.ts` | QA test-trace evidence | Schema passed; backend parity audit pending |
| `use-traceability.ts` | traceability review-decision update/delete | Now validates `{ ok: true }` / `{ success: true }`; backend parity confirmed in this iteration |
| `project-context.tsx` | current workspace, project list, project switch | Schema passed; backend parity audit pending |
| `auth-options.ts` | credentials login | Validates `loginResponseSchema` |
| `apiGetFile` callsites | Markdown/PDF downloads | Binary exception; content disposition and response status are checked, payload integrity coverage pending |

The schema requirement is now enforced at the shared consumer boundary. It prevents a future callsite from compiling without a response contract and makes JavaScript/runtime omissions fail before network access. Success JSON payloads from all current typed callsites are runtime parsed. Non-2xx JSON bodies remain a documented exception: the client reads `code`, `message` and `details` only to shape an error, never treats the body as successful application data, and falls back to a generic error when the body is absent or malformed. This error-envelope behavior still needs focused verification against API exception filters.

### Approved and Final-Reviewed Report Contract Identity (2026-10-29)

- FE hooks validate both responses with shared Zod schemas; both API controller routes parse those same schemas before responding.
- The success flow asserts the approved report response against `approvedImpactReportResponseSchema` and checks its identity/content. `approved-report.snapshotId` identifies the source `RepositorySnapshot`. `final-reviewed-report.snapshotId` identifies the immutable `ReviewedReportSnapshot` row; the two values intentionally differ. Contract comments now record this distinction.
- The first assertion incorrectly compared these two IDs and failed. Correcting it to compare each response with its persisted source passed; this was a test expectation error, not an API data mismatch. Existing cross-analysis provenance rejection coverage remains in place.

### API Method/Path and Scope Cross-Check (2026-10-28)

- Static inventory found 81 frontend API-client calls and 105 backend route handlers. 78 calls matched a backend method/path directly after parameter normalization. Three parser misses were checked manually: approved-report and merged-report exports interpolate a typed `"md" | "pdf"` format that maps to the two backend routes, and final-reviewed-report appends a `locale` query handled by the same backend route.
- Five calls build paths through `new URL(...)`; source inspection confirmed project analysis list, repository list, snapshot list, repository drift, and snapshot drift paths match their backend controllers. The remaining callsites, including the binary `apiGetFile` paths, had a method/path match. This confirms route parity for current consumers; it does not replace field-by-field comparison of every response mapper.
- Scope checks inspected for repository detail/list, snapshot list/drift, artifact/comprehension, graph, analysis list/drift-freshness, approved/final-reviewed report reads, and report exports. Repository and analysis reads use project-scoped permissions. Drift use cases also verify that base and target snapshots belong to the requested repository and project; analysis drift-freshness rejects a project ID that does not match the analysis snapshot. Report reads require analysis read access, while downloads require `report:export`.
- Added explicit negative regression cases for base and target snapshots from another project/repository. They assert rejection occurs before artifact reads. Focused result: `get-repository-snapshot-drift.usecase.spec.ts`, 1 suite / 10 tests passed.
- Full response mapper parity and the complete cross-project authorization matrix remain open. Binary downloads remain outside JSON Zod validation and need payload/disposition integrity coverage.

### Requirement API Runtime and Project-Scope Verification (2026-10-28)

- PostgreSQL E2E exercises the requirement journey through public HTTP routes: create a draft, create and qualify a revision, then read the project list and detail as a viewer. Each response is parsed by the same shared Zod schema used by the frontend consumer.
- Scope cases verify that a member of two projects cannot pair one project's route parameter with a requirement from the other (404), an outsider cannot list/create/revise/qualify in a hidden project (404), and a same-project viewer cannot create a requirement (403).
- Mutation check: removing `projectId` from the detail endpoint's `assertCanReadRequirement` call made the cross-project detail return 200; restoring the expected-project check returned the focused PostgreSQL regression to green.
- Verification: `auth-rbac.e2e-spec.ts` passed 23/23, then the focused scope regression passed 1/1 after restoration. Root TypeScript check and ESLint on the affected files passed.
- This closes response and scope verification for the requirement endpoint family only. Other consumer mappers, endpoint families, and the complete cross-project authorization matrix remain open.

### Requirement Creation Audit Atomicity (2026-10-28)

- Red PostgreSQL reproduction: forced `EventLogService.recordEvent()` to fail on `POST /projects/:projectId/requirements`. The endpoint returned 500, but a subsequent project requirement read still returned the newly created requirement and revision.
- Fix: create the requirement, first immutable revision, revision-created event, and requirement-created audit event in one transaction. Requirement repository writes accept the outer transaction client so they do not commit independently or start a nested transaction.
- Regression asserts that the 500 response leaves the project requirement list empty and persists no domain events. It failed before the fix and passed after it.
- Verification: focused atomicity E2E passed 1/1; full `auth-rbac.e2e-spec.ts` passed 23/23; root TypeScript check and ESLint on the affected files passed.
- This closes create transaction atomicity. Request-level idempotency is recorded below; clean-install / exact-release CI remain open.

### Requirement Create Request Idempotency (2026-10-28)

- Red PostgreSQL reproduction: two concurrent identical create requests with one request key produced different requirement/revision IDs; reusing that key with a changed payload returned 201 instead of a conflict.
- Fix: the shared request schema requires a UUID `requestKey`; PostgreSQL enforces `(projectId, requestKey)` uniqueness; the backend hashes normalized payload fields and replays the same resource only for a matching hash. A reused key with changed payload returns 409 `REQUEST_KEY_MISMATCH`.
- UI behavior: the dialog reuses a key when retrying an unchanged form, including after close/reopen; changing title, text or readiness-check choice starts a new request key. The form contents remain available after a failed request.
- Red/green UI regression: mutation that generated a fresh UUID on each submit failed because the retry key changed; restored behavior passes. Editing a failed payload initially reused the old key and failed the new regression; the field-change reset now gives the changed command a new key.
- Verification: `auth-rbac.e2e-spec.ts` 25/25; the four requirement-consuming analysis/session E2E suites 17/17; requirement contract tests 2/2; full web Jest 39 suites / 167 tests; full root Jest 240 suites / 1,377 tests / 1 snapshot; root `pnpm typecheck` passed; full monorepo lint passed with 0 errors and 50 existing `consistent-type-imports` warnings; targeted ESLint on changed web files passed with no warnings; `git diff --check` exited 0 with existing line-ending notices.
- Residual: request identity is held in component memory. A hard page reload discards the key; retry-after-reload with re-entered text is not verified. Do not persist raw requirement text in browser storage without a separate privacy review.

## Confirmed Iteration: Missing Consumer Runtime Contracts

### Reproduction

Before the fix, a successful JSON response without a schema returned its unvalidated object. A successful `text/html` response without a schema returned `null` as a typed success. A permissive `z.unknown()` schema also accepted the `null` from HTML 200. New `api-client.test.ts` tests reproduced these false-success paths and failed.

### Fix

- `apiGet`, `apiPost`, `apiPut`, `apiPatch` and `apiDelete` now require a Zod response schema at compile time and reject a missing schema at runtime.
- Every successful JSON-helper response must also carry a JSON content type; 2xx HTML/text responses fail with `API_WRONG_SERVER` or `API_INVALID_RESPONSE` before schema parsing.
- Previously unvalidated snapshot, event-log, review-note, localization, finalize, review-decision, traceability and member-removal consumers now pass shared response schemas.
- Clarification hooks pass their existing schemas directly to the transport boundary rather than parsing after an untyped return.
- Binary file downloads remain a documented non-JSON exception.

### Verification

- Red reproduction: `api-client.test.ts` failed because an invalid JSON payload resolved and HTML resolved as `null`, including under a permissive schema.
- Green: web typecheck passed after all missing schemas were supplied.
- Focused API client regression: 1 suite, 3 tests passed.
- Full web suite after the final transport change: 36 suites and 158 tests passed.
- Full web lint and web typecheck passed.
- Monorepo typecheck passed (backend, web and scripts).
- Monorepo lint passed with 58 pre-existing `consistent-type-imports` warnings in untouched API (53) and backend-runtime (5) files; zero errors.
- Full repository CI, route smoke coverage, viewport/a11y matrix and exact release-candidate CI are not yet complete.

## Confirmed Test-Harness Defect: Finalization Staleness Guard

- The first full root Jest run completed with 236/237 suites and 1,367/1,368 tests passing. The lone failure was `tests/impact-analysis/finalize-stale-guard.spec.ts` throwing `TypeError: tx.impactAnalysis.findUnique is not a function` before reaching its expected `ANALYSIS_STALE` assertion.
- Production `FinalizeImpactAnalysisUseCase` calls `findUnique` after a failed conditional `updateMany`; its dedicated use-case spec already stubs this delegate. The top-level stale-guard test did not.
- Updated the test transaction stub with `findUnique`, and asserted the conditional update includes the original `WAITING_FOR_REVIEW` state, snapshot commit, and target observation. This validates the intended compare-and-set boundary instead of allowing any arbitrary zero-row update to satisfy the test.
- Focused verification passed: 1 suite, 1 test. The full root rerun passed: 237 suites, 1,368 tests, 1 snapshot.

## Confirmed UI Defect: Missing Review-Coverage Translation

- Reproduction: the multi-repo run-detail route rendered `ReviewCoveragePanel`, which requested `workspace.reviewCoverage`; that key existed only under `reports`. The first focused component regression failed with `MISSING_MESSAGE: workspace.reviewCoverage`. Browser logs also reproduced the error while loading/error states rendered.
- Fix: added the same heading key under `workspace` for both `en` and `vi-VN`, preserving the existing localized value in `reports`.
- Regression coverage: the component test renders the loading heading through the active `workspace` namespace and checks both locale dictionaries. Red: 1 failing test with the missing key; green: 1 suite / 2 tests passed.
- Route verification: `route-smoke.pw.ts` now checks for missing translation errors across all inventoried routes. The first 240-second run hit the test timeout during Next dev compilation; the test timeout was raised to 600 seconds. With test environment loaded and servers prestarted, Playwright exited 0: 1 route-smoke test passed in 5.9 minutes, covering all 18 routes.
- No API 5xx or missing translation errors were observed in the successful route run. Full route-state, mobile viewport, accessibility, and multi-repo successful-flow coverage remain open.

## Confirmed UI Defect: Overlapping Active Navigation (2026-10-28)

- Reproduction: `AppSidebar` used `pathname.startsWith('/analyses')` for the analysis section. On `/analyses/runs` and nested run routes, that marked both “Impact Analyses” and “Multi-repo Runs” active.
- Red: the component regression failed on both multi-repo routes while the analysis list and analysis-detail route cases passed after correcting the Next `Link` mock to preserve `data-active` props.
- Fix: active matching now respects route-segment boundaries and excludes the more-specific `/analyses/runs` branch from the analysis section.
- Verification: `app-sidebar.test.tsx` passed 4/4. A real browser regression navigated between `/analyses/runs` and a seeded analysis detail; each rendered exactly one active sidebar link. Playwright passed 1/1 in 59.1 seconds with prestarted test-environment services.
- This closes active-link ownership for those overlapping routes. Other route-state coverage and all-route browser behavior remain open.

## Confirmed UI Defect: Review Queue Accessible Name

- Reproduction: the full web Jest suite failed because the prioritized blocker button no longer exposed the explicit localized name expected by the review queue accessibility regression. The component had lost its `aria-label`, leaving the name assembled from child text and badges.
- Fix: restored the localized name built from the item title, type, current decision, and finalize-blocking status.
- Verification: the focused `review-queue.test.tsx` suite passed 2/2; the full web suite passed 38 suites / 164 tests.
- Verification: web TypeScript check passed; ESLint on the changed web files exited 0 (Next emitted its no-`pages/`-directory diagnostic for the App Router project).
- Route-level keyboard and browser coverage remains the evidence for end-to-end interaction; assistive-technology manual checks are still open.

## Review Note vs Finalize Concurrency

- The existing PostgreSQL E2E test `rejects a review note whose stale status read resumes after finalization` blocks the note request after its initial `WAITING_FOR_REVIEW` read and before persistence, commits finalization, then releases the note write. Expected result: note request gets 409 `INVALID_STATE_TRANSITION`, the pre-existing note remains unchanged, and no late note replaces it.
- Mutation check: temporarily removed the persistence-time row-lock/status guard and ran the same E2E. It failed as intended: response changed to 200, code was missing, and the persisted note body was overwritten after finalization. Restored the guard and reran green.
- The guard runs `SELECT ... FOR UPDATE` on the `ImpactAnalysis` row and permits note upsert only while status is `WAITING_FOR_REVIEW`. Finalization conditionally changes that same row and creates the reviewed snapshot in its transaction. The two commits serialize; the preflight status read is not treated as authoritative.
- PostgreSQL verification: targeted run passed 1 test (7 name-filtered skips), then the full affected E2E spec passed all 8 tests. The mutation run failed with the expected invariant violation.
- This proves the finalizer-wins ordering for review notes. Barrier-controlled review-decision coverage is recorded below.

## Review Decision vs Finalize Concurrency (2026-10-28)

- Two PostgreSQL barrier tests reproduced both unsafe orderings for traceability review decisions: a decision write that passed its initial status check persisted after finalization, and a decision committed during finalizer preflight was omitted from the frozen snapshot. Both regressions failed before the persistence-time guards and locked reread were added.
- A third barrier test covers insight review decisions. If finalization wins, the review request now returns 409 `INVALID_STATE_TRANSITION` and leaves the completed analysis unchanged.
- Traceability and insight review repositories now lock the parent `ImpactAnalysis` row and verify `WAITING_FOR_REVIEW` in the same transaction as the decision mutation. Finalization takes that same row lock before rereading analysis, review links and insights, re-running approval gates, and building snapshot data. This serializes both orderings: an earlier review commit is included in the snapshot; a later reviewer is rejected after finalization.
- The finalization compare-and-set still checks the original snapshot commit and repository-target observation. A stale source target therefore remains a separate rejection condition.
- Regression coverage also exercises review-note vs finalize, concurrent finalizers, and event-write rollback in the same PostgreSQL audit-flow spec. The concurrent-finalize barrier was moved to the preflight read because snapshot construction now correctly occurs only after the first finalizer owns the row lock.
- Before/after evidence: both traceability race reproductions failed against the unguarded flow; after the fix, the affected PostgreSQL audit-flow E2E passed 12/12. Seven focused unit suites passed 50/50 tests. Root typecheck passed before the dependency relink attempt; `git diff --check` passed.
- Full Jest was then run on the worktree: 236/238 suites passed (1,370/1,373 tests, 1 snapshot). The three failures were test harnesses that lacked the new transaction `$queryRaw` parent-lock stub. Both mocks were updated. Their rerun could not start because a concurrent pnpm sync had removed workspace links, yielding `Cannot find module '@nestjs/common'`; this was an environment/setup failure, not a passing rerun.
- At this point in the work, the dependency-link issue prevented these checks from completing; later root Jest, typecheck and lint results are recorded below.
- The parent row lock is held while finalization rereads review data, evaluates local approval projections and builds the frozen snapshot payload. These operations make database reads only; no external service call is performed inside the transaction. Transaction-duration/load testing remains open.

## Responsive and Accessibility Sweep (2026-10-28)

- The first browser run failed on serious contrast and accessible-name issues, including unnamed member-role selects, an unnamed scrollable table, locale/review-item name mismatches and low-contrast navigation/status text.
- Fixes connect visible profile labels to read-only inputs, name both member-role selects, preserve visible locale/review-item text in accessible names, and make shared table and source-code scroll areas keyboard-focusable.
- Light and dark workspace tokens now meet contrast on the tested status, primary and muted surfaces. Low-opacity commit hashes and source line numbers use the readable muted foreground token.
- Final regression: `responsive-sweep.pw.ts`, 1 Playwright test passed in 4.2 minutes. It measured 90 page-width combinations and ran 36 axe scans with zero critical/serious WCAG violations. `tsc --noEmit` and ESLint on the changed web files also passed.
- The local pnpm wrapper reported that it could not relink this checkout's `node_modules` because its store differs and no TTY was available; the browser test still ran against the existing workspace install and the locked axe-core package. Clean-install and release-candidate CI remain open verification gates.
- Manual tab-order, dialog focus-return and screen-reader checks have not been completed. The sweep does not cover every route or every loading/error/empty state.

## Final Report Provenance Consistency (2026-10-28)

- Red reproduction: after finalizing a report with two `ACCEPTED` traceability links, a direct persisted decision change to `REJECTED` left the frozen snapshot at 2 accepted while the live completion read reported 1 accepted / 1 rejected. The endpoint previously returned 200 with both states in one response.
- Fix: `GetFinalReviewedReportUseCase` compares the six traceability review counts in live completion with the frozen report summary. A mismatch now returns HTTP 409 `REPORT_PROVENANCE_MISMATCH` with the snapshot ID and mismatched field names; it does not mutate or rebuild the snapshot.
- Summary parity: snapshot summary parsing now falls back to legacy `reviewStatus` when a review-decision row is absent and treats legacy `CONFIRMED` as accepted, matching `GetReviewCompletionUseCase`. The summary regression also locks `NEEDS_REVIEW` classification to the current completion policy.
- Red/green verification: the PostgreSQL E2E reproduced the old 200 false-success, then verified 409 after the fix and confirmed the persisted snapshot still contains both original `ACCEPTED` decisions. The full affected audit-flow E2E passed 8/8; report use-case unit tests passed 13/13; review-coverage summary tests passed 3/3.
- Wider checks after this iteration: root typecheck passed; full root Jest passed 237 suites / 1,371 tests / 1 snapshot; full monorepo lint completed with 0 errors and 58 existing `consistent-type-imports` warnings. pnpm reported the local-store/no-TTY modules-directory warning, so these results use the current workspace install rather than a clean install.
- This covers sequential post-snapshot review-data mutation. API-mediated mutations after completion are already rejected; barrier-controlled concurrent report-read/review-write ordering and report regeneration under changed source review data remain open.

### Cross-Analysis Approved Document Identity

- Red PostgreSQL reproduction: a completed analysis snapshot was linked to an `APPROVED IMPACT_REPORT` document owned by a different analysis. The final-reviewed-report endpoint returned 200 and exposed the foreign document Markdown because its fallback trusted the snapshot's document ID without checking document ownership.
- Fix: when snapshot Markdown is absent and the endpoint resolves `approvedDocumentId`, it now verifies the document's `impactAnalysisId`, report type and approved status before returning content. `ApprovedReportContextReader` applies the same check before a localization flow can use the document ID. Invalid identity returns 409 `REPORT_PROVENANCE_MISMATCH`.
- Regression: E2E creates two persisted analyses in PostgreSQL, points the first snapshot at the second analysis's approved document, and expects both final-report and localization-context reads to reject. The report test failed before its guard (200) and both reads pass after the fixes. Report query unit fixtures now include persisted document identity fields.
- Verification after both identity guards: `final-reviewed-report.audit-flow.e2e-spec.ts` passed 16/16, including cross-analysis identity rejection and the existing mixed-generation/recreated-document case; `get-final-reviewed-report.usecase.spec.ts` passed 13/13; monorepo `pnpm typecheck` passed; targeted ESLint passed with no warnings; `git diff --check` passed after the edits.

## Finalization Audit Event Atomicity (2026-10-28)

- Red PostgreSQL reproduction: injected failure at `recordCreatedEvent()` made `POST /impact-analyses/:id/finalize` return 500 after the transaction had committed. The analysis was `COMPLETED`, and the reviewed snapshot and document job existed despite the client seeing failure.
- Fix: `EventLogService` and `EventLogRepository` can write through a provided Prisma transaction client. Finalization now records `REVIEWED_REPORT_SNAPSHOT_CREATED` inside the same transaction that completes the analysis, writes the snapshot and creates its document job. The standalone reviewed-snapshot command uses the same atomic boundary. Its idempotency key is now stable per snapshot (`reviewed-report-snapshot:<id>:created`) instead of including wall-clock time.
- Regression results: the injected event failure now rolls back analysis status, snapshot and document job; the successful concurrent-finalize E2E also asserts one matching persisted audit event. Final-reviewed-report audit E2E passed 9/9; finalizer and event-log unit suites passed 16/16 across 3 suites; backend `tsc --noEmit` passed.
- The full root Jest run (237 suites / 1,371 tests / 1 snapshot) and monorepo lint pass were completed before this iteration. Exact clean-install CI remains open; pnpm still warns that its local store differs and it cannot refresh `node_modules` without a TTY.

## Review Decision Audit Event Atomicity (2026-10-28)

- Red PostgreSQL reproduction: injected event-write failure made the target-aware traceability review return 500 after `reviewStatus` became `CONFIRMED`. The insight path also returned 500 after both `reviewStatus` and its rationale `ReviewNote` persisted.
- Fix: target-aware and legacy review status/decision use cases now write the mutation, insight rationale where applicable, and audit event in one transaction. Transaction-aware repositories retain the shared `ImpactAnalysis` row lock, so rollback does not weaken the finalize race guard.
- PostgreSQL regression coverage: `review-audit-atomicity.e2e-spec.ts` injects event failures across target-aware impact/insight decisions and legacy traceability/insight status, decision update, and delete paths. Each case expects an error response and unchanged persisted state. Result: 6/6 passed.
- Additional verification: the complete report audit-flow and review-item E2E suites passed 19/19; focused review/stale-guard unit suites passed 30/30; backend `tsc --noEmit` passed; `git diff --check` passed.
- The first full root Jest attempt after this change passed 238/239 suites and 1,373/1,375 tests. Two stale-guard tests had a stub missing `$transaction`; the stub was corrected, and the six affected unit suites passed 30/30.
- Full root Jest rerun passed 239/239 suites, 1,375/1,375 tests and 1 snapshot in 303.617 seconds. Root `pnpm typecheck` passed. Monorepo `pnpm lint` exited 0 with 51 `consistent-type-imports` warnings in unchanged files. Exact release-candidate CI and clean-install verification remain open.

## Review Freshness vs Concurrent Target Observation (2026-10-28)

- Red PostgreSQL reproduction: a review note and a target-aware traceability decision both passed their preflight status reads, then committed after a concurrent branch target update changed `latestObservedCommitSha`. Both requests returned 200 before the fix.
- Fix: all review repositories and finalization share `lockReviewAnalysisState`: lock `ImpactAnalysis` with `FOR UPDATE`, then its `RepositoryTarget` with `FOR SHARE`, and compare the target observation against the snapshot commit inside the same transaction. A stale moving ref returns `ANALYSIS_STALE`; pinned `COMMIT` sources remain reviewable. Conditional status writes/finalization also omit moving-ref SHA comparison for pinned commits.
- A PostgreSQL barrier test pauses finalization after its state transition and starts a target update. `pg_stat_activity` confirms the update waits on the target row until finalization commits, then completes as a later observation.
- Mutation check: temporarily removed `FOR SHARE`; the finalizer barrier failed because the target update did not block. Restored the lock and reran the barrier test green.
- PostgreSQL verification: `review-target-freshness.e2e-spec.ts`, `final-reviewed-report.audit-flow.e2e-spec.ts`, and `review-audit-atomicity.e2e-spec.ts` passed 23/23. Focused review/finalization unit suites passed 43/43. Root backend `tsc --noEmit` passed.
- Pinned-commit regression: with target type `COMMIT`, a later observed SHA does not block review; the test failed before the conditional filter fix and now passes.
- Full root Jest on the current worktree passed 239/239 suites, 1,375/1,375 tests and 1 snapshot in 203.486 seconds. Changed-file ESLint and `git diff --check` passed with no lint warnings.
- At this backend iteration boundary, full web typecheck/lint, browser release gates and exact-CI-on-RC remained outstanding. Subsequent web checks and browser results are recorded in the UI entries above; full route-state, cross-module, clean-install and exact-RC gates remain open. This work does not close the broader product-integrity goal.

## Review Note vs Finalize PostgreSQL Concurrency (2026-10-28)

- The existing barrier test paused application code after the review-note preflight read but before calling its repository. It verified the stale status guard, but did not prove that two PostgreSQL transactions contend on the same analysis row.
- Added a DB-backed barrier regression: finalization acquires its real `ImpactAnalysis FOR UPDATE` lock, builds the frozen snapshot data and pauses before commit; the test starts a note upsert and polls `pg_stat_activity` until PostgreSQL reports the review-note transaction waiting on that analysis lock.
- Expected result: after finalization commits, the waiting note transaction observes terminal status, returns 409 `INVALID_STATE_TRANSITION`, leaves the pre-finalization note unchanged, and exactly one reviewed snapshot exists.
- Mutation reproduction: temporarily removing the review-note repository's lock guard made the note return 200 before PostgreSQL reported a row-lock wait; the new test failed with that evidence. Restoring the guard made the focused test pass.
- Green verification after restoring the guard: `final-reviewed-report.audit-flow.e2e-spec.ts` passed 16/16, including the PostgreSQL barrier case; monorepo `pnpm typecheck` passed through the workspace-local pnpm/Node toolchain; targeted ESLint passed with no warnings; `git diff --check` exited 0 (Git emitted existing line-ending normalization notices).
- State-machine and testing-strategy docs now explicitly require review-note writes and clears to share the finalization row lock. Release-wide route, responsive/a11y, cross-module and exact-CI gates remain open.

## Release Gates Still Open

- Expand route smoke coverage into route-state cases for loading/empty/partial/stale/error/forbidden/not-found/success where applicable.
- Exercise deep links, refresh, browser back/forward, query/locale preservation, active navigation and recovery.
- Audit every consumer schema against its exact backend response mapper/controller, including authorization and project/snapshot scoping.
- Expand responsive and axe coverage from the nine critical screens to remaining routes and route states; add assertions for clipped controls, dialogs and form usability.
- Complete manual keyboard, focus-return, screen-reader and visual contrast checks on the audited screens.
- Cover all designated critical journeys: scan, requirement revision, analysis, QA evidence, review, finalization, reports, multi-repo, settings; include negative/retry/duplicate/stale/concurrent paths.
- Run authorization matrix for cross-project access, full affected suites, full CI on the exact release candidate commit, and document residual P2/P3 issues.
- Complete the configured Windows Playwright lifecycle: investigate why the worker web-server teardown does not return, reproduce or explain the `P1017` during the debug seed, and obtain a clean exit-0 run with API/worker/web startup enabled.

## External State To Refresh Before Release

At initial repository/PR/CI audit, no open PR was returned for the inspected branch; the inspected commit had a failing Vercel status. The branch head and CI runs must be refreshed before making any current release-readiness claim. Historical CI results do not certify this worktree or a future release candidate.

## Integration Branch Validation (2026-10-29)

- Refreshed both remotes before integration. `codex/fix-backend-runtime-ci-boundary` is 15 commits ahead of `origin/main`; `fix/scan-source-omission-health-v1` is 38 commits ahead. Both remain unmerged to `origin/main`.
- The two branches modify 16 common paths. A three-way integration on `codex/integration-product-integrity-v1` found 9 textual conflicts. These are actual conflicts in CI configuration, runtime config test, finalization unit/E2E tests and use case, report audit E2E/helper, document hook, and scanner types/fixture test. The other 7 overlapping paths merged automatically.
- Merge resolution preserves the row-lock/CAS finalization behavior and backend-runtime CI boundary, combines both scanner changes and localization/query updates, and adjusts report tests to enforce frozen-snapshot provenance. The imported concurrency test was adapted to pause before the locked database read; report mismatch coverage expects `REPORT_PROVENANCE_MISMATCH` rather than a mixed live/snapshot response.
- Migration CI root cause: the upgrade verifier omitted `20261028150000_requirement_create_idempotency` from its upgrade plan, so the legacy fixture was inserted after the `Requirement.requestKey` non-null migration and failed with PostgreSQL `23502`. Added an explicit pre-migration legacy-schema assertion, included the migration in the shared upgrade plan, and verified generated defaults plus the unique index after upgrade. The regression failed before the fix and passed after it; the local PostgreSQL upgrade verifier passed twice.
- Focused verification on the integration worktree: migration plan 6/6; finalization/runtime/scanner suites 41/41; report audit-flow PostgreSQL E2E 17/17; scan-health/QA trace suites 46/46; web report/trace suites 24/24. Root, web and scripts TypeScript checks passed; contracts and shared package builds passed before web typecheck to refresh stale package declarations. Changed-file ESLint exited 0 with 22 existing `no-console` warnings in the demo seed and the App Router no-`pages/` diagnostic.
- The first full remote CI run on integration commit `1bd036b9a48fc35533e19e3ff526ede3410e46bc` (run 40741723730) passed dependency advisories, migrations, analyzer/source-omission and static-trace gates, boundaries, migration upgrade/data survival, lint, typecheck, all builds, and analyzer tests. It failed at Web unit tests: 41/42 suites passed, while `study-conditions.test.tsx` could not load `next-intl` ESM.
- Red reproduction: the isolated route suite failed with `Unexpected token 'export'` from `next-intl`. Mocking that library then exposed a second fixture defect: the route used `repo-1` while the response snapshot belonged to a UUID repository, so the page correctly rendered its repository-mismatch state. The test now mocks the localization hook and uses matching repository/snapshot identities; its intended rendering assertions pass.
- Verification after the correction: the focused study-condition suite passed 7/7; the full web Jest suite passed 42/42 suites and 177/177 tests; focused ESLint exited 0 with only the existing App Router no-`pages/` diagnostic. A follow-up commit and exact-commit remote CI rerun are pending.
- Browser review/report journey did not run in the failed workflow because CI stops at Web unit tests. Route smoke, responsive/browser suite, report journey, clean-install behavior, authorization matrix, remaining route states, and manual accessibility checks remain release gates. This integration milestone does not declare Product Integrity v1 complete.

## Responsive Accessibility Regression (2026-10-29)

- The second full CI run on `5127e69e089642c6ca908ecf88c8f5f510cc3a72` passed migration, lint, typecheck, all builds, analyzer/app/web tests, API E2E and both golden-path demos. The browser step ran 9 tests successfully but failed `responsive-sweep.pw.ts`; the pinned proof was skipped after that failure.
- Axe found serious `label-content-name-mismatch` violations on review-queue buttons in light/dark themes at 375px and 1440px. The accessible name included title, type, decision and blocker state but omitted visible evidence count, linked-artifact count and impact basis. The same scan found destructive badge text `#dc2626` at 3.49:1 and 4.13:1 on light selected/unselected row backgrounds, below 4.5:1.
- Fix: localized review-button name templates now include the visible evidence and artifact counts in English, Vietnamese and Japanese, and append the localized impact basis when present. The light-theme `--danger` token changed from `#dc2626` to darker `#b91c1c`; dark theme remains on its existing token value.
- Regression evidence: the focused ReviewQueue accessible-name assertion failed before the fix, then passed with the full `review-queue.test.tsx` suite 2/2. Full web Jest passed 42/42 suites and 177/177 tests; web TypeScript check passed. The responsive browser regression still needs a green rerun on the next integration commit.
- The integration branch remains short of release acceptance: route-state inventory, complete authorization matrix, cross-module negative/retry journeys, remaining responsive/a11y routes and states, manual keyboard/screen-reader checks, Windows worker teardown/P1017, and final exact-commit CI are open.
