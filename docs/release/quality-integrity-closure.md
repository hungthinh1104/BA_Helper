# BA_Helper Quality Integrity Closure

Updated: 2026-10-29
Status: IN PROGRESS; this ledger is evidence tracking, not release certification.

## Baseline

- Branch: `codex/integration-product-integrity-v1`
- Base commit: `a1e19e000dacbf1f14b30106d6842233ee7d7b0c`
- This continuation started with uncommitted integrity changes from prior goal iterations. They were preserved; cross-project membership and project-role authorization coverage were expanded in the previous iteration, and review command replay safety was closed in this iteration. `HEAD` and `origin/codex/integration-product-integrity-v1` remain `a1e19e000dacbf1f14b30106d6842233ee7d7b0c` (0 ahead / 0 behind); tests in this continuation ran against that commit plus the uncommitted worktree. The candidate is not an exact clean commit.
- `git fetch origin` succeeded on 2026-10-29. `HEAD` and `origin/codex/integration-product-integrity-v1` both point to `a1e19e000dacbf1f14b30106d6842233ee7d7b0c`. The remote tips of `codex/fix-backend-runtime-ci-boundary` (`689918502d945c3dfe234c3236dbeb455cbd45f0`) and `fix/scan-source-omission-health-v1` (`9e63721b5cd885cee67ec98cb4cfd2fbce7108e8`) are both ancestors of `HEAD`; the latter is present through merge commit `1bd036b`. `origin/main` is 62 commits behind `HEAD`. The worktree remains dirty and no branch integration was performed in this continuation.
- Remote state was refreshed again on 2026-10-29 after the previous iteration: local `HEAD` still matches the integration remote tip (0/0); `origin/main` is `27b388adc25638e0c9737578872baf71e9aa0d2a` and is 62 commits behind `HEAD` (0 ahead); both previously identified fix-branch tips remain ancestors of `HEAD`. The remote integration and fix branches remain unmerged into `origin/main`; no merge/rebase was performed. Existing worktree changes remain uncommitted.
- E2E tests loaded `.env.test` and exercised the configured PostgreSQL and Redis services. Secret values were not inspected or recorded.

## Findings and verification

| Status | Severity | Area | Evidence and disposition |
| --- | --- | --- | --- |
| CONFIRMED_DEFECT, fixed | P1 | Review audit history and delayed command replay | PostgreSQL E2E first reproduced accept → reject → accept storing two events instead of three for impact and insight reviews. A follow-up red E2E reproduced a delayed retry restoring the old decision after a newer reject because server-generated random event keys did not identify a command. Review requests now require a UUID `requestKey`; a payload fingerprint binds it to item, analysis, target, action, rationale, and actor. The stable event key is checked under the analysis lock; exact replays return the current persisted decision without reapplying, and key reuse with a different command returns 409 `REQUEST_KEY_MISMATCH`. New no-op commands persist one receipt so a delayed no-op retry also cannot overwrite later state. |
| CONFIRMED_DEFECT, fixed | P2 | System actor projection | Unit regression reproduced `actorUserId: "SYSTEM"` being returned as `actorType: "USER"`. The mapper now honors explicit actor type and normalizes the system sentinel when the type is absent; current unit regression passes. |
| CONFIRMED_DEFECT, fixed | P2 | Event-log response schema invented SYSTEM identity | The shared `eventLogDtoSchema` used `.catch('SYSTEM')`; a contract regression reproduced a missing `actorType` parsing successfully as SYSTEM. The schema now accepts only explicit `SYSTEM` or `USER`. The event-log service remains responsible for resolving legacy persisted payloads before DTO mapping, so wire validation no longer masks malformed output. |
| VERIFIED_SAFE, scoped | P1 | PostgreSQL `QUEUED` scan / analysis / document and BullMQ recovery | Real API+PostgreSQL+Redis E2E injects an enqueue failure for each durable job family, verifies the committed `QUEUED` row and missing Redis job, invokes worker-startup recovery, checks the deterministic BullMQ job identity, and verifies same-key API retry does not create a second row. Focused scan, analysis, and document recovery E2E plus the full API E2E passed. |
| CONFIRMED_DEFECT, fixed | P1 | Scan request ref silently dropped | The shared scan-create Zod object stripped an unknown `requestedRef` field and returned HTTP 201. PostgreSQL E2E reproduced a queued row with `requestedRef: null`, so an explicitly requested branch could be scanned as the default ref. The contract now rejects unknown fields; API E2E verifies the misspelled field returns 400 without creating a row, while valid `ref` is persisted and survives enqueue retry. The current frontend already sends `ref`. |
| CONFIRMED_DEFECT, fixed | P2 | Binary API response contract mismatch | The frontend file-download client treated any HTTP 200 body as a successful export. Tests reproduced `text/html` being returned as `report.pdf`, a missing disposition producing `download.bin`, and a `.md` filename being accepted for PDF. `apiGetFile` now validates the expected PDF/Markdown media type plus attachment disposition, safe basename, and matching extension before creating a download. |
| CONFIRMED_DEFECT, fixed | P2 | Malformed API error envelope reaching UI | A mocked HTTP error with object-valued `code` and mixed-type `message` array produced an `ApiError` whose `code` was not a string. The existing shared `apiErrorResponseSchema` now has field-safe AppError, NestJS, and legacy localization variants; the frontend validates before mapping, and falls back to a generic error for malformed bodies. |
| CONFIRMED_DEFECT, fixed | P1 | Cross-origin report filename visibility | The CORS allowlist supported separate web/API deployments, but CORS did not expose `Content-Disposition`; an actual API E2E showed the header absent on a cross-origin PDF response. CORS now exposes that header to allowed origins, and the same export route verifies the allow-origin and expose headers. |
| CONFIRMED_DEFECT, fixed | P2 | Analysis-list error recovery | Desktop and mobile Playwright reproduced that a failed analysis-list request displayed an error with no retry action. The page now provides a localized retry button, keeps the error/retrying state visible while the request is in flight, disables duplicate retries, and recovers to the empty state when the API returns `{ items: [] }`. |
| VERIFIED_SAFE | P1 | Review-note versus finalization concurrency | On this worktree, the PostgreSQL audit-flow E2E proves the note transaction waits on the finalizer's real `ImpactAnalysis` lock and fails after finalization commits without overwriting the note. The preflight stale-read note case also returns 409. |
| VERIFIED_SAFE, scoped | P1 | Finalization audit atomicity and report provenance | The same current E2E suite verifies an audit write failure rolls back finalization, rejects live-review/frozen-snapshot contradictions, and rejects mixed-generation reads/exports. This does not certify every report endpoint or mapper. |
| VERIFIED_SAFE, scoped | P1 | Review freshness race regression harness | The full API suite initially returned 500 in one traceability freshness test because its barrier paused after the production transaction had acquired the target lock, then waited for a target update that could not commit. The barrier now pauses after the initial real status read and before the transaction lock; PostgreSQL verifies the stale request returns 409. No production change was needed for this test harness issue. |
| CONFIRMED_DEFECT, fixed | P1 | Evidence-link persistence fan-out | The production analyzer-quality E2E timed out while `TraceabilityRepository.linkEvidence` ran inside an unbounded `Promise.all`: each affected link performed a bulk insert followed by a read whose result was discarded. Traceability and insight evidence linking now flatten each analysis batch into one idempotent `createMany` call per relation. The original production-path E2E passes after the change; this removes the confirmed fan-out and unnecessary reads, though it does not certify unrelated full-suite timeouts. |
| CONFIRMED_DEFECT, fixed | P1 | Derived analysis from answered review clarification returned 500 | API+PostgreSQL+Redis E2E reproduced `TypeError: Cannot read properties of undefined (reading 'findRequirementById')` at `CreateRequirementRevisionUseCase.execute` on `POST /api/v1/review-clarifications/:id/derived-analyses`. `ImpactAnalysisModule` registered this factory-backed use case by class shorthand, so its repository dependency was undefined. The module now constructs it with an explicit `RequirementRepository` factory. E2E verifies a REVIEWER creates a `QUEUED` derived analysis with requirement/clarification lineage, the expected addendum, one matching BullMQ job, and an idempotent retry that creates no second revision or analysis. |
| CONFIRMED_DEFECT, fixed | P1 | Analysis-create body lineage omitted and not project-authorized | API+PostgreSQL E2E first reproduced two hidden-resource ID oracles: a foreign `derivedFromAnalysisId` and a foreign `sourceClarificationId` each returned 201 instead of 404. A same-project derived-create E2E also showed valid FE-supplied lineage was dropped and persisted as null; reusing its request key with different lineage incorrectly reused the analysis. A misspelled lineage field was silently stripped and returned 201. The controller now authorizes parent/clarification IDs before use-case execution, requires `analysis:create-derived` for lineage submissions, and forwards both fields. The request schema rejects unknown fields. The use case verifies same-project parent lineage and includes lineage/multi-repo identity in request-key mismatch checks. Regression asserts foreign IDs return 404 with no analysis/event write, misspelled fields return 400 without writes, VIEWER gets 403 with no write, REVIEWER rerun and clarification lineage persist, and changed lineage returns 409. |
| VERIFIED_SAFE, scoped | P1 | Project role-to-permission matrix | A table-driven unit regression locks all 55 policy outcomes (5 project roles × 11 permissions). API+PostgreSQL E2E covers representative operations for the roles: OWNER succeeds for all 11 permissions; MAINTAINER can read, manage repositories, run scans and export reports; ANALYST can create requirements/analyses, finalize, derive analyses, write clarifications and export; REVIEWER can review, write clarifications, derive analyses and export; VIEWER can read and export. Denial cases include VIEWER scan/requirement/base-analysis/finalization and MAINTAINER review/clarification writes, with persistence assertions. Project-member CRUD is exercised across all five roles. Test-trace evidence returns contract-valid data to all roles; an outsider using the persisted evidence ID receives 404. Scan enqueue verifies PostgreSQL and BullMQ identity. This closes the central role policy matrix, not per-route scope verification. |
| VERIFIED_SAFE, scoped | P1 | Current project-scoped API route authorization | Static inventory of current project/resource controllers was cross-checked against PostgreSQL API E2E for every scoped route family and method: project and membership, workspace selection, repositories/snapshots/scans, requirements/revisions, analysis create/read/finalize, review and clarification actions, evidence/insight/traceability, documents/localization, and all multi-repo run/report/drilldown paths. Tests use foreign project resource IDs in both path and body, assert 404 for unrelated owners and 403 for insufficient same-project roles, and check persistence/queue state for denied mutations. The 55-case unit matrix still locks the complete role policy. No missing project guard or unauthorized cross-project mutation was reproduced in this pass. This is API authorization evidence only; it does not close browser route-state, full response parity, manual accessibility, or exact-commit CI gates. |
| CONFIRMED_DEFECT, fixed | P2 | Event-log response schema invented SYSTEM identity | The shared `eventLogDtoSchema` used `.catch('SYSTEM')`; a contract regression reproduced a missing `actorType` parsing successfully as SYSTEM. The schema now accepts only explicit `SYSTEM` or `USER`. The event-log service remains responsible for resolving legacy persisted payloads before DTO mapping, so wire validation no longer masks malformed output. |
| VERIFIED_SAFE, scoped | P1 | Revoked project membership with a still-valid JWT | API+PostgreSQL E2E first proves the OWNER token can read project membership, then revokes that user's ProjectMember row without changing the JWT. The same token's requirement-create mutation returns 404; requirement and `REQUIREMENT_CREATED` event counts remain unchanged. Authorization is re-evaluated against current project membership. Other role/resource combinations remain in the PARTIAL matrix above. |
| CONFIRMED_DEFECT, fixed | P1 | Cross-snapshot graph endpoint leaked foreign artifact data | Before the fix, an API+PostgreSQL E2E inserted an edge whose `snapshotId` belonged to the authorized project while one endpoint belonged to another project's snapshot; the impact graph returned the foreign artifact name and source path. The impact graph builder and all shared `GraphRepository` reads now require both endpoint artifacts to match the selected snapshot. Graph and code-comprehension API+PostgreSQL E2E regressions inject mismatched edges in both directions and verify that neither response contains the foreign name or path. Scanner ingestion already maps edge endpoints from the persisted artifact map for the same snapshot. The Prisma schema still permits manually inserted inconsistent rows; read projections fail closed, and a database composite-FK migration was not part of this patch. |
| CONFIRMED_DEFECT, fixed | P1 | Foreign snapshot evidence entered analysis responses through revision OR matching | A red API+PostgreSQL E2E showed `/impact-analyses/:id/evidence` returning source from another project's snapshot because an evidence row also referenced the local requirement revision. Another red E2E showed the insights response returning a foreign excerpt and path through an `InsightEvidence` link whose artifact ID was local but snapshot was foreign. Evidence reads now require snapshot/artifact/revision provenance to match the analysis; insight and traceability repositories apply the same evidence scope; graph evidence summaries check snapshot, artifact, and revision identity. PostgreSQL E2E covers evidence, insights, traceability, and graph routes, with valid local code and requirement evidence retained. The Prisma schema still permits manually inserted inconsistent evidence rows; these analysis projections now fail closed. |
| CONFIRMED_DEFECT, fixed | P1 | Cross-snapshot traceability artifacts and linked evidence leaked through workspace and multi-repo read models | A red API+PostgreSQL E2E linked a local analysis to a foreign artifact and attached evidence with either a foreign snapshot or foreign artifact. The traceability response exposed the foreign artifact, the workspace exposed both foreign artifact and excerpt, and the multi-repo row detail exposed the same foreign source. Traceability, graph, workspace, diff, matrix, review coverage, row detail, approved-report context, insight, and evidence projections now filter by analysis snapshot and immutable requirement revision. E2E verifies nine analysis and multi-repo routes return without foreign artifact/evidence data and that matrix/coverage counts exclude the invalid artifact. The schema still permits manual cross-snapshot relation rows; current projections fail closed. |
| UNVERIFIED | P1 | Review decision full-suite stability | One historical full API E2E attempt returned 500 for three requests in `review-decision.e2e-spec.ts`; that run had server-error logging disabled and did not preserve the failing method/path or exception stack, so its root cause cannot be established from the available artifact. The latest instrumented full suite passed 30 suites / 184 tests with no unexpected 5xx on the legacy review-decision route; all logged 5xx matched deliberate failure-injection or asserted unsupported-framework cases. The legacy review-decision suite also passed 10 consecutive isolated runs (40 tests). Repeated stability evidence lowers the reproduction likelihood, but does not explain or erase the historical failure; no production code change is justified without a current reproduction. |
| UNVERIFIED | P1 | Full-suite finalization stability | After the lineage fix, one full API E2E run failed 4/198 tests: merged-report finalize returned 500, final-reviewed-report finalize returned 500 in two assertions, and a target-observation race barrier timed out. The error-mapping fixture was corrected to give the actor membership in both projects, then its targeted test passed. The two affected full suites passed together with server-error logging (54/54); a later instrumented full API rerun passed 30 suites / 198 tests in 238.918 seconds with no unexpected 5xx. The first failures did not reproduce, but their full-suite cause remains unknown and this does not certify absence of flakiness. |
| UNVERIFIED | P2 | One transient workspace 500 during a full auth E2E run | `auth-rbac.e2e-spec.ts` had one 500 on the workspace projection in an otherwise 44/45 run, without stack logging. The named test passed alone, and an instrumented full rerun passed 45/45; its only logged 5xx was the asserted requirement audit failure injection. Cause of the first response remains unknown, so it is tracked as a test stability risk rather than a reproduced product defect. |
| VERIFIED_SAFE, scoped | P1 | Route smoke, responsive, and browser journeys | Current worktree Playwright matrix passed direct navigation for all 18 inventoried routes, 90 route/theme/viewport width checks, responsive/axe checks on the designated critical screens, keyboard review, mobile review, and the report journey. |
| PARTIAL | P1 | Route-state completeness, manual accessibility, and exact hosted CI | The analysis list now has desktop/mobile HTTP-failure → retry-in-progress → empty-state coverage. Other route loading/partial/stale/forbidden/error states remain incomplete. Manual keyboard/focus-return/screen-reader review and exact clean-commit hosted CI remain open. |

## Authorization inventory

Static audit of `ProjectPermissionService` and `ProjectScopeRepository` found
project resolution for analysis, requirement, requirement revision,
repository, snapshot, scan job, analysis clarification, review clarification,
insight, traceability link, and multi-repository run IDs. Scoped route handlers
delegate authorization to these checks directly or through their application
use cases. The routes without project permission checks are public bootstrap,
global account/system-admin, or project-selection operations with separate
guards. No missing project guard was confirmed in this source pass; it is not
an end-to-end authorization proof.

Current black-box cross-project cases cover report, review-note, localization,
merged-report, and project-membership route siblings alongside analysis,
review, repository, scan-job, clarification, and evidence resources. The
membership API now has a real outsider-owner versus protected-project test:
outsider list/write requests return 404; same-project viewer reads succeed but
create/update/delete return 403; unknown member IDs and valid users from a
different project return 404. Project listing also has an explicit negative
assertion that a user never receives a project with no membership. Mutation cases verify that
outsider requests create no report snapshot, document job, review note,
localized artifact, merged report, or review decision. Merged-report probes
include draft and approved report reads, Markdown/PDF export, finalization,
review-decision list/latest reads, and review mutations. The requirement E2E
also checks hidden-project list/create operations and a mismatched
project/requirement pair. The latest API+PostgreSQL sweep enumerates the
project and analysis read routes for requirements, analysis list/detail, drift
freshness, event history, lineage, graph, workspace, QA, review
queue/history/completion, evidence, insight, traceability, clarifications,
documents, approved/final-reviewed reports, notes, and localization. All return
404 for an unrelated project owner, and response bodies exclude the hidden
requirement title and insight text. This adds route-family coverage; role and
mutation combinations remain incomplete. The expanded project-role E2E now verifies all roles
can export an approved report and read persisted evidence, insights,
traceability, QA coverage, and review queue data. It also verifies OWNER-only
member management, analyst/reviewer clarification writes, reviewer access to
the unified review-item decision route, and the `analysis:create-derived`
authorization split against an unanswered clarification. The successful
derived route now verifies requirement revision creation, analysis lineage,
queue insertion, and idempotent retry. A VIEWER can also enqueue a document
job through the real API; PostgreSQL and BullMQ persistence are checked and
the Redis job is cleaned up after the test. A complete role-by-permission
matrix across every project-scoped resource remains open.

The project-switching E2E now also keeps a valid JWT after direct membership
revocation and probes a protected requirement-create action. The API returns
404 and persists neither a requirement nor its creation event. The selected
workspace fallback is covered separately; this does not complete stale-session
coverage for every resource family.

The single-repository analysis-create route now treats optional lineage IDs as
active command data: foreign parent analyses and source clarifications return
404 before persistence; same-project lineage is stored and must match the
converted revision. Derived submissions use `analysis:create-derived`, which
is verified for REVIEWER and denied for VIEWER. The same request key cannot be
replayed with a different parent or clarification. The role/resource matrix
remains partial beyond these targeted cases.

## Frontend API-consumer contract audit

Static inspection found direct backend `fetch` calls only in the shared API
client (JSON and file helpers) and NextAuth credential authorization. JSON
hooks use the shared `apiGet`/`apiPost`/`apiPut`/`apiPatch`/`apiDelete`
functions, whose required Zod argument is checked with `safeParse`; the API
client also fails closed if called without a schema. NextAuth login parses
`loginResponseSchema`. The report file endpoints are the documented non-JSON
exception and now validate their expected Markdown/PDF media types before
download. The review-clarification schema's `Request` suffix is misleading,
but its fields and controller use confirm it is the full response DTO.

This verifies runtime shape validation at the frontend consumer boundary for
the inspected call sites. It does not establish complete semantic parity for
every backend mapper and route state; those release gates remain open.

## Changes in this iteration

- `review-item-decision.transaction.ts` now performs locked fresh-state checks before writes and records an event for every actual mutation.
- `submit-review-item-decision.usecase.ts` reports concurrent no-op mutations as idempotent.
- `event-log.service.ts` correctly classifies the default uppercase `SYSTEM` actor.
- Regression coverage was added for repeated review transitions, concurrent identical review submissions, and the default system actor.
- Review decision requests now carry a stable UUID `requestKey` from the frontend through the API. The hook retains it across a failed request and rotates it after success; the backend stores a command fingerprint with the audit event, rejects key/payload mismatches, and does not let a delayed retry overwrite a later decision. New no-op commands receive one command receipt.
- Added API+PostgreSQL E2E coverage for delayed impact/insight retries, no-op undo replay, changed-command key mismatch with unchanged DB state, ordered review-event history and actor attribution. Added contract and web-hook regressions.
- `state-machine.md` and `testing-strategy.md` now state the transition-history and retry semantics.
- Traceability and insight evidence persistence now use one idempotent bulk insert per analysis batch; repository regressions assert the flattened rows and that no unused read follows the write.
- Finalization's interactive PostgreSQL transaction now has a 20-second timeout. A deterministic API+PostgreSQL E2E holds the winning transaction for 6 seconds, beyond Prisma's 5-second default, and verifies exactly one snapshot/job/event is committed while the competing request returns a conflict.
- Cross-project authorization E2E now probes report, localization, note, and merged-report endpoint siblings with a real outsider project owner and verifies unauthorized mutations leave persistence unchanged.
- Added a focused API+PostgreSQL membership authorization E2E for all four membership methods, same-project viewer denial, unknown member IDs, and valid user IDs nested under the wrong project; it asserts unchanged project-member/user state after denied requests.
- Added a black-box API+PostgreSQL sweep for the remaining project/analysis read surfaces. A global ADMIN with OWNER membership only in a separate project receives 404 for all 30 target routes; denied response bodies do not include seeded target-project requirement or insight text. No authorization bypass or production code fix was found in this slice.
- Added API+PostgreSQL red/green cases for analysis-create parent and source-clarification lineage IDs. Foreign IDs now return 404 before writes; derived submissions require `analysis:create-derived`; valid lineage persists, request-key reuse with changed lineage returns 409, and VIEWER denial leaves the analysis table unchanged.
- The impact-analysis create request schema is strict. An E2E first reproduced an unknown misspelled lineage field being silently stripped with HTTP 201; the API now returns 400 and leaves analysis/event state unchanged.
- Updated the error-mapping E2E fixture so the actor belongs to both projects before asserting `INPUT_PROJECT_MISMATCH` (400); an actor without membership still receives 404 for the hidden snapshot.
- Added a stale-session API+PostgreSQL regression: an OWNER token that was valid before membership revocation receives 404 on a protected requirement mutation, with no requirement or creation event persisted.
- Snapshot graph reads now scope each dependency edge to the edge snapshot and require both endpoint artifacts to belong to that same snapshot. This covers the impact graph query and shared graph reads used by graph, code comprehension, retrieval expansion, and frozen report generation.
- Added PostgreSQL API regressions that insert deliberately mismatched cross-snapshot edges in both directions and verify foreign artifact names and paths are absent from impact graph and code-comprehension responses. The data-model guidance now records the invariant and fail-closed projection rule.
- Added `analysisEvidenceScopeWhere` for analysis-scoped evidence reads. Evidence, insight, and traceability projections now include repository evidence only from the analysis snapshot and its artifacts, plus requirement evidence scoped to that exact immutable revision. The impact graph applies the same provenance checks before exposing an evidence excerpt.
- Workspace, diff, approved-report context, multi-repo matrix, review coverage, and row-detail reads now enforce the same snapshot and requirement-revision boundaries. Invalid traceability links cannot inflate matrix/coverage counts or appear in reviewed outputs.
- Extended the data-model guide with artifact/evidence snapshot identity requirements and the analysis projection boundary.
- `CreateImpactAnalysisUseCase` now rejects missing or cross-project source analyses and binds parent analysis, source clarification, review clarification, and multi-repository run identity to the idempotency key.
- Updated API operation and contract documentation to describe conditional derived permission, lineage validation, hidden-resource behavior, and idempotency semantics.
- Project-listing E2E now seeds an unjoined project and asserts it is absent from the authenticated user's response.
- Fixed derived-analysis API startup wiring: `ImpactAnalysisModule` now supplies `CreateRequirementRevisionUseCase` through a factory that injects `RequirementRepository`; real E2E had reproduced a 500 because class shorthand left the repository undefined.
- Expanded `project-role-permissions.e2e-spec.ts` using real HTTP, PostgreSQL, and Redis: all five roles can export an approved report and read populated evidence, insight, traceability, QA, and review-queue responses; VIEWER can enqueue a report job and its persisted row/job ID agree; OWNER alone can manage project membership; ANALYST and REVIEWER can write clarifications; REVIEWER can use the unified review-item decision endpoint while ANALYST/VIEWER are denied without DB changes; only OWNER/ANALYST/REVIEWER pass the derived-analysis authorization check for unanswered input; and the answered-review-clarification path creates one provenance-linked derived analysis and is idempotent on retry. The original repository/scan, requirement/analysis/finalize, viewer, and cross-project checks remain.
- `resetDatabase` now retries PostgreSQL deadlock (`40P01`) and pool-acquire timeout (`P2024`) failures up to three times with a short bounded delay. The helper regression first reproduced the missing retry, then passed after the change; non-transient errors still fail immediately.
- Scan create now uses a strict shared request schema. Unknown body properties fail with 400 instead of being stripped; scan E2E callers use `ref`, and the recovery test asserts the persisted `requestedRef` equals the requested `ref`.
- The API contract guide now documents that scan create accepts only `requestKey` and optional `ref`.
- API consumer inventory found all JSON hooks pass shared runtime Zod schemas; NextAuth login separately parses `loginResponseSchema`. A misleading `reviewClarificationRequestSchema` name was verified as the full response DTO, so no code change was needed there.
- `apiGetFile` now requires `application/pdf` or `text/markdown`, validates the successful response media type, and returns a specific wrong-server error for HTML. It also rejects a missing/unsafe attachment filename or extension mismatch before reading the blob. All three report-export callers declare the expected type. API CORS now exposes `Content-Disposition` to allowlisted origins for split deployments.
- The frontend now parses non-2xx JSON through the shared `apiErrorResponseSchema`; malformed fields no longer leak into `ApiError.code` or message. AppError, NestJS, legacy localization, and malformed fallback cases have regression coverage.
- The analyses list now exposes a localized retry action after GET failure. While retrying, a progress status stays visible and the action is disabled against duplicate submissions; successful recovery renders the authoritative empty-list state. English, Vietnamese, and Japanese labels are defined.
- Added `analysis-list-retry.pw.ts` to desktop and mobile Playwright projects; it intercepts only the analysis-list GET while using real login, API, PostgreSQL-backed seed data, and the existing local Redis service.

## Commands and results

| Check | Result |
| --- | --- |
| Pre-fix PostgreSQL E2E `review-item-decision.e2e-spec.ts` | RED as expected: 2 transition-history assertions received 2 events instead of 3; 8 other tests passed. |
| Post-fix unit: event-log service + review decision use case | PASS: 2 suites, 19 tests. |
| Post-fix PostgreSQL E2E `review-item-decision.e2e-spec.ts` | PASS: 1 suite, 10 tests, including impact/insight transition cycles and concurrent duplicate requests. |
| Delayed review-command replay, pre-fix PostgreSQL E2E | RED as expected: after accept → reject, replaying the first request key returned `accepted`, `idempotent=false`, and overwrote the latest decision. |
| Current PostgreSQL E2E `review-item-decision.e2e-spec.ts` | PASS: 1 suite, 14 tests; covers impact/insight history, delayed replay, no-op undo replay, key mismatch, event ordering/actor, and concurrent duplicate commands. |
| Review contract/use-case/event-log unit tests | PASS: 3 suites, 20 tests. |
| Review command hook test | PASS: 1 suite, 2 tests; failed request retains its key, success clears it, later action receives a fresh key. |
| System actor + worker queue recovery unit tests | PASS: 2 suites, 12 tests. |
| PostgreSQL + Redis E2E `scan-job-enqueue-recovery.e2e-spec.ts` | PASS: 1 suite, 2 tests. |
| Current PostgreSQL E2E `final-reviewed-report.audit-flow.e2e-spec.ts` | PASS: 1 suite, 18 tests, including note/finalization lock wait, review/finalization ordering, finalization audit rollback, frozen report consistency, and cross-snapshot report-context provenance. |
| Current Playwright matrix, prestarted API/worker/web | PASS: 12 tests discovered, 11 passed, 1 pinned-repository proof skipped by its opt-in condition; exit code 0. Includes 18-route smoke, 90 responsive width combinations, critical-screen axe scans, keyboard/mobile journeys, and report generation. |
| Root CI Jest suite `pnpm test:ci`, concurrent diagnostic | FAIL: two Nest setup hooks exceeded 5 seconds and a Redis test closed during teardown while this suite ran alongside full web Jest, typecheck, and lint. This result is not counted as a product regression or green run. |
| Root CI Jest suite `pnpm test:ci`, serial retry | PASS on the current worktree: 238 suites, 1,390 tests, and 1 snapshot. |
| Focused PostgreSQL freshness E2E | PASS: 1 suite, 3 tests after moving the race barrier to the post-status-read/pre-transaction seam. |
| Focused cross-project authorization E2E | PASS: API+PostgreSQL probes for insight/traceability, repository/snapshot/scan-job, clarification, report/localization/note, and merged multi-repo report scopes; unauthorized mutations leave DB state unchanged. |
| Full `auth-rbac.e2e-spec.ts` | PASS: 1 suite, 30 tests after adding report/localization/merged-report cross-project probes. |
| Membership authorization E2E plus adjacent membership/RBAC suites | PASS: 3 suites, 37 tests on PostgreSQL; outsider scope, viewer role denial, nested member IDs and persistence invariants passed. |
| Current membership/switching E2E after adding hidden-project assertion | PASS: 2 suites, 7 tests; unjoined projects are absent from the project list. |
| Current membership/switching E2E after stale-JWT case | PASS: 2 suites, 8 tests on PostgreSQL; the revoked member's still-valid token receives 404 and leaves requirement and audit-event counts unchanged. |
| Cross-snapshot impact graph regression, pre-fix PostgreSQL E2E | RED as expected: the API graph included a foreign artifact connected by an edge whose stored snapshot belonged to the authorized analysis; assertion observed the foreign node. |
| Cross-snapshot impact graph regression, post-fix PostgreSQL E2E | PASS: 1 test; mismatched source and target endpoints are excluded from the response. |
| Cross-snapshot code-comprehension PostgreSQL E2E | PASS: full suite, 1 suite / 12 tests; mismatched foreign endpoints in both directions do not enter the projection. |
| Cross-snapshot evidence regression, pre-fix PostgreSQL E2E | RED as expected: `/evidence` returned foreign source when its row also referenced the local revision; `/insights` returned a foreign excerpt/path through an analysis evidence link. |
| Cross-snapshot evidence regression, post-fix PostgreSQL E2E | PASS: evidence, insights, traceability, and graph routes exclude mismatched source provenance while retaining correct same-snapshot code evidence and requirement-only revision evidence. |
| Cross-snapshot analysis and multi-repo projection regression | PASS after a pre-fix RED reproduced foreign artifact/evidence in traceability, workspace, and multi-repo row-detail responses; final regression covers evidence, insights, traceability, graph, workspace, diff, impact matrix, review coverage, and row detail, and verifies matrix/coverage counts exclude the invalid artifact. |
| GraphRepository unit suite | PASS: 1 suite / 2 tests after asserting endpoint snapshot scoping for incoming traversal and test-edge pagination. |
| Insight and traceability persistence suites | PASS: 2 suites / 6 tests after applying analysis evidence scope. |
| Full `auth-rbac.e2e-spec.ts` after graph/evidence scope changes | PASS: 1 suite / 42 tests on PostgreSQL. |
| `final-reviewed-report.audit-flow.e2e-spec.ts` after repository evidence filters | PASS: 1 suite / 18 tests on PostgreSQL; review snapshot and report provenance cases remain green. |
| Workspace typecheck after snapshot-scoped graph reads | PASS: backend, contracts/shared, web, and scripts typechecks via `pnpm typecheck`. |
| Focused ESLint and `git diff --check` after graph fix | PASS: changed graph query, builder, and E2E files lint clean; diff check reports only the repository's existing LF/CRLF notices. |
| Final A3 API+PostgreSQL E2E batch | PASS: run serially to avoid shared-database reset races; `auth-rbac.e2e-spec.ts` 42/42, `code-comprehension.e2e-spec.ts` 12/12, `multi-repo-analysis.e2e-spec.ts` 37/37, and `final-reviewed-report.audit-flow.e2e-spec.ts` 18/18. |
| Project-member CRUD role matrix | PASS: `project-role-permissions.e2e-spec.ts` 1 suite / 10 tests on PostgreSQL; all five roles read the member list, the four non-owner roles cannot create/update/delete, OWNER can create/update/delete, and denied writes preserve membership rows. |
| Test-trace evidence API response and role scope | PASS: the same API+PostgreSQL suite creates a valid snapshot-scoped Jest case, persisted `TESTS` edge and test evidence; all five roles receive a body accepted by `testTraceEvidenceResponseSchema`, while an outsider using the real evidence ID receives 404. |
| Current full project-permission role E2E | PASS: `project-role-permissions.e2e-spec.ts` 1 suite / 10 tests on PostgreSQL and Redis. OWNER exercises all 11 allowed permissions; non-owner denial cases include VIEWER scan/requirement/base-analysis/finalize and MAINTAINER review/clarification, with no denied DB writes. Scan enqueue response, database row and BullMQ job ID agree; test-created scan and analysis jobs are removed after each case. |
| Exhaustive project-role policy regression | PASS: `project-permission.service.spec.ts` 1 suite / 13 tests; the new table-driven case checks all 55 role/permission outcomes against the documented matrix. |
| Current monorepo typecheck after exhaustive role-matrix regression | PASS: `pnpm typecheck` completed backend, contracts/shared build, web, and scripts checks, exit code 0. |
| Role-matrix ESLint and documentation check | PASS: focused ESLint on both authorization test files and trailing-whitespace checks for both release ledgers; `git diff --check` exit code 0 with only line-ending notices. |
| Snapshot provenance unit regressions | PASS: 7 suites / 26 tests across GraphRepository, insight/traceability persistence, review coverage, matrix row detail, and API/core impact diff. |
| Event-log actor identity contract regression | RED before fix: missing `actorType` was accepted and coerced to SYSTEM. GREEN after fix: event-log contract plus service suites passed 2 suites / 8 tests; missing and unsupported identity values are rejected. |
| Contract package suite and API documentation | PASS: all 14 contract suites / 42 tests; API documentation E2E 1 suite / 3 tests after removing the obsolete OpenAPI `ZodCatch` adapter. |
| Current monorepo typecheck after snapshot provenance changes | PASS: `pnpm typecheck` completed backend, contracts/shared build, web, and scripts checks, exit code 0. |
| Current monorepo lint after snapshot provenance changes | PASS: `pnpm lint` exit code 0; ESLint reported 49 warnings (44 in apps/api and 5 in backend-runtime), with no errors. The warnings are type-only import style findings and remain visible for cleanup. |
| Current `git diff --check` | PASS, exit code 0; Git emitted only LF/CRLF working-copy notices. |
| Project-role API+PostgreSQL E2E, initial matrix | PASS: 1 suite, 1 test. |
| Pre-fix derived-analysis API regression | RED: answered review clarification passed authorization but `POST /review-clarifications/:id/derived-analyses` returned 500; server log identified undefined `RequirementRepository` injection in `CreateRequirementRevisionUseCase.execute`. |
| Post-fix project-role API+PostgreSQL+Redis E2E | PASS: 1 suite, 10 tests; covers all role actions above plus successful REVIEWER derived analysis, persisted requirement/review/analysis lineage, `READY_FOR_ANALYSIS`, BullMQ job identity, and idempotent retry with one revision/analysis. The viewer document job is also checked and removed from Redis. |
| Current authorization and membership E2E | PASS: 4 suites, 48 tests (`auth-rbac`, membership authorization, project switching, and expanded project-role matrix) on PostgreSQL/Redis; includes the 30-route read-surface sweep; no cross-suite reset conflicts. |
| Current authorization and lineage E2E | PASS: 4 suites, 87 tests (`auth-rbac`, analysis flow, project-role permissions, and multi-repo analysis) on PostgreSQL/Redis; includes foreign body-ID denial, strict input validation, persisted rerun/clarification lineage, conditional role permission, request-key lineage mismatch, and no-write assertions. |
| Current project-scoped route authorization sweep | PASS on instrumented rerun: `auth-rbac.e2e-spec.ts` 45/45 against PostgreSQL after adding denied repository connect/scan, all insight and traceability mutation methods, analysis finalize/review-decision, clarification dismiss/convert/create, multi-repo create, foreign requirement-revision create, and a real foreign analysis ID in an authorized run's matrix drilldown. One prior 44/45 full run had an unexplained workspace 500; the named workspace regression passed alone 1/1. The new API event-log identity probe also passed. |
| Analysis-lineage E2E regressions, pre-fix | RED as expected: foreign parent-analysis and source-clarification IDs each returned 201 instead of 404; valid lineage fields were both persisted as null; a misspelled field returned 201 instead of 400. |
| Analysis-lineage E2E regressions, post-fix | PASS within the current four-suite batch: inaccessible IDs return 404 without analysis/event writes, unknown fields return 400, REVIEWER persists rerun and clarification lineage, VIEWER receives 403 without writes, and changed lineage under the same request key returns 409. |
| Focused ESLint and `git diff --check` after lineage fix | PASS: ESLint on changed controller/use case/E2E/API-doc/contracts files; `git diff --check` (only existing LF/CRLF notices). |
| Current monorepo typecheck | PASS: backend, contracts/shared build, web typecheck, and scripts typecheck via `pnpm typecheck`. |
| Project-role E2E static checks | PASS after derived-analysis wiring: focused ESLint and backend TypeScript check (`pnpm typecheck:backend`), exit code 0. |
| Pre-fix file-download contract regression | RED as expected: `apiGetFile` resolved `text/html` HTTP 200 as `{ filename: "report.pdf" }` instead of rejecting. |
| Post-fix API client contract test | PASS: 1 suite, 7 tests; rejects HTML, missing attachment filename, and format-mismatched extension; accepts declared PDF/Markdown responses and matching filenames. |
| API error response contract tests | PASS: 4 tests in `operation-response.contract.spec.ts`; accepts AppError/NestJS shapes and rejects malformed fields or missing error identity. |
| API client error-envelope tests | PASS: 3 cases; focused `api-client.test.ts` is now 10/10 and verifies NestJS 403 mapping, AppError details preservation, and malformed-body fallback. |
| Analysis-list browser regression, pre-fix | RED on desktop and mobile: the HTTP 502 state rendered “Failed to load analyses” but exposed no accessible Retry button. |
| Analysis-list browser regression, post-fix | PASS: 2 Playwright tests on desktop and Pixel 7 mobile; verifies alert semantics, Enter-key retry, disabled “Retrying…” action during a held request, recovery to empty state, and Start Analysis CTA. |
| Cross-origin approved PDF export API E2E, pre-fix | RED: response allowed the configured origin but omitted `Access-Control-Expose-Headers`, so browser JS could not read the required filename header. |
| Cross-origin approved PDF export API E2E, post-fix | PASS: 1 test; asserts `Access-Control-Allow-Origin`, exposed `Content-Disposition`, PDF MIME, and attachment filename on the real HTTP response. |
| Current full web Jest `pnpm test:web` | PASS after analysis-list retry and error-envelope changes: 44 suites, 192 tests. |
| Web TypeScript check | PASS after the analysis-list retry change: `pnpm --dir apps/web typecheck`. |
| Web lint | PASS after the analysis-list retry change: `pnpm --dir apps/web lint`. |
| Current monorepo `pnpm typecheck` | PASS after API CORS, attachment, and error-envelope validation changes; backend, contracts, shared, web, and scripts checks exit 0. |
| Current monorepo `pnpm lint` | PASS after API CORS, attachment, and error-envelope changes: 8 workspace projects, 49 existing `consistent-type-imports` warnings, 0 errors. |
| Earlier adjacent auth and membership E2E | PASS: 4 suites, 38 tests (`auth-rbac`, membership authorization, project switching, and project-role matrix); injected event-log 500 was expected by its rollback test. |
| Focused `review-decision` PostgreSQL E2E with server-error logging | PASS: 1 suite, 4 tests; the prior three 500s did not reproduce, so their cause remains unknown. |
| `reset-db.spec.ts` | RED before fix on transient `40P01`/`P2024` errors; PASS after fix: 1 suite, 3 tests, including immediate failure for non-transient errors. |
| Scan request field regression, pre-fix | RED: `requestedRef: "release/candidate"` returned 201; persisted `ScanJob.requestedRef` was null rather than the requested branch. |
| Scan request field regression, post-fix | PASS in full API E2E: unsupported alias returns 400 without a persisted scan row; `ref: "main"` is persisted and BullMQ recovery remains idempotent. |
| Pre-fix PostgreSQL analyzer-quality E2E | RED: reproduced a database connection timeout in `TraceabilityRepository.linkEvidence` during per-link concurrent evidence writes. |
| Pre-fix bulk persistence regression | RED as expected: `TraceabilityRepository.linkEvidenceMany` did not exist. |
| Post-fix evidence persistence and analysis unit tests | PASS: 4 suites, 16 tests across both repositories and the analysis pipeline. |
| Post-fix PostgreSQL analyzer-quality E2E | PASS: 1 suite, 1 test; all cases completed, critical/overall recall 1.00, evidence coverage 1.00, orphan evidenced claims 0. |
| Full API E2E `pnpm test:e2e` after scan contract strictness and caller fixes | PASS: 29 suites, 174 tests. This run includes the unsupported-field rejection, valid ref persistence, and all updated scan callers. |
| Previous full API E2E `pnpm test:e2e` with `E2E_LOG_SERVER_ERRORS=true` | PASS before the latest project-role test additions: 30 suites, 176 tests in 316.611 seconds; all logged 5xx responses matched deliberate failure-injection tests, with no failure on the legacy review-decision route. |
| Current full API E2E `pnpm test:e2e` with `E2E_LOG_SERVER_ERRORS=true` | PASS on this worktree: 30 suites, 188 tests in 234.036 seconds. Logged 5xx responses matched asserted export-blocked or injected storage/queue failures; unsupported framework behavior remained asserted. Includes the required review `requestKey` across route consumers and PostgreSQL/Redis recovery. |
| Full API E2E after lineage change, first attempt | FAIL: 28/30 suites and 194/198 tests passed. One stale error-mapping fixture lacked membership in the snapshot project; the other 3 failures were finalize 500/race-barrier assertions in multi-repo and final-reviewed-report suites. |
| Affected finalization suites isolated with server-error logging | PASS: 2 suites, 54 tests; the four failures from the first full run did not reproduce. Expected injected audit/export errors were logged. |
| Current full API E2E after fixture correction, with `E2E_LOG_SERVER_ERRORS=true` | PASS: 30 suites, 198 tests in 238.918 seconds. No unexpected 5xx in the instrumented run; the earlier full-context failures remain unexplained and are tracked above. |
| Backend and web TypeScript checks after review command contract change | PASS: `pnpm typecheck:backend` and `pnpm --dir apps/web typecheck`, exit code 0. The first web check caught a callback signature mismatch in `analysis-review-workbench` and test mock typing; both were corrected before the passing run. |
| Focused ESLint and `git diff --check` | PASS, exit code 0. ESLint emitted only the existing Next.js warning that no root `pages` directory was found. |
| Earlier full API E2E immediately after scan schema change | FAIL: 27/29 suites passed, 170/174 tests passed. One workspace suite still sent the now-rejected `requestedRef` alias (fixed); three review-decision cases returned unexpected 500s, not reproduced in the subsequent paired run or final full run. |
| Review-decision suite + adjacent workspace suite with server logs enabled | PASS: 2 suites, 5 tests; the review-decision 500s from the first full run did not reproduce. |
| Focused legacy review-decision repetition | PASS: 10 independent Jest invocations, 1 suite / 4 tests each (40 tests total); no unexpected 5xx. This probes repeated API/Prisma startup and teardown, but does not reproduce the missing full-suite context from the historical failure. |
| Prior Web Jest baseline `pnpm test:web` | PASS before MIME regression cases: 44 suites, 185 tests. |
| Focused scan hook and repository-connect dialog tests | PASS: 2 suites, 2 tests after strict shared request validation. |
| Web typecheck after file-download contract fix | PASS: `pnpm --dir apps/web typecheck`, exit code 0. |
| Web lint after file-download contract fix | PASS: `pnpm --dir apps/web lint`, exit code 0. |
| Focused ESLint on extended role E2E | PASS: `pnpm exec eslint apps/api/test/e2e/project-role-permissions.e2e-spec.ts`, exit code 0. |
| Managed Playwright webServer teardown on Windows | NOT CLEAN: report assertion passed, but the runner did not exit after waiting 30 seconds and was interrupted. Re-running with the documented prestarted-server mode passed and exited 0. |
| Worker document job during browser verification | One `DOCUMENT_JOB_NOT_READY` appeared in the interrupted managed-server run; it did not recur in the prestarted report journey or full browser matrix. Root cause remains unverified. |
| Root backend TypeScript check (`tsc --noEmit`) | PASS. |
| ESLint on all changed TypeScript files | PASS. |
| `git diff --check` | PASS. |
| Exact clean-commit hosted CI | NOT RUN: the candidate remains uncommitted and no fresh remote fetch/CI result was obtained. |

The first post-change run of the report audit-flow suite had two race-test
failures: their test doubles paused inside the repository call after production
code had already acquired the parent-row lock, so the test held the lock while
waiting for finalization. The barriers now pause after the real preflight read
and before the transaction lock; the reviewer then resumes after finalization
and is rejected by the actual PostgreSQL guard. Later full-suite runs exposed
transient deadlocks and pool-acquire timeouts during parallel database resets.
The reset helper now retries only those transient cases, and the final full API
E2E run passed.

## Next work

1. Complete response-mapper parity for every API response consumed by the frontend and record explicit contract exceptions.
2. Expand route-state and browser coverage for forbidden, missing, stale, partial, failed, and retry states; analysis-list error/empty/retry currently has desktop/mobile regression coverage.
3. Keep the historical `review-decision` 500 and the one transient auth-workspace 500 classified `UNVERIFIED`; if either recurs, preserve method/path, exception stack, and database state. Instrumented full reruns and isolated probes passed, but the original causes remain unavailable.
4. Investigate the Windows managed-Playwright teardown and the one non-reproduced `DOCUMENT_JOB_NOT_READY` log.
5. Complete manual keyboard, focus-return, and screen-reader accessibility checks.
6. Obtain exact-commit hosted CI after the candidate is committed and remotely verified; close all remaining release gates before claiming release completion.
7. If the full-suite finalization failures recur, capture Prisma/server stack and test ordering; isolated and subsequent instrumented full reruns passed, but the first full-context failures remain unexplained.
