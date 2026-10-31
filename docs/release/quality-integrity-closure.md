# BA_Helper Quality Integrity Closure

Updated: 2026-10-30
Status: IN PROGRESS; this ledger is evidence tracking, not release certification.

## Baseline

- Branch: `codex/integration-product-integrity-v1`
- Base commit: `a1e19e000dacbf1f14b30106d6842233ee7d7b0c`
- The initial continuation baseline was `a1e19e000dacbf1f14b30106d6842233ee7d7b0c`, with uncommitted integrity changes preserved. Current local `HEAD` is `762759cb2623ff51ee2fcb785352a826125b7131` (`feat: add bulk linking of evidence for insights and traceability records`); current integrity changes remain uncommitted on top of it. The cached `origin/codex/integration-product-integrity-v1` ref also points to `762759c`, but a fresh `git fetch origin` was denied because the sandbox cannot write `.git/FETCH_HEAD`, so remote freshness is unverified. This candidate is not an exact clean commit.
- `git fetch origin` succeeded on 2026-10-29. `HEAD` and `origin/codex/integration-product-integrity-v1` both point to `a1e19e000dacbf1f14b30106d6842233ee7d7b0c`. The remote tips of `codex/fix-backend-runtime-ci-boundary` (`689918502d945c3dfe234c3236dbeb455cbd45f0`) and `fix/scan-source-omission-health-v1` (`9e63721b5cd885cee67ec98cb4cfd2fbce7108e8`) are both ancestors of `HEAD`; the latter is present through merge commit `1bd036b`. `origin/main` is 62 commits behind `HEAD`. The worktree remains dirty and no branch integration was performed in this continuation.
- Remote state was refreshed again on 2026-10-29 after the previous iteration: local `HEAD` still matches the integration remote tip (0/0); `origin/main` is `27b388adc25638e0c9737578872baf71e9aa0d2a` and is 62 commits behind `HEAD` (0 ahead); both previously identified fix-branch tips remain ancestors of `HEAD`. The remote integration and fix branches remain unmerged into `origin/main`; no merge/rebase was performed. Existing worktree changes remain uncommitted.
- E2E tests loaded `.env.test` and exercised the configured PostgreSQL and Redis services. Secret values were not inspected or recorded.
- Priority-candidate revalidation used current local `HEAD` `762759cb2623ff51ee2fcb785352a826125b7131`; the branch and cached integration remote ref still agree, but remote freshness remains unverified because `.git/FETCH_HEAD` is not writable in this sandbox. The candidate worktree remains dirty and uncommitted.

## Findings and verification

| Status | Severity | Area | Evidence and disposition |
| --- | --- | --- | --- |
| CONFIRMED_DEFECT, fixed | P1 | Review audit history and delayed command replay | PostgreSQL E2E first reproduced accept → reject → accept storing two events instead of three for impact and insight reviews. A follow-up red E2E reproduced a delayed retry restoring the old decision after a newer reject because server-generated random event keys did not identify a command. Review requests now require a UUID `requestKey`; a payload fingerprint binds it to item, analysis, target, action, rationale, and actor. The stable event key is checked under the analysis lock; exact replays return the current persisted decision without reapplying, and key reuse with a different command returns 409 `REQUEST_KEY_MISMATCH`. New no-op commands persist one receipt so a delayed no-op retry also cannot overwrite later state. |
| CONFIRMED_DEFECT, fixed | P2 | System actor projection | Unit regression reproduced `actorUserId: "SYSTEM"` being returned as `actorType: "USER"`. The mapper now honors explicit actor type and normalizes the system sentinel when the type is absent. Current API+PostgreSQL E2E also verifies writer-generated default SYSTEM, explicit USER, lowercase legacy `system`, missing legacy actors, and that `actorUserId` is not returned in the DTO. |
| CONFIRMED_DEFECT, fixed | P2 | Event-log response schema invented SYSTEM identity | The shared `eventLogDtoSchema` used `.catch('SYSTEM')`; a contract regression reproduced a missing `actorType` parsing successfully as SYSTEM. The schema now accepts only explicit `SYSTEM` or `USER`. The event-log service remains responsible for resolving legacy persisted payloads before DTO mapping, so wire validation no longer masks malformed output. |
| CONFIRMED_DEFECT, fixed | P2 | Scan and analysis event endpoints bypassed their shared runtime response contract | An API+PostgreSQL E2E injected an event DTO with `actorType: AUTOMATION`; both endpoints returned HTTP 200 before the fix although the FE hooks consume `eventLogListResponseSchema`. Both controllers now parse that shared response schema. E2E verifies malformed service output fails closed, and valid scan/analysis events parse through the same schema. |
| CONFIRMED_DEFECT, fixed | P2 | Malformed or incomplete frozen report content could be omitted | Reviewed snapshot fields used `z.any()` and final report fields used `z.unknown()`. The report coverage projection filters malformed decision rows, so invalid frozen data could yield empty review data with a successful response. Shared contracts now validate evidence-quality items, summary counters, nullable evaluation context, and agreement between frozen item counts and all supplied quality-counter aliases. A red API+PostgreSQL reproduction showed an empty item array with nonzero frozen counters returned 200; both snapshot and final-report APIs now return 409 `REPORT_PROVENANCE_MISMATCH`. |
| UNVERIFIED, scoped inventory complete | P2 | Historical reviewed-report JSON compatibility | Read-only inventory of the configured `.env.test` database found 2 snapshots; both passed the current shared Zod contract, with 0 `{ artifactKey, decision }` rows, 0 summaries using the legacy `EVIDENCED` key, and 0 noncanonical top-level shapes. No payloads were emitted or changed. Other target databases were not inspected; legacy rows still fail closed with `REPORT_PROVENANCE_MISMATCH`, so target-environment compatibility remains open before release. |
| VERIFIED_SAFE, scoped | P1 | PostgreSQL `QUEUED` scan / analysis / document and BullMQ recovery | Real API+PostgreSQL+Redis E2E injects an enqueue failure for each durable job family, verifies the committed `QUEUED` row and missing Redis job, invokes worker-startup recovery, checks the deterministic BullMQ job identity, and verifies same-key API retry does not create a second row. Focused scan, analysis, and document recovery E2E plus the full API E2E passed. |
| CONFIRMED_DEFECT, fixed | P1 | PostgreSQL `QUEUED` row with retained failed BullMQ job | A real scan API+PostgreSQL+Redis E2E observed startup recovery leaving the deterministic BullMQ job in `failed` while PostgreSQL remained `QUEUED`; the same failure mode was then covered for impact analysis. Shared enqueue now explicitly retries a retained failed job. Scan and impact-analysis recovery E2E verify the job returns to `waiting`; unit coverage also checks embedding and document retry. |
| CONFIRMED_DEFECT, fixed | P1 | Live worker did not reconcile orphaned PostgreSQL `QUEUED` jobs | A red API+PostgreSQL+Redis E2E started recovery before the API mutation, injected a one-time BullMQ enqueue failure, then observed a committed `DocumentJob=QUEUED` with no Redis job and no recovery after 2 seconds without a restart or client retry. Recovery previously ran only at worker bootstrap. The worker now re-enqueues persisted scan, impact-analysis, and document jobs every 30 seconds by default (bounded override 1-300 seconds), prevents overlapping cycles, awaits shutdown, and records safe retryable diagnostics. The same E2E now recovers the job while the worker stays online; no schema change was needed. |
| CONFIRMED_DEFECT, fixed | P2 | Queue enqueue exception leaked through reviewed-report job details | A red API+PostgreSQL E2E injected a synthetic Redis URL containing a credential marker. Finalization persisted the raw exception in `DocumentJob.error`, and the final-report pending response could include it in `DOCUMENT_JOB_NOT_READY.details`. Finalization now leaves the durable row `QUEUED`, emits only structured safe fields, and does not persist exception text. The same E2E verifies the marker is absent from PostgreSQL and the API response. |
| CONFIRMED_DEFECT, fixed | P2 | `DOCUMENT_JOB_NOT_READY` mapped to HTTP 400 | The final-report E2E observed HTTP 400 for a report whose persisted document job was still `QUEUED`. The application error filter now maps this resource-state conflict to 409; the API+PostgreSQL regression verifies 409 with `DOCUMENT_JOB_NOT_READY`. |
| CONFIRMED_DEFECT, fixed | P2 | Worker document-generation failure details exposed raw exception text | RED unit test reproduced `RuntimeDocumentJobRunnerAdapter` persisting a credential-bearing Redis URL from `Error.message`; API+PostgreSQL E2E independently reproduced that legacy persisted error in both `DOCUMENT_JOB_NOT_READY.details` and the document-job response. Terminal worker failures now persist only `{ code: DOCUMENT_GENERATION_FAILED }`; the shared response schema accepts only that stable shape, and both API projections normalize non-null legacy JSON to the same code. The same database/API regression passes and confirms the marker is absent from both responses. Existing database JSON was not rewritten. |
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
| Worker document job during browser verification | One `DOCUMENT_JOB_NOT_READY` appeared in the interrupted managed-server run; it did not recur in the prestarted report journey or full browser matrix. A later live-worker PostgreSQL/Redis test reproduced orphaned queued jobs and periodic recovery now closes that path, but the original browser request cannot be causally linked to the reproduced scenario. |
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

1. Scoped inventory is complete for `.env.test`: 2/2 persisted snapshots pass the current contract and no prior-seed shape was found. Inventory each actual release target database read-only before deciding whether repair or an explicit compatibility exception is needed; no repair was applied.
2. Continue response-mapper parity for the remaining frontend API consumer families; analysis lifecycle/read models, QA coverage, test-trace evidence, impact diff, clarification workflows, and reviewed-report snapshot/final response families now have shared-schema parity evidence and happy-path API+PostgreSQL response parsing.
3. Expand route-state and browser coverage for forbidden, missing, stale, partial, failed, and retry states; analysis-list error/empty/retry currently has desktop/mobile regression coverage.
4. Keep the historical `review-decision` 500 classified `UNVERIFIED`. The later auth-workspace and multi-repo pool timeouts passed on a full rerun after E2E lifecycle cleanup; if connection errors recur, preserve method/path, exception stack, and database state. The timer leak was confirmed, but its causal contribution to the pool timeouts is not proven.
5. Confirm periodic queued-job recovery timing and queue load against the release worker configuration; local API/PostgreSQL/Redis E2E verifies recovery while the worker remains online. Manual recovery-service bootstraps in the scan and impact E2E specs now pair with shutdown so their timers do not cross suite boundaries.
6. Complete manual keyboard, focus-return, and screen-reader accessibility checks.
7. Obtain exact-commit hosted CI after the candidate is committed and remotely verified; close all remaining release gates before claiming release completion.
8. Keep one post-cleanup full API E2E rerun green in the evidence ledger; if the prior pg-pool connection timeout recurs, capture Prisma/server stack and test ordering. Docker resource metrics were unavailable from this sandbox.

### Frozen reviewed-report snapshot runtime contracts (2026-10-29)

- The shared reviewed-snapshot and final-report schemas now validate the evidence-quality item array, quality counters, nullable evaluation context, and item/counter agreement. The final-report use case validates frozen data before computing coverage; the latest-snapshot API maps schema failures to 409 `REPORT_PROVENANCE_MISMATCH` rather than leaking a Zod 500 or returning filtered empty rows.
- Red regression: a shape-valid empty item array paired with a frozen summary counting existing rows passed contract validation and returned 200 from the latest-snapshot API. The contract and API+PostgreSQL tests now reject this same persisted state with typed 409 responses on both latest-snapshot and final-report routes.
- Demo Scenario B now persists traceability evidence and review decisions, builds its frozen quality snapshot through the finalization projection, and validates the seed snapshot against the shared runtime contract. The demo seed completed against `.env.test`.
- Verification: focused contract/backend unit run passed 7 suites / 40 tests; report UI run passed 3 suites / 10 tests; final-report audit-flow and API documentation E2E passed 22/22; root `pnpm typecheck` passed; focused ESLint exited 0; `git diff --check` passed.
- Residual: existing production or developer databases were not enumerated for historical JSON written by the previous demo seed. Strict responses reject incompatible rows rather than silently replacing them with empty data; the release inventory must determine whether any database needs repair. Remote branch freshness was not checked because `.git/FETCH_HEAD` is read-only in this sandbox.

### Worker document-job error normalization (2026-10-29)

- RED: the terminal worker-adapter unit test observed the synthetic credential-bearing Redis URL in the persisted `DocumentJob.error`. API+PostgreSQL E2E observed the same marker in both the final-report 409 details and document-job response after loading a legacy-shaped error row.
- Fix: worker persistence stores only `DOCUMENT_GENERATION_FAILED`; the shared document-job contract validates that public code shape. The enqueue response maps legacy non-null JSON to the stable code, and the final-report error omits raw persisted fields while retaining the safe code.
- GREEN: focused runtime, contract, and report-use-case tests passed 3 suites / 21 tests. Related final-report, document recovery, and API documentation E2E passed 3 suites / 26 tests on `.env.test` PostgreSQL and Redis. The current full `auth-rbac.e2e-spec.ts` also passed 1 suite / 46 tests, including cross-project foreign-ID denials and persistence checks. Root `pnpm typecheck` and focused ESLint on changed TypeScript files passed.
- Residual: no migration or cleanup rewrote historical error JSON at rest; API response projections mask it. Full CI, Browser/Playwright, hosted exact-commit CI, and remote freshness remain unverified for this dirty candidate. The migration-upgrade verifier later passed via the documented `ts-node` fallback; its normal `tsx` wrapper could not start on this local Windows runtime (recorded below).

### Full root unit suite (2026-10-29)

- First full run exposed 19 failures in three suites. Impact-graph test data omitted the selected snapshot/revision identity now required by fail-closed provenance filtering; create-analysis mocks omitted nullable lineage columns and the Prisma source-analysis lookup. The evaluation test exceeded Jest's default 5-second timeout while scanning all CPU-bound fixtures.
- Updated only those test fixtures to represent valid current persistence rows and set that bounded evaluation test to 10 seconds. The three focused suites then passed 59/59 tests.
- Full `pnpm test` rerun passed 246/246 suites, 1,417/1,417 tests, and 1 snapshot in 459.686 seconds. No production graph or analysis behavior was relaxed.
- Root `pnpm typecheck` passed after these final test edits. Full `pnpm lint` exited 0 with 0 errors and 49 `consistent-type-imports` warnings; two warnings in modified test files were then corrected, and focused ESLint on all touched TypeScript files passed. Remaining lint warnings are outside the changed files.

### Full API E2E recovery timer cleanup (2026-10-29)

- RED: the instrumented full API E2E run failed 2/30 suites and 3/212 tests. `auth-rbac` workspace and multi-repo create/finalize requests logged `pg-pool` connection timeouts. The same run also showed periodic recovery-query errors after tests manually called `StaleJobRecoveryService.onApplicationBootstrap()` without pairing `onApplicationShutdown()` in the scan and impact enqueue-recovery specs. The multi-repo suite passed alone (37/37), confirming that full-suite context mattered.
- Root cause found: those two manually started services kept their 30-second recovery intervals alive across E2E test boundaries and continued querying Prisma. The document-recovery spec already used paired shutdown. Scan and impact specs now retain the service and invoke shutdown in `afterEach`; runtime recovery behavior is unchanged.
- GREEN: the three recovery E2E suites passed (6/6). The full API E2E then passed all 30 suites and 212 tests in 350.879 seconds. No periodic recovery errors or unexpected server failures appeared in that run; PostgreSQL monitoring observed at most 11 client sessions against a server limit of 100.
- Final recheck after consolidating each E2E teardown hook: scan and impact recovery E2E passed 2 suites / 4 tests; focused ESLint passed on both changed files; monorepo `pnpm typecheck` and `git diff --check` passed.
- Residual: the post-cleanup full run passed once, so the timer leak is a confirmed source of cross-suite background queries but its causal contribution to every prior socket timeout is not proven. Docker Desktop resource metrics could not be read from this sandbox. Recheck on the next exact-candidate CI run and record any recurrence rather than raising connection/pool timeouts speculatively.

### Analysis API response-contract parity slice (2026-10-29)

- Static parity: `use-analyses.ts`, `use-qa-coverage.ts`, and `use-test-trace-evidence.ts` validate responses with shared `@ba-helper/contracts` schemas. The lifecycle and read-model controllers parse those same schemas after mapping/use-case execution; the test-trace evidence controller does likewise.
- API+PostgreSQL coverage: `analysis-flow.e2e-spec.ts` parses actual create, detail, list, workspace, lineage, drift-freshness, graph, QA coverage, review queue, and finalize responses. `impact-diff.e2e-spec.ts` already parses the diff response, and `project-role-permissions.e2e-spec.ts` parses test-trace evidence from its real endpoint.
- GREEN: `pnpm exec jest --config jest.e2e.config.ts --runInBand apps/api/test/e2e/analysis-flow.e2e-spec.ts` passed 1/1 tests against `.env.test` PostgreSQL and Redis (9.506 seconds). Root `pnpm typecheck`, focused ESLint on `analysis-flow.e2e-spec.ts`, and `git diff --check` all passed; Git emitted only line-ending normalization warnings for other already-modified worktree files.
- Scope: this verifies response shape at the HTTP consumer boundary for these analysis-family endpoints and representative persisted data. It does not establish semantic parity for every field or close the application-wide response-mapper inventory; other consumer families and negative/malformed response cases remain open.

### Clarification API response-contract parity slice (2026-10-29)

- Static parity: `use-clarifications.ts` and both clarification controllers validate successful responses with the same shared schemas from `@ba-helper/contracts`, including the legacy-named `reviewClarificationRequestSchema` response DTO. The derived-analysis mutation and controller share `impactAnalysisResponseSchema`.
- API+PostgreSQL coverage: focused `auth-rbac.e2e-spec.ts` cases parsed classic clarification create/list/answer/dismiss/convert and review-clarification list/create/answer responses against their shared schemas. The focused derived-analysis case in `project-role-permissions.e2e-spec.ts` parsed the persisted queued analysis response and checked its clarification provenance.
- GREEN: the selected auth/RBAC tests passed 3/3 (43 other tests filtered by name), the derived-analysis provenance test passed 1/1 (9 filtered), root `pnpm typecheck` passed, focused ESLint on `auth-rbac.e2e-spec.ts` passed, and `git diff --check` passed with only worktree line-ending normalization warnings.
- Scope: this verifies representative successful persisted lifecycle payloads and schema usage for the clarification consumer family. It does not close application-wide field-semantic parity, negative response-schema cases, or other consumer families.

### Reviewed-report snapshot and final response-contract parity slice (2026-10-29)

- Static parity: `use-documents.ts` and `use-approved-report.ts` consume `reviewedReportSnapshotSchema` / `finalReviewedReportResponseSchema`; the document controller parses those same schemas on latest-snapshot and final-reviewed-report responses. The create-snapshot response is also parsed against the snapshot schema at the controller boundary.
- API+PostgreSQL success path: the focused `complete reviewed flow returns final report` journey now parses the actual create-snapshot response, fetches and parses the latest snapshot, verifies its identity and approved-document link, then parses the final report and checks that `snapshotId` points to the same frozen snapshot. The existing approved-report schema/provenance assertion remains in that flow.
- GREEN: the report success journey passed in isolation first (1/1, 8.084 seconds), then the full `final-reviewed-report.audit-flow.e2e-spec.ts` passed 21/21 tests against `.env.test` in 42.822 seconds. Its single logged HTTP 500 is the expected event-storage failure injection in the rollback test; no other request failed. Root `pnpm typecheck`, focused ESLint on the three changed E2E specs, and `git diff --check` passed. The malformed frozen-snapshot test in that full run still asserts typed 409 `REPORT_PROVENANCE_MISMATCH`.
- Scope: this confirms response-contract parity and snapshot identity for the exercised report success path and revalidates its negative provenance suite. Application-wide field-semantic parity and other API consumer families remain open.

### Retained failed BullMQ job recovery (2026-10-29)

- RED: two new queue unit cases showed that scan and impact-analysis enqueue calls did not look up a deterministic BullMQ ID already retained in `failed`. The real scan API+PostgreSQL+Redis E2E also observed a persisted `QUEUED` row whose retained Redis job stayed `failed` after startup recovery.
- Root cause: `Queue.add` with an existing deterministic ID does not reactivate a retained failed BullMQ job. Recovery therefore appeared successful at the API/use-case boundary while Redis never returned the job to processing.
- Fix: scan, impact-analysis, embedding, and document enqueue now share `enqueueRetryableJob`. It adds a missing job, reuses a nonfailed existing job, or retries a retained failed job; a concurrent retry already moved out of `failed` is treated as delivered. API and worker BullMQ setup read the same optional `BULLMQ_PREFIX`; each API E2E app receives a unique test prefix so old jobs in the isolated test Redis database cannot be consumed by a new test worker. No Redis keys were deleted. The API package directly declares BullMQ as a dev dependency for its real-worker E2E seam.
- GREEN: QueueService unit suite passed 12/12. Scan, impact-analysis, and document-recovery API+PostgreSQL+Redis E2E suites passed 8/8. Review-item decision E2E passed 14/14, covering `ACCEPTED → REJECTED → ACCEPTED`, delayed replay, concurrent duplicate commands, and audit event counts. The selected event actor API E2E passed 1/1 (45 unrelated tests filtered), and queue plus event-log unit suites passed 19/19 before the enqueue helper was split out.
- Verification: root `pnpm typecheck` passed; focused ESLint passed for all changed TypeScript files; `pnpm install --lockfile-only --offline` passed supply-chain policy checks for 1,697 lock entries; `git diff --check` passed before this documentation update. The pnpm script runner reported that it could not perform its optional node_modules relink because the configured store is outside writable scope and no TTY was available; package scripts still completed with exit code 0 against the current workspace modules. A local ignored `apps/api/node_modules/bullmq` junction was needed to typecheck this sandbox; a clean install/CI will validate normal package linking.
- Residual: the test proves recovery of representative scan and impact-analysis jobs while the worker process is online; it does not establish production recovery latency, sustained queue-load behavior, or all four queue families at HTTP+DB+Redis E2E level. Embedding and document retry behavior are covered at QueueService unit level, and document startup recovery remains covered by its API E2E. Full API E2E, full CI, exact clean-commit hosted CI, and remote freshness remain open.

### Event-log endpoint response-contract enforcement (2026-10-29)

- RED: real API+PostgreSQL E2E injected a malformed event DTO with `actorType: AUTOMATION`; both the scan-job and analysis event endpoints returned HTTP 200 before controller validation. The FE hooks already used `eventLogListResponseSchema`, so the server could emit an invalid shape that the consumer rejected only after receipt.
- Fix: both controllers now parse `{ items: events }` with the same shared `eventLogListResponseSchema` used by the frontend and API documentation. The misleading analysis-controller comment about missing-resource behavior was removed; project-scope authorization already returns 404 for a missing analysis.
- GREEN: the selected PostgreSQL E2E cases passed 3/3: malformed analysis response rejection, valid scan-event response parsing plus malformed scan response rejection, and system/user actor projection. 49 unrelated tests were filtered. The malformed response cases were temporarily run with controller parsing removed and both returned 200, then passed after restoring the shared-schema parse.
- Scope: this closes the event-log family mapper/runtime-contract gap for scan-job and analysis events. It does not close the remaining API consumer inventory rows, field-semantic parity elsewhere, the full API E2E gate, or exact-candidate hosted CI.

### Cross-project authorization seam revalidation (2026-10-29)

- The user-selected seam is a real HTTP API request against PostgreSQL: a user with membership in project A addresses a project B resource by ID; hidden resources must return 404, and denied mutations must leave persisted state unchanged.
- Existing regression coverage already exercises this seam across analysis/report reads and exports, review and clarification mutations, insight/traceability decisions, repositories/snapshots/scans, multi-repo reports, project-member operations, and foreign child IDs supplied in otherwise authorized route bodies. No new application defect was reproduced, so this iteration required no authorization code change.
- GREEN: the full `auth-rbac.e2e-spec.ts` passed 47/47 tests in 65.611 seconds. Focused cross-project cases passed 8/8, foreign-ID body/path cases passed 9/9, the project-role cross-project case passed 1/1, and project-membership authorization passed 1/1. Tests ran against `.env.test` PostgreSQL and Redis. The targeted tests assert 404/403 boundaries and persisted row/count invariants for denied writes.
- Scope: this revalidates API authorization on the current dirty candidate and the selected PostgreSQL seam. It does not establish hosted CI on an exact clean commit or close the remaining route-state, response-mapper parity, responsive, accessibility, and full-suite release gates.

### Bounded merged-report database fan-out (2026-10-30)

- RED: the 20-child use-case regression observed 20 concurrent `listByAnalysis` repository reads, exceeding its bound of 8. Each child fetches insights and traceability; each repository method performs multiple sequential Prisma reads. The merged-report API permits up to 20 repositories, so request-level fan-out could contend for the default PostgreSQL pool. This is a confirmed resource-bound risk; its causal contribution to earlier full-suite connection timeouts is not proven.
- Fix: merged-report draft assembly now processes four child analyses per batch and waits for each batch before loading the next. Input order remains stable because each batch uses `Promise.all` and batches append sequentially. No API or persistence contract changed.
- GREEN: the regression passed 1/1; root `pnpm typecheck` passed; root `pnpm lint` exited 0 with 0 errors and 47 pre-existing `consistent-type-imports` warnings outside this slice; root `pnpm test` passed 247/247 suites, 1,421/1,421 tests, and 1 snapshot in 409.614 seconds. `multi-repo-analysis.e2e-spec.ts` passed 37/37. The instrumented full API E2E passed 30/30 suites and 216/216 tests in 429.874 seconds. These full-suite passes confirm no observed regression on this candidate; they do not prove that the earlier pool timeouts had this fan-out as their sole cause.
- Related authorization revalidation on this candidate: `auth-rbac.e2e-spec.ts` passed 47/47, the focused project-role cross-project test passed 1/1, and project-membership authorization passed 1/1 against `.env.test` PostgreSQL/Redis. Foreign resource IDs returned the documented 404/403 and denied writes preserved persisted state; no new authorization fix was needed.
- Residual: the candidate remains a dirty worktree, so full API E2E is not hosted CI for an exact clean commit. Full CI, exact-commit hosted CI, and the still-open browser, responsive, accessibility, and response-mapper gates remain outstanding.

### Migration upgrade verifier revalidation (2026-10-30)

- The verifier's configured test connection resolves to `localhost:5432/ba_helper_test`; it creates a PID/random-suffixed scratch database, copies the selected migration chain to a path-checked temporary workspace, and drops the scratch database in `finally`. No dev or production database was targeted.
- `pnpm verify:migration-upgrade` failed before executing the verifier because `tsx` raised `uv_os_get_passwd ENOMEM` on this Windows runtime. This is a local runner startup failure; it does not establish a migration failure.
- The verifier itself passed with `pnpm exec ts-node --transpile-only scripts/verify-migration-upgrade.ts`: legacy data survived, current upgrades applied, repeat deploy succeeded, and the temporary DB was cleaned up.
- Residual: local migration semantics are verified, but the exact `tsx` entrypoint still needs a hosted CI result on the release candidate. The worktree remains dirty and no hosted run was started.

### Review-coverage and review-completion consumer contract parity (2026-10-30)

- `use-review-coverage.ts` validates successful responses with `reviewCoverageResponseSchema`; `ImpactAnalysisReviewController` parses the same schema before responding.
- The PostgreSQL E2E for a mismatched cross-snapshot dependency edge now parses the real review-coverage response with that shared contract. It also verifies `summary.impactedArtifacts` remains 1 after invalid foreign edges are filtered, preserving the data-scope assertion.
- The same real API+PostgreSQL case parses the review-completion response and verifies the selected analysis ID, one local traceability link, and its `needsReview` count.
- Verification: focused `auth-rbac.e2e-spec.ts` case passed 1/1 (46 other tests filtered); focused ESLint passed; `git diff --check` passed.
- Scope: this closes response-contract and persisted-data evidence for review-coverage and review-completion only. The previously pending consumer rows were examined in the subsequent parity sweep; broader field-semantic parity and release gates remain open.

### Localization API response-contract enforcement (2026-10-30)

- Static parity: `use-localization.ts` parses successful responses with `localizedReportArtifactSchema` and `localizationStatusResponseSchema`; the API docs declare those same schemas. Before this change, `LocalizationController` returned both use-case values without runtime validation.
- RED: two controller regressions supplied malformed localized-artifact and status DTOs; both promises resolved before the fix.
- Fix: the controller now parses both use-case results with the shared response schemas before returning them. Existing `FAILED` generation behavior remains an HTTP 500 after DTO validation.
- GREEN: `localization.controller.spec.ts` passed 5/5, covering a valid artifact, a valid status, unsupported locale rejection, and malformed artifact/status rejection.
- Scope: this verifies controller-level response shape enforcement and frontend/API schema identity. The current tests do not exercise an authorized successful localization request over HTTP/PostgreSQL; that journey remains open. Other consumer-family evidence is recorded in the subsequent parity sweep.

### Multi-repository matrix row-detail response contract (2026-10-30)

- Static parity: `use-impact-matrix.ts`, API docs, and the matrix row-detail response share `matrixRowDetailResponseSchema`. The controller previously returned the use-case object directly based on a comment that it was already schema-shaped.
- RED: a controller regression supplied `{ runId: 'run-1' }`; the endpoint resolved that malformed object rather than rejecting it.
- Fix: `ImpactAnalysisReadModelController` now parses row-detail output with `matrixRowDetailResponseSchema` at the API boundary.
- GREEN: the read-model controller spec passed 7/7; real API+PostgreSQL `matrix-drilldown.e2e-spec.ts` passed 3/3, including response-schema parsing and run/analysis identity assertions.
- Scope: this closes the matrix row-detail response-shape gap. It does not establish every matrix field's semantic parity or close other pending consumer families and full release gates.

### Remaining frontend API consumer parity sweep (2026-10-30)

- Static audit: verified the shared FE schemas against controller response parsing for domain packs, multi-repo create/detail/list, repository create/list/detail and snapshot drift, snapshot list, single/multi-repo review decisions, scan-job creation, system health, current workspace/project list/switch, and matrix responses. This found the matrix row-detail omission fixed above; no further response-schema omissions were found in these audited consumers.
- Added persisted-response assertions: repository list, snapshot list, and same-snapshot drift in the analysis lifecycle E2E; single-analysis review-decision create/list; project list and domain-pack registry in workspace resolution; project-switch response and refreshed selected-project list.
- GREEN: `analysis-flow.e2e-spec.ts` plus `review-decision.e2e-spec.ts` passed 5/5; `workspace.e2e-spec.ts` plus `project-switching-membership.e2e-spec.ts` passed 9/9; `matrix-drilldown.e2e-spec.ts` passed 3/3. The first workspace attempt had one expected 401 because the new domain-pack test request omitted its required bearer token; correcting the request fixture produced the passing rerun. Existing multi-repo E2E covers create/detail/list and merged decision schemas; existing system-health E2E covers liveness/readiness/operations schemas.
- Focused controller regressions also passed: localization 5/5 and impact read-model 7/7. Backend typecheck passed; focused ESLint on all changed TypeScript files passed; final `git diff --check` passed with only existing LF/CRLF notices.
- Full API PostgreSQL/Redis E2E on the current dirty candidate passed 30/30 suites and 216/216 tests in 414.451 seconds after these controller and consumer assertions were added.
- Scope: this closes the named consumer rows' shared response-schema parity and adds representative persisted success payload checks. It does not prove every field's business meaning across all mapper paths, negative response states for every route, or the full route/API/UI/accessibility release gates. The authorized localization success journey and hosted exact-commit CI remain open.

### Localization CTA error and accessibility state (2026-10-30)

- Reachability RED: `AnalysisLocalizationTrigger` was imported only by `ReviewReportTab`, which has no app callsite. The actual reports route mounts `ReportViewer`; it had no action that could create the persisted localized artifact, so selecting a `locale` deep link could only attempt to read an artifact that users had no reachable way to generate. The new report-viewer regression failed because `localizationTitle` was absent.
- Reachability fix: mounted the CTA in the English `ReportViewer`, only when backend `canExport` is true and the authenticated global role is `ADMIN` or `REVIEWER` as required by the POST endpoint. Non-English and print views do not offer source-artifact generation. Status cache invalidation now uses `localizationKeys.status(...)` and is awaited after a successful mutation.
- API/DB RED: an authorized HTTP `POST /api/v1/analyses/:analysisId/localization` reached the response mapper after localization persistence, then returned HTTP 500. The shared schema rejected Prisma `Date` values for `createdAt` and `updatedAt`, although the API contract requires ISO timestamp strings.
- API/DB fix: `LocalizationController` now converts both persisted timestamps to ISO strings before parsing the result with `localizedReportArtifactSchema`; malformed non-Date values still fail the shared schema.
- Status/error fix: status errors render a distinct alert and Retry status action. If a refresh fails after prior data, the UI identifies the last known status as stale and retains that backend-derived state. The locale select has a visible label, the icon-only regenerate action has an accessible name, and View Report has link semantics. CTA strings use all three app dictionaries.
- GREEN: the component/API-client regression reproduces HTTP 503, retries, then verifies backend `NOT_TRANSLATED` and enabled Translate; report-viewer regressions verify reachability, selected `vi-VN` mutation, role gating, and backend capability gating. The controller regression was RED on `Date` inputs before conversion. The full `final-reviewed-report.audit-flow.e2e-spec.ts` passed 21/21 and exercises authorized API+PostgreSQL `vi-VN` generation, shared-schema response parsing, persisted artifact identity, status `READY`, and localized final-report retrieval with the same frozen snapshot. Full web Jest passed 45/45 suites and 198/198 tests; web/API typechecks and focused ESLint passed.
- Scope: this closes localization CTA reachability, status-fetch recovery, response timestamp serialization, and the authorized fake-provider API+PostgreSQL journey. It does not verify a real production translation provider or a browser-level screen-reader/keyboard pass for every route.

### Full Playwright matrix revalidation (2026-10-30)

- The first full browser run reported two failures: the desktop analysis-list
  test seed exceeded its 60-second child-process timeout, and the
  decision-to-report test timed out waiting for `/reports`. Its trace shows
  finalization returned HTTP 201 and the browser began the report navigation,
  but the `/reports` request was aborted while Next dev logged a full reload.
  The trace does not prove that the reload caused the abort. The report journey
  passed alone and then passed alongside the retry journey, so the first
  navigation timeout did not reproduce as an application failure.
- The Playwright seed helper now invokes `ts-node --transpile-only` for the
  test-only demo seed. The root typecheck remains the compile-time check; this
  avoids duplicate typechecking in a child process while Next/API/worker
  servers are already running.
- GREEN: focused retry and report browser tests passed together (2/2), and the
  full `pnpm test:pw` matrix passed 13/13 executed tests with one opt-in pinned
  repository trace test skipped. This includes desktop and mobile retry,
  finalize-to-report, keyboard and single-pane review, direct navigation for
  the inventoried routes, active navigation, invalid deep-link identity,
  responsive overflow checks, and automated accessibility checks. Root
  `pnpm typecheck` and focused ESLint for `e2e/fixtures/seed.ts` passed.
- Residual: the report navigation timeout and cold-seed timeout were observed
  once in the initial full run and did not recur in the full rerun; the local
  suite uses Next dev and emits hot-reload warnings. The pinned real-repository
  trace remains opt-in/skipped. This is local evidence on a dirty worktree,
  not hosted CI for an exact clean release commit; manual keyboard, focus
  return, and screen-reader checks remain open.
