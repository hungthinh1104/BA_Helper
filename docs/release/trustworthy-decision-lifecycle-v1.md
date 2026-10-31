# BA_Helper Trustworthy Decision Lifecycle v1

Status: **in progress; not a release certification**
Baseline inspected: `18471a9b8bbcb6a878a6415e35dc9e33ad19fd9d` on `codex/integration-product-integrity-v1`
Latest committed candidate: `0eab09fa3c1d01cad9f1a35cc22e9d3de55824bf` (`0eab09f`)
Evidence updated: 2026-10-29

This register tracks the lifecycle integrity objective from the user-provided
`goal-objective.md`. The broader route and consumer inventory remains in
[Product Integrity v1 inventory](product-integrity-v1-inventory.md).

## Integration Branch Evidence

At the cached local refs inspected on 2026-10-29, `codex/integration-product-integrity-v1`
at `0eab09f` contains both source branch tips: backend-runtime
`codex/fix-backend-runtime-ci-boundary` at `6899185` and scanner
`origin/fix/scan-source-omission-health-v1` at `9e63721` are ancestors of the
integration HEAD. Relative to `main`, the source branches touch 230 and 38
files, with 16 shared paths. The integration history includes merge commit
`1bd036b`; follow-up commits `a07b910` and `0eab09f` are on top. The current
worktree has an uncommitted E2E regression-test update and evidence-register
update.

`git fetch origin` could not refresh the remote refs because this environment
denies writes to `.git/FETCH_HEAD`. Therefore these ancestry checks certify the
cached refs only; remote movement since their last fetch remains unverified.

## System Invariant Checklist

| Invariant | Status | Evidence / remaining work |
| --- | --- | --- |
| PostgreSQL owns scan command identity through `(repositoryId, requestKey)`. | Verified for this path | Scan enqueue-recovery E2E asserts one persisted row after a failed enqueue and same-key replay. |
| A retry of the same payload can recover a persisted `QUEUED` scan command. | Verified for this path | Retry records the idempotent queued event and calls the deterministic BullMQ enqueue for the same scan ID. |
| A replay does not re-enqueue a `RUNNING` or terminal scan job. | Unit-covered | Existing-job unit case uses `RUNNING`; broader status matrix remains open. |
| Frontend retries preserve the failed command's request key and payload. | Partially verified | Scan and single-analysis dialogs reuse a key for an identical retry and change it when the user changes the command or explicitly reruns a failed analysis. Refresh/close recovery and multi-repo component coverage remain open. |
| Every PostgreSQL-to-Redis job type can recover from a partial failure. | Partially verified | Scan, impact-analysis and document commands recover through same-key replay or worker startup; multi-repo parent/fan-out queue failure still needs direct fault injection. |
| Recovery survives a client disappearing before retry. | Partially verified | PostgreSQL/Redis E2Es cover scan recovery after a Redis server restart (controlled BullMQ handler), impact-analysis recovery after its Redis client is killed, and document re-delivery after an enqueue failure while the periodic reconciler remains online. The real worker-process test verifies report completion after restart. Production scanner execution through outage and multi-repo fan-out recovery remain open; there is no transactional outbox. |
| Duplicate and concurrent command submission remains safe at every persistence/queue boundary. | Partially verified | Multi-repo concurrent create and event-log idempotency are verified; the full mutation and worker race matrix remains open. |
| A legacy multi-repo retry cannot silently switch to newer repository snapshots. | Verified for complete legacy runs | Missing plans are reconstructed from persisted child provenance and conditionally backfilled; incomplete legacy runs fail closed. |

## Critical Journey Coverage Matrix

| Journey / boundary | Current verification | Status |
| --- | --- | --- |
| Connect repository → create scan → PostgreSQL row → Redis queue → UI outcome | API E2E with real test PostgreSQL/Redis and injected first enqueue failure; UI component test with injected first request failure | Focused regression passes; refresh/close recovery and worker execution remain open |
| Requirement revision → impact analysis → worker → evidence and QA output | Existing product-integrity journey tests are inventoried in the linked register | Re-audit durability and fault recovery under this objective |
| Review decisions → finalization → immutable approved report | Existing concurrency/provenance tests and prior exact-CI browser journeys are recorded in the linked register | Reconfirm on the current release candidate |
| Requirement revision to single-repository analysis event/queue and UI outcome | API E2E with injected event persistence failure; component retry and FAILED-response cases | Focused command passes; multi-repo and worker execution remain open |
| Multi-repository analysis and report | API E2E covers duplicate create, same-key payload mismatch, concurrent create and stale snapshot-plan retry | Multi-repo approved-report journey and partial queue-failure recovery remain open |
| Settings and workspace access | Route smoke inventory only | Authorization and save-failure matrix remains open |

## Iteration 1: Scan Queue Delivery Recovery

### Invariant and reproduction

If scan creation commits a `QUEUED/WAITING` row and the Redis enqueue fails,
repeating the identical command must return the same scan ID and ensure the
corresponding deterministic BullMQ job exists, without duplicating the database
row or queued event.

Before the fix, the E2E injected one `QueueService.enqueueScanJob` failure after
the database insert. PostgreSQL retained the queued row and audit event. A
second request with the same repository, request key and ref returned the same
ID but did not call enqueue again; `scan-${scanJobId}` was absent from BullMQ.
The red test passed twice through the real API/DB/Redis setup and failed on that
missing queue job.

### Root cause and fix

`CreateScanJobUseCase` returned any matching existing row immediately, even if
its status was still `QUEUED`. It now replays the idempotent queued event and
enqueue for matching `QUEUED` rows. Other statuses still return without
enqueueing. BullMQ's deterministic ID preserves queue-side deduplication.

`ConnectRepoDialog` previously closed, cleared its inputs and navigated away on
queue failure. It now keeps the connected repository, locks the submitted URL
and ref, retains the request key while the dialog is open, and offers a
localized retry. It only navigates after the retry succeeds.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| API unit: `CreateScanJobUseCase` | 5/5 passed |
| API E2E: queue failure then same-key retry and separate worker-startup recovery, real test PostgreSQL/Redis | 2/2 passed; same-key retry regression was red when the old early-return behavior was temporarily restored, failing because the BullMQ job was absent |
| UI component: connect, transient queue failure, same-key retry | 1/1 passed after fix; failed before fix because the dialog closed |
| Root TypeScript check (`tsc --noEmit`) | Passed |
| Web TypeScript check | Passed |
| English, Vietnamese and Japanese message JSON parse; `git diff --check` | Passed |
| Changed-file ESLint | Not verified: local process produced no output and was stopped after 120 seconds |
| Full CI / Playwright on this worktree | Not run |

The last exact-commit full CI success predates this worktree change and does not
certify it. The earlier integration commit and Browser artifacts are recorded
in the Product Integrity inventory; rerun CI on the eventual candidate SHA.

## Iteration 2: Impact Analysis Event And Queue Recovery

### Invariant and reproduction

If the impact-analysis row commits but its `IMPACT_ANALYSIS_QUEUED` event
write fails, the same request key must recover the event and queue job for that
same analysis. A replay that returns an existing `FAILED` or `CANCELLED`
analysis must not be reported as a successful start; an explicit rerun uses a
new key.

The red API E2E injected a failure at the real PostgreSQL `domainEvent.upsert`
boundary after analysis creation. The first response was 500 and the analysis
row remained `QUEUED`. Before the fix, replay returned 201 with the same ID,
but the deterministic BullMQ job was absent. The frontend also always showed
success for a replayed analysis, including one already marked `FAILED`.

### Root cause and fix

`CreateImpactAnalysisUseCase` returned matching existing analyses before
replaying their queued event or queue delivery. Its concurrent-create recovery
branch also returned an existing row without re-ensuring delivery. Both paths
now use the same awaited delivery helper for `QUEUED` rows; enqueue failures
retain the existing transition to `FAILED`.

`NewAnalysisDialog` derives its request key from the submitted payload, so an
identical retry reuses the key and an edited payload gets a new key. A replayed
`FAILED`/`CANCELLED` response stays in the dialog with an error; the key is
cleared so the user's next explicit rerun creates a new command.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Impact-analysis use-case unit suite | 24/24 passed |
| Impact-analysis event persistence failure E2E, real test PostgreSQL/Redis | 1/1 passed after fix; failed before fix because BullMQ lacked the job |
| NewAnalysis dialog retry/status component suite | 3/3 passed; both new cases were red before their fixes |
| Root TypeScript check after backend changes | Passed |
| Web TypeScript check after UI changes | Passed |

This UI test uses mocked mutations. The separate API E2E uses real PostgreSQL
and Redis. A browser test that joins both at one user journey is still open.

Final focused rerun after both fixes: API unit 2 suites / 29 tests passed; API
E2E 2 suites / 2 tests passed; web component 2 suites / 4 tests passed. Root
and web TypeScript checks, locale JSON parsing and `git diff --check` passed.

## Iteration 3: Multi-Repo Concurrent Create

### Invariant and reproduction

Two identical multi-repo create requests that race on the same project and
`requestKey` must converge on one run and the same child analyses. Reusing the
key with a changed payload must still fail with `REQUEST_KEY_MISMATCH`.

The E2E held both requests after their initial run lookup, so each observed no
existing run. The first red response was `500` from Prisma `P2002` on the
run's `(projectId, requestKey)` uniqueness constraint. Repeated stress runs
then exposed a second race: one child could fail with `P2002` while both
requests inserted the same queued `DomainEvent` idempotency key.

### Root cause and fix

`CreateMultiRepoImpactAnalysesUseCase` did not recover a unique-key collision
when creating the parent run. It now reloads the winning run on `P2002` and
continues only when a stored SHA-256 fingerprint matches the submitted revision,
sorted repository set, partial-snapshot consent, and canonical explicit domain
pack selection. The fingerprint is nullable for old rows; those keep their
existing child-set/domain-pack compatibility check. The run also stores the
snapshot plan that won creation, so retry does not re-plan moving refs. Two
Prisma migrations add these fields, and the data model doc records their
semantics.

The migration-upgrade gate also had a hand-maintained list of migrations to
withhold until after legacy data seeding. The new migrations are now included
in that list, and the verifier checks that both upgraded columns exist and
remain nullable. The migration runner now resolves `pg` from the API package,
where it is declared, instead of relying on root-level dependency hoisting.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Multi-repo concurrency E2E, real PostgreSQL and Redis | 1/1 passed; prior implementation was red with one `500` |
| Full API E2E after integration fixes | 28 suites / 163 tests passed, including scan/runtime, report, recovery, and multi-repo lifecycle paths |
| Changed `allowPartialSnapshot` under the same key | API returns `409 REQUEST_KEY_MISMATCH` |
| Migration upgrade and data-survival gate | Passed on an isolated throwaway PostgreSQL database, including repeated deploy |
| Prisma client generation and test DB migration | Passed |

The concurrent-create and payload-mismatch E2Es pass with the persisted request
fingerprint. A full CI run on the eventual release-candidate commit remains
open.

## Iteration 4: Worker Startup Queue Reconciliation

### Invariant and reproduction

If PostgreSQL contains a `QUEUED` scan, impact-analysis, or document command
but Redis has no corresponding BullMQ job, the next worker startup must restore
delivery without relying on the browser to repeat the request. Re-enqueueing
must use the same deterministic queue job ID.

The scan and impact-analysis API E2Es already reproduce the partial commit:
each injects a first enqueue/event failure after the database row is durable,
then asserts Redis has no job. The added worker recovery unit was red before
the fix because `StaleJobRecoveryService` had no queued-job recovery method.

### Root cause and fix

Worker startup previously only changed stale `RUNNING` rows to `FAILED`.
It never inspected persisted `QUEUED` rows. `StaleJobRecoveryService` now scans
all three command tables in bounded keyset pages and uses `QueueService` to
re-enqueue each deterministic job. Duplicate startup passes are safe because
the queue IDs are stable. Queue errors leave the PostgreSQL command `QUEUED`
and fail startup so the deployment can retry recovery. The worker root now
provides the shared queue adapter and Prisma module to the recovery service.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Worker queued-job recovery unit | 5/5 passed; covers page continuation and all three job types |
| Scan enqueue failure, then worker bootstrap, real PostgreSQL/Redis | Passed; job exists before client replay |
| Impact event failure, then worker bootstrap, real PostgreSQL/Redis | Passed; job exists before client replay |
| Document enqueue failure, then worker bootstrap, real PostgreSQL/Redis | Passed; same document job recovers before client replay |
| API worker recovery E2E suites | 3/3 passed |
| Root TypeScript check | Passed |
| Changed-file ESLint | Passed with only the repository's Pages-directory configuration notice |

The API-to-database-to-Redis document export request and startup recovery are
now joined in the document E2E. A browser journey through that queue failure
remains open.

## Iteration 5: Freeze Multi-Repo Snapshot Plan

### Invariant and reproduction

A same-key retry of a partially completed multi-repo run must retain each
repository's originally selected snapshot. If a moving target advances before
retry, the system must report stale input instead of adding a newer snapshot to
the existing run.

The red E2E forced the first child to persist and the second child to fail
before creation, then advanced the second repository target. Before the fix,
retry returned `201` and created the missing child on the new snapshot, mixing
two source epochs in one run.

### Root cause and fix

The run stored repository IDs but not the source plan. Every retry selected the
latest observed snapshots again, so an incomplete fan-out could change its
inputs under the same key. New runs now persist repository, source-target,
snapshot, and display-name plan entries. Retries validate the command hash and
reuse that saved plan. If a saved moving-ref snapshot is no longer current, the
normal analysis guard returns `ANALYSIS_STALE`; the run remains unchanged and
the user must start a new command after choosing current inputs.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Partial fan-out with one durable child, then source target advances | 1/1 E2E passed; before fix it returned `201` and mixed the new snapshot |
| Same-key retry after target advance | API returns `409 ANALYSIS_STALE`; no child is created for the new snapshot |
| Prisma request-plan migration and test DB migration | Passed |

## Iteration 6: Concurrent Event-Log Idempotency

### Invariant and reproduction

Concurrent writes with the same `DomainEvent.idempotencyKey` must converge to
one immutable event, including when two identical multi-repo commands create
the same child analysis. The losing writer must not return a false API failure
or abort an enclosing transaction.

The multi-repo concurrency E2E passed intermittently, then failed during a
five-run stress attempt. Instrumentation localized the failure to concurrent
`domainEvent.upsert` calls: PostgreSQL returned `P2002` for the unique
idempotency key. The existing Prisma upsert therefore did not provide the
required concurrency behavior.

### Root cause and fix

`EventLogRepository.createEvent` used a read-or-insert `upsert`. Under this
concurrent insert race Prisma surfaced a unique violation instead of treating
the duplicate key as an idempotent no-op. The repository now uses PostgreSQL
`createMany` with `skipDuplicates: true`, which preserves the first event and
atomically ignores the competing insert. Transaction clients use the same
statement, so the loser does not need to query from a failed transaction.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Event repository unit test, changed from `upsert` to duplicate-safe insert | Red before implementation; passed after fix |
| Multi-repo concurrency E2E stress | 5 consecutive runs passed, 2/2 tests each |
| Scan, impact, document and multi-repo API E2E suites | 5 suites / 41 tests passed together |
| Focused backend and migration-workspace unit suites | 6 suites / 45 tests passed |
| Root and web TypeScript checks | Passed |
| Migration upgrade / legacy data-survival verifier | Passed on an isolated throwaway PostgreSQL database |

The stress E2E verifies API convergence with real PostgreSQL and Redis. A
broader event-write concurrency matrix across review and report transactions
is still open.

## Iteration 7: Recover Legacy Multi-Repo Snapshot Plans

### Invariant and reproduction

A retry of an older multi-repo run with no persisted `requestPlan` must use the
snapshot and source target identities already recorded by its child analyses.
It must never re-plan against a newly observed repository ref. A legacy run
without one unambiguous child per requested repository must fail closed.

The red PostgreSQL E2E created a legacy run with completed children, advanced
both repository targets, and added newer snapshots before replaying the same
request key. Before the fix, the API returned success and could resume against
the newer plan instead of detecting that the original child analyses were
stale.

### Root cause and fix

The retry path treated a missing plan like a first submission and called the
current repository planner. It now reconstructs complete plans from each
child's persisted snapshot, repository and source-target provenance. The
repository conditionally backfills the run's plan and request hash only while
the plan column is still database `NULL`. If any requested repository has no
unique child provenance, the use case returns
`MULTI_REPO_RUN_NOT_READY` without creating analyses. A complete moved-target
run continues through the existing staleness guard and returns
`ANALYSIS_STALE`.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Legacy complete-run retry E2E, real PostgreSQL | Red before fix (`201`); now returns `409 ANALYSIS_STALE`, preserves the two original children, creates no analyses for moved snapshots, and backfills plan/hash |
| Incomplete legacy plan unit case | Fails closed with `MULTI_REPO_RUN_NOT_READY`; no child analysis is created |
| Multi-repo idempotency E2E suite | 3/3 passed after fix |
| Multi-repo create use-case unit suite | 5/5 passed |
| Backend TypeScript check | Passed |

## Fault Injection And Concurrency Results

| Scenario | Expected result | Observed result |
| --- | --- | --- |
| First scan enqueue rejects after the row and event are persisted | API reports failure; same-key replay recovers the same queue job and creates no duplicate row/event | Verified by focused E2E; one row, one event and the deterministic BullMQ job remain |
| Impact queued-event persistence rejects after row creation | Same-key replay writes one event and enqueues the original analysis; no duplicate analysis | Verified by focused E2E; red before fix because replay returned the row without its job |
| Worker restarts after a durable scan or analysis row is committed without a Redis job | Startup recovery re-enqueues the original product ID once | Verified against real test PostgreSQL/Redis for scan and analysis |
| Worker restarts after document-job persistence but Redis enqueue fails | Startup recovery restores the same document job ID | Verified against real test PostgreSQL/Redis through the export endpoint |
| Frontend scan request rejects, then user retries in the still-open dialog | Same repository/ref/request key is submitted; no second repository is created | Verified by component test |
| Frontend analysis request rejects, then user retries unchanged payload | Same request key is submitted; `FAILED` response is shown as failure and an explicit rerun gets a new key | Verified by component tests; browser/API joined journey remains open |
| Concurrent multi-repo first submissions with the same request key | One run, same child analysis IDs, one event per idempotency key | Verified by PostgreSQL/Redis E2E, including five repeated runs; earlier failures were parent-run and event-log unique races |
| Partial multi-repo fan-out, then one repository target advances before retry | Original snapshot plan is preserved; the run cannot silently mix commits | Verified; API returns stale and retains only the original child |
| User closes or refreshes after queue failure | Command remains recoverable and UI accurately communicates its state | Not tested; request key is currently held in component memory |

## Other Required Evidence

- **Scanner evidence quality:** not re-evaluated in this lifecycle iteration.
  Use the analyzer quality and product-validation artifacts referenced by the
  Product Integrity inventory; rerun them on the release candidate.
- **API/UI/route contracts:** this iteration verifies scan and impact-analysis
  create responses through shared Zod schemas and verifies same-key UI retries
  for scan and single-analysis commands. Full mapper parity and route-state
  coverage remain open in the linked route and consumer inventories.
- **Browser and CI artifacts:** the last full Playwright run on the prior
  integration worktree had 8 passes, 2 `seedDemo()` failures from Prisma
  `P1017`, and 1 existing real-provider skip. A subsequent focused
  `decision-to-report` run failed while loading the report after the worker's
  Prisma connection closed, but the latest full run passed that journey and
  the responsive and route sweeps. The full run still had one keyboard-route
  failure from a PostgreSQL connection timeout and the Windows runner stalled
  during teardown.

Current local verification on this uncommitted worktree:

| Check | Result |
| --- | --- |
| CI Jest (`pnpm test:ci`) | 237 suites / 1,383 tests passed |
| Focused web regression tests | 5 suites / 25 tests passed |
| API E2E before latest test-only edit | 28 suites / 163 tests passed on candidate `0eab09f` |
| Latest scan enqueue-recovery E2E | 1 suite / 2 tests passed after test-only edit; red against temporary old early-return behavior |
| Golden path demos | Single-repository 1/1 and multi-repository 1/1 passed in their CI-equivalent isolated commands |
| Full root Jest (extra local aggregate) | Two runs each had one 5-second initialization-hook timeout: first in vector-gap benchmark, second in golden-path demo. The vector-gap test and golden-path demo each pass alone; the CI test command and isolated demo commands pass. |
| TypeScript: backend, web, scripts | Passed on this iteration's source |
| Workspace lint (`pnpm -r lint`) | Passed; 44 existing API warnings and 5 backend-runtime warnings, no errors |
| Migration upgrade / legacy data-survival verifier | Passed against isolated throwaway PostgreSQL DB |
| Focused Playwright report journey before the auth fix | 8/8 passed across two retry-free batches on default ports with test PostgreSQL and isolated Redis; no P1017 or pool timeout reproduced. The Windows server teardown still hung, so both runner exits were unclean. |
| NextAuth login bootstrap regression | Red before fix: two `/api/auth/session` requests raced with CSRF setup. Green after fix: 1/1 Playwright test, clean exit with prestarted servers; actual credentials login returned `authenticated` in report-journey setup. |
| Focused web tests and typecheck after auth fix | Login form: 2/2 passed; web `tsc --noEmit` passed. |
| Report journey after auth fix | Not certified: first run timed out at the default 15-second `qa-coverage` wait; trace recorded a 15.3-second route load. The waiter is now 60 seconds; follow-up runs were stopped without a result. |
| Full Playwright on this iteration | A prior run reported 9 passed / 1 failed / 1 skipped, with keyboard review failing on workspace API 500 during PostgreSQL pool timeout; report-only reruns do not certify the full route/responsive suite. |
| Full CI on exact release-candidate commit | Not run; the current changes are uncommitted |

## Browser And Runtime Gate Results

The full Playwright run used the supported route and responsive projects on
standard ports, test PostgreSQL, and Redis DB 2 to avoid old local queue
artifacts. Results: 8 passed, 2 failed, 1 skipped. Passing checks include the
18-route direct-navigation sweep, active navigation, 90 responsive
route/theme/viewport combinations with accessibility scans, mobile review,
keyboard review, static Visual Test Trace, API reference rendering, and
malformed-auth-header recovery. Both failures occurred before browser
assertions: `decision-to-report` failed while `seed.demo.ts` upserted the demo
user, and the code-comprehension identity-mismatch route test failed while the
same seed created code artifacts. Both were Prisma `P1017` connection-closed
errors from separate seed subprocesses. The PostgreSQL postmaster remained up
since 2026-10-21, `max_connections` was 100, and an 80-second sample during a
focused test observed at most five test-database connections. This rules out a
server restart or observed connection-count saturation in that sample; the
connection close itself remains unexplained and needs a deterministic
reproduction with database-side logs.

The configured worker startup did succeed with the correct test database and
isolated Redis DB. The previously recorded worker startup `P2028` did not recur
in that run. A first attempt using the shared Redis DB failed with a PostgreSQL
pool timeout; changing only the test Redis DB allowed all three servers to
start. In the latest report journey, `/final-reviewed-report` first returned
`DOCUMENT_JOB_NOT_READY` with status `RUNNING`, then returned status `FAILED`;
the persisted worker error was `PrismaClientKnownRequestError: Server has
closed the connection` during `impactAnalysis.findUnique()`. The later worker
`DOCUMENT_JOB_NOT_READY` log was a duplicate delivery after the product job had
already failed. Container/database logs could not be inspected because Docker's
local engine socket is inaccessible in this sandbox. Keep the full
browser/release gate open until the connection close is deterministically
explained and the report journey passes on one candidate commit.

The subsequent full Playwright run passed the review-to-report journey,
responsive sweep (90 route/theme/viewport combinations), all three route-smoke
cases, mobile review, Visual Test Trace and API documentation checks. The one
failure was keyboard-only review: the workspace API returned HTTP 500
`Internal server error`, then the next request failed to connect. The API log
showed `pg-pool` `timeout exceeded when trying to connect`. The configured
readiness endpoint returned 200 in the same trace. Playwright printed all 11
case outcomes (9 passed, 1 failed, 1 skipped), then hung during Windows server
teardown and was stopped; treat the test failure as real and the runner exit as
unclean.

A later rerun on candidate `0eab09f` used isolated Redis DB 2 and `CI=1`. The
report journey failed once while `seed.demo.ts` created a code artifact
(`P1017 Server has closed the connection`), then passed on Playwright retry
number 1. The isolated report journey also passed once. Both runs hung during
Windows Playwright server teardown and required Ctrl+C, so neither provides a
clean full-suite exit. Treat report generation as flaky and keep the browser
release gate open until the DB connection close is explained and the full run
exits cleanly.

On 2026-10-29, the report journey was then repeated on the default 3000/3001
ports with one worker, retries disabled, test PostgreSQL and isolated Redis DB
6. Both batches printed all test outcomes as passing: 3/3 and 5/5. A read-only
PostgreSQL sampler observed at most 16 idle sessions (including a long-lived
diagnostic `psql` session) and no sustained active/waiting query; the container
logs showed ordinary checkpoints and no connection-close error. This did not
reproduce or explain the earlier `P1017`. The Windows Playwright server
teardown hung after the five passing outcomes and the runner was stopped with
Ctrl+C, so this is focused journey evidence, not a clean full-suite pass.

Custom-port diagnostic runs were excluded from the 8/8 count. They had manual
NextAuth/CORS/API URL wiring; one redirected to `?csrf=true`, one QA coverage
request remained pending, and one report journey passed. They are not evidence
of PostgreSQL failure.

On 2026-10-29, the default-port login flow was isolated with a new Playwright
route regression. Before the fix, `/login` issued two concurrent
`GET /api/auth/session` requests. NextAuth 4.24.15 creates a CSRF cookie when a
request has no valid cookie; the requests could therefore overwrite each
other's token before `signIn` posted its token. The regression failed with two
captured requests. The fix moved `SessionProvider` under the `(app)` route group
and made the public login form call a standalone credentials helper, so `/login`
does not bootstrap a session. The same test passed 1/1 with a clean runner exit
when attaching to prestarted API, worker, and web servers.

The credentials callback then returned successfully in a real report-journey
setup. The first post-fix journey did not reach `qa-coverage` within the test's
default 15-second response wait; the trace recorded 15.3 seconds for the
analysis route load, showed `Initializing workspace…`, and ended with an
unresolved session request as the test was aborted. The response wait is now 60
seconds, preserving the same API and payload assertions. The demo seed's
synchronous child process now has a 60-second cap so a DB stall cannot hold the
Playwright worker indefinitely. Follow-up runs were manually stopped before a
test result, so neither change has a clean report-journey verification yet. In
an instrumented run, the demo seed and direct-PostgreSQL test-trace fixture
connected and committed successfully; no `P1017` or `P2028` appeared in those
steps. The end-to-end review/finalize/report gate remains open until the app
route initializes and the report journey exits cleanly after this auth change.

## Limitations And Residual Risks

1. UI request keys are still held in component memory. Worker startup and
   periodic reconciliation recover durable `QUEUED` rows. Scan, impact-analysis
   and document recovery paths have PostgreSQL/Redis E2E coverage, but scan
   outage recovery uses a controlled BullMQ handler rather than the production
   scanner. The user-visible command state after close/refresh remains
   untested.
2. Multi-repo concurrent first-create and moving-target partial fan-out are
   covered. Partial fan-out retry with an unchanged target and injected child
   queue failure still need direct fault injection.
3. An impact queue outage transitions the analysis to `FAILED`; the UI handles
   an idempotent failed response and enables an explicit new-key rerun, but the
   full API-to-browser failure/retry path has not been exercised.
4. There is no transactional outbox. The worker periodically retries durable
   queued rows after Redis inspection or enqueue failures. Current tests do not
   cover multi-repo parent/fan-out queue failure or real scanner execution
   through a Redis server restart.
5. PostgreSQL pool connection timeouts remain intermittent in browser runs,
   and standard Windows Playwright server teardown remains unclean. The latest
   full run's report journey passed, but the keyboard route failed on a 500
   workspace response. Full CI on the committed candidate and broader release
   gates remain open as documented in the linked inventory.

## Iteration 8: Reviewed Report Retry And UI State

### Invariant and reproduction

After finalization, the report page must show the backend job state until the
approved report is available. A transient worker failure must remain retryable
through BullMQ, and a terminal failure must be distinguishable in the UI with
a retry action only when the backend reports that retry is allowed.

The browser journey showed the report viewer returned a generic unavailable
error while generation was pending. Its report query did not poll. Review
decision rows also appeared accepted before the server workspace summary and
`canFinalize` capability had refreshed. Separately, `QueueService` re-added a
failed document job using the same retained BullMQ ID; BullMQ deduplicates that
ID, so the explicit retry endpoint could leave the job in its failed queue
state.

### Root cause and fix

The review mutation optimistically changed server-authoritative queue data.
The optimistic patch was removed; settlement now waits for affected review,
workspace, report and list queries to refresh, and the completion banner stays
hidden while a decision is pending.

The report hook now polls only while the backend says the job is `QUEUED` or
`RUNNING`. The viewer waits for the snapshot-backed report before requesting
approved-document metadata. Worker attempts are passed into the document job
use case; retryable non-final failures preserve product status `RUNNING`, and
terminal/final failures set `FAILED`. When an explicit retry finds BullMQ's
retained job in `failed`, queue delivery calls `job.retry('failed')` instead of
adding a duplicate deterministic ID. The viewer distinguishes terminal report
failure and exposes retry only when `canRetryReportGeneration` is true.

### Regression and verification evidence

| Check | Result |
| --- | --- |
| Review mutation cache regression | Red before fix; verifies review state and `canFinalize` remain server-authoritative until the response settles |
| Report query pending poll | Red before fix; now observes the report become available after a `RUNNING` response |
| Document worker lifecycle | Adapter regression was red before fix; retryable first attempt remains `RUNNING`, final/unrecoverable failures become `FAILED` |
| BullMQ document retry | Queue regression was red before fix; failed retained job uses `retry('failed')`, new jobs still use the deterministic ID, concurrent delivery remains idempotent |
| Report viewer failure/retry capability | Pending, failed, authorized retry, and no-retry capability component cases pass |
| Focused web suite | 5 suites / 25 tests passed |
| CI Jest (`pnpm test:ci`) | 237 suites / 1,383 tests passed |
| API E2E (`pnpm test:e2e`) | 28 suites / 163 tests passed |
| TypeScript: backend, web, scripts | Passed |
| Workspace lint (`pnpm -r lint`) | Passed; 44 API and 5 backend-runtime type-import warnings, no errors |
| Browser report journey | Candidate repeats before auth fix passed 8/8 without retry; after fix, one new run timed out at workspace initialization and a repeated run was stopped without a result. Earlier `P1017` remains unexplained. |

## Next Highest-Priority Iteration

Resolve the post-login workspace initialization stall with a focused trace of
`/api/auth/session` and `workspace/current`, then run the report journey to a
clean exit. If the PostgreSQL close recurs, capture the exact request and
per-process pool state; the recent seed/fixture checks did not reproduce it.
Keep the remaining authorization, accessibility-manual, mapper-parity,
multi-repo fan-out and refresh-recovery gates open until each has direct
evidence.
