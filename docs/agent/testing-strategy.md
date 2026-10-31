# Testing Strategy

## Approach

The account lifecycle E2E has a scoped 30-second budget for its sequential
real scrypt operations, HTTP requests and audit writes. Keep the complete
provision/reset/disable/session-revocation assertions when verifying this path.

Use-case-first development is mandatory for the analysis engine:

```text
acceptance criteria
-> fixture repository
-> expected artifacts/edges/insights
-> automated tests
-> implementation
```

Backend Jest entry points share `jest.transforms.cjs`. The patched
sanitize-html parser and its five ESM dependency packages are transformed to
CommonJS for Node 22 test compatibility; unrelated dependencies remain ignored.
Scalar's small HTML serializer and JSON helpers use the same bounded transform
policy. Its browser/Vue package is served as a static asset, not imported.
Keep the same policy in local, CI, unit, integration, analyzer and API E2E
configurations. The configuration helper is CommonJS so native Node
and Jest's TypeScript config loader resolve it consistently.

Jest mocks for asynchronous repository calls must declare a function returning
a Promise; `jest.fn<any>()` does not reliably model async returns under current
TypeScript/Jest types. UI tests use jest-dom 7 with its explicit DOM peer and
the same Node 22 baseline as application verification.

Do not validate quality by reading generated prose and deciding that it looks
reasonable.

The production-path fake-provider scorecard measures curated fixture behavior.
Keep its precision and recall thresholds, and reject a positive case that emits
no committed claims; empty-set precision must not make a broken case pass.
Measure independent repository accuracy separately against source-authored
ground truth, without changing expectations to match analyzer output.

Run `pnpm verify:application-test-trace` for pinned Amplication/Novu application
source slices. All frozen labels must be found; its regression policy now
permits zero misses or false positives and rejects changed ground-truth
digests or expected universes. Verify parameterized metadata through parsing,
persistence, QA, saved reports and UI, preserving the distinction between a
source callback and generated runtime cases. A passing corpus is not general
accuracy certification. See [application trace evaluation](../evaluation/application-test-trace.md).

Test files should remain readable by behavior. Keep expected artifact, edge,
and insight payloads in dedicated fixture data instead of embedding large
outputs into one spec. See [code-organization.md](code-organization.md).
Scanner and graph implementation work must also follow
[analyzer-rules.md](analyzer-rules.md).

## Input Gate Tests

Before scanner/impact behavior, test that unsuitable input cannot become a
confident analysis:

```text
valid canonical public GitHub HTTPS URL is accepted and normalized
URL with non-GitHub host, embedded token, local path, or syntactically unsafe ref is rejected before scan creation
unsupported Express/non-NestJS repository fails with UNSUPPORTED_FRAMEWORK
supported NestJS repository with no relevant booking symbol can scan READY and later yields UNKNOWN impact
branch/ref is persisted separately from canonical repository identity
two refs resolving to one commit reuse extraction without losing separate RepositoryTarget freshness context
syntactically safe but remotely ambiguous branch/tag ref fails its queued scan instead of silently selecting a target
explicit commit-SHA scan is not made stale merely because a branch advances
failed scan execution does not publish or reserve an immutable snapshot identity
successful retry after failed scan may publish the same commit/analyzerVersion snapshot
moving-ref output becomes stale after a later safe source-resolution observation records a newer commit, even if extraction then fails
change request fixture text becomes READY_FOR_ANALYSIS
"fix it" becomes NEEDS_CLARIFICATION and cannot create analysis
requirement text containing a likely secret is rejected before revision persistence
same requirement-create requestKey and payload, including concurrent retries, return one requirement/revision; key reuse with a changed payload returns REQUEST_KEY_MISMATCH
stored DRAFT revision can be qualified without mutating its title/raw text
edited requirement title/text that qualifies READY archives the superseded ready revision for new analyses, while a DRAFT/NEEDS_CLARIFICATION replacement does not; old analysis still references old title/text
cross-project requirement revision and snapshot are rejected
source target whose latest observed commit differs from selected snapshot is rejected for new analysis
```

## First Fixture

Create a fixture such as:

```text
tests/fixtures/nestjs-booking-with-payment/
  src/booking/booking.controller.ts
  src/booking/booking.service.ts
  src/booking/booking.entity.ts
  src/booking/booking-cancel.spec.ts
  src/payment/payment.service.ts
  src/payment/payment.entity.ts
  src/slot/slot.service.ts
  src/notification/notification.service.ts
  src/admin/refund-report.service.ts
  prisma/schema.prisma
```

Change request:

```text
Allow users to cancel paid bookings and receive refund.
```

The admin refund report service is deliberate keyword noise. It discusses
refund reporting but is not connected to booking cancellation.

## Expected Fixture Output Matrix

The fixture code and expected certainty must agree:

| Claim | Expected certainty | Fixture evidence required |
| --- | --- | --- |
| Cancel API route exists | EVIDENCED | `@Post(':id/cancel')` on controller method |
| Cancellation calls booking service | EVIDENCED | controller call to `cancelBooking()` |
| Cancellation requests refund | EVIDENCED | direct `PaymentService.refund()` call in cancellation flow |
| Cancellation releases slot | EVIDENCED | direct `SlotService.releaseSlot()` call in cancellation flow |
| Cancellation notifies owner | EVIDENCED | direct `NotificationService.notifyOwner()` call in cancellation flow |
| Booking reaches `CANCELLED` status | EVIDENCED | assignment/transition in cancellation flow |
| Payment reaches `REFUNDED` status | EVIDENCED | fixture directly writes/returns the transition in refund flow; enum presence alone is insufficient |
| Refund percentage | UNKNOWN | intentionally absent |
| Refund deadline | UNKNOWN | intentionally absent |
| Who may cancel | UNKNOWN | intentionally absent beyond the route caller |
| Owner approval required | UNKNOWN | intentionally absent |

Expected unknowns include:

```text
refund percentage
refund deadline
who may cancel
whether owner approval is required
whether the slot reopens immediately
```

Because the fixture directly calls `releaseSlot()`, the system may evidence
that a release operation occurs. It must still keep the business policy
"whether/when the released slot becomes bookable again" as `UNKNOWN` unless
the fixture explicitly encodes that behavior.

## Required Test Layers

### Local execution note

Root unit/integration tests and e2e tests share local Postgres/Redis resources.
Run them sequentially unless isolated DB names and Redis namespaces are
configured. The same rule applies to `pnpm demo:golden-path` and
`pnpm demo:multi-repo-golden-path`. These paths reset and seed test data, so
concurrent execution can create false failures from duplicate fixed fixture IDs
or missing shared rows. Run them as separate commands when validating a release
or phase handoff:

```bash
pnpm test
pnpm demo:golden-path
pnpm demo:multi-repo-golden-path
```

For a local release-candidate pass with Docker available, prefer the sequential
wrapper. It starts Postgres/Redis, applies migrations, then runs the checks:

```bash
pnpm verify:stability
```

`pnpm typecheck` checks backend/test sources, browser E2E sources and the full
web TypeScript project, including its tests. It builds the contracts/shared
declarations before checking the web consumer. Do not substitute a production-
source-only web config for this gate. `pnpm test:web` runs the web Jest suite;
the backend Jest match does not include `.test.tsx` files. CI and the stability
wrapper run this suite and the desktop/mobile Playwright journeys explicitly.
Install Chromium first with `pnpm exec playwright install chromium` (CI also
installs OS dependencies).
Web builds and Playwright server commands use the existing `dotenv -v` option
for environment assignments so the same commands work on Windows and Linux.
For local database/browser checks, copy `.env.test.example` to `.env.test` and
configure the running PostgreSQL/pgvector and Redis instances. Playwright reads
the test URLs and passes the same database/queue configuration to its API,
migration, seed and browser-fixture processes. CI does not reuse existing web
or API servers. Database setup does not install PostgreSQL or Redis for you.
Set `DATABASE_URL_TEST` explicitly to a dedicated test database. The API E2E
preparation helper does not fall back to `DATABASE_URL`, because E2E reset
helpers truncate application tables before each test.
Set `REDIS_URL_TEST` to a dedicated test database or Redis instance; the API
E2E preparation helper fails before database setup if it is missing or points
at the configured development Redis database. The example uses logical DB 1,
leaving the default development DB 0 isolated.

Database E2E preparation must run `prisma migrate deploy`, never `db push` or
`--accept-data-loss`. It invokes the Prisma CLI through Node so Windows does
not require a shell to launch a pnpm shim. `verify:migration-upgrade` applies
the legacy chain before the email/index and three test-trace migrations, seeds
legacy artifacts, a dependency and an approved report, then verifies content
identity, nullable new fields, unchanged Markdown and confidence constraints.
These checks require a real PostgreSQL instance with pgvector; mocked helper
tests only verify command selection and one-time preparation.
The upgrade gate works on a scratch migration copy and a uniquely named
throwaway database. It never moves repository migration folders, verifies a
second deploy is idempotent and validates cleanup targets before deleting them.

### Scanner fixture tests

Canonical-path regression fixtures exercise root/file aliases (including a
Windows directory junction), stable artifact keys and graph edges, and confirm
that canonicalization does not expand the accepted source selection.
Test-only local acquisition accepts native absolute paths and decodes file URLs
with Node's URL parser, including spaces. Framework regression fixtures use
that directory-copy path; Git initialization is unnecessary and must not add
process overhead to their setup. Real remote acquisition remains separate.

Verify routes, controller/service methods, entities/models, tests, line ranges,
commit/analyzer-version identity, coverage, and skipped files.

Verify scan processing failures live on `ScanJob` only; the scanner does not
publish a `FAILED` or `SCANNING` snapshot record that blocks a later successful
retry for the same identity.

Verify a completed scan response provides the `sourceTargetId` and
`snapshotId` needed for impact analysis, while a post-resolution extraction
failure may expose only target observation and no usable snapshot.

### Graph tests

The production graph gate must exercise the real NestJS adapter and file
enumeration, not a mock returning pre-authored dependency edges. Negative cases
cover import-only tests, unrelated receivers with the same method name,
unresolved methods, scoped/aliased instances, and excluded source files.
Repeated relationships preserve bounded source-location samples.

Jest extraction tests must distinguish file containers and real cases, nested
suites, aliases and effective/declared modifiers. Verify identity stability
after line shifts and body changes, changed hashes after modifier changes,
duplicate/dynamic/malformed declaration diagnostics, secret redaction, and
case-local call ownership even when two cases occupy one line. Setup, skipped
and todo references must not create TESTS edges. The booking expected artifacts
and edge source explicitly identify its cancellation case. Persistence and
API mapper tests validate metadata without exposing transient AST offsets or
internal JSON. The DB pipeline test also checks parent identity and graph
metadata projection.

Behavior extraction tests must verify that active Jest cases retain setup,
input, action, mock, assertion and outcome declarations with exact source
offsets and commit context. Add negative cases for nested callbacks, dynamic
matchers, snapshots and absent commit context. Keep static claims distinct from
runtime execution and coverage. The synthetic static-test benchmark checks a
fixed behavior-claim count/digest and enforces broad scan and median graph-time
budgets.

### Static Test Trace Projection Tests

Keep a separate gate for the persisted code-to-test projection. It must cover:

- More than 50 impacted artifacts and paths through non-impacted intermediates.
- Direct references, multi-step call paths, shortest-path preference,
  deterministic ordering, cycles and the four-call depth limit.
- Active vs skipped/todo cases and legacy file-level test identities.
- Missing/malformed evidence, cross-snapshot endpoints/edges/evidence,
  mismatched source types, paths and line ranges; validate support for every
  CALLS step, not just the initial TESTS edge.
- Impact/edge overflow and bounded case samples with explicit limitations.
- Partial snapshots and scanner/legacy limitations without claiming runtime
  execution or assertion coverage.
- API permission checks, additive wire compatibility and connected semantic
  trace validation; review queue uses the same projection.

`tests/analyzer/qa-test-trace.fixture-spec.ts` exercises the real NestJS adapter
and persistence mappers against the separately authored booking expectation
`expected/qa-test-traces.json`. The cancellation case directly references
`cancelBooking`; `refund`, slot release and notification have static call
paths. The controller and entity do not inherit test relationships. Mocked
dependencies in this fixture make the non-runtime limitation deliberate.

The production DB pipeline test also reads this projection using real Prisma
repositories and checks commit identity, direct/indirect paths and evidence.
An in-memory mapper fixture does not substitute for that DB gate.

### Visual Trace And Report Freeze Tests

Component tests cover selected-artifact rendering independent of the display
graph, case identity, opening source evidence, loading/error/retry states,
snapshot mismatches, uninspected artifacts, limitation messages and saved
read-only report paths. A source dialog must suppress review decision
shortcuts. Run the existing web Jest suite from the workspace root:

```bash
pnpm test:web
```

The desktop Playwright journey adds an explicitly synthetic persisted trace
to the demo analysis, opens its real evidence endpoint and checks the numbered
source highlight. It then reviews/finalizes through the UI, reloads the report
after removing the live fixture edge and verifies the saved trace remains.
This browser fixture does not establish scanner accuracy; the separate
production-graph DB E2E covers extraction and persistence. Demo reseeding must
delete dependency edges before artifacts and generated documents before their
analyses, so a failed browser attempt or a real completed report can be reseeded.
For an opt-in proof against an external repository, use a clean checkout of
`leosuncin/nest-api-example` at commit
`b49ae92a6c0b0db39b6542338a2ffea3eda15717` under
`tmp/corpora/nest-api-example` (or set `PINNED_CORPUS_PATH`). Do not install
its dependencies or execute its code. With Postgres/Redis running and
`.env.test` configured, migrate only the `ba_helper_test` database,
then run `pnpm prove:pinned-comprehension` and
`pnpm verify:pinned-comprehension-browser`.
On PowerShell, the preparation commands are:

```powershell
git clone https://github.com/leosuncin/nest-api-example tmp/corpora/nest-api-example
git -C tmp/corpora/nest-api-example checkout b49ae92a6c0b0db39b6542338a2ffea3eda15717
$testUrlLine = Get-Content .env.test | Where-Object { $_ -match '^DATABASE_URL_TEST=' } | Select-Object -First 1
$env:DATABASE_URL = ($testUrlLine -split '=', 2)[1].Trim('"', "'")
$testDatabase = [uri]$env:DATABASE_URL
if ($testDatabase.AbsolutePath -ne '/ba_helper_test' -or $testDatabase.DnsSafeHost -notin @('localhost', '127.0.0.1', '::1')) { throw 'Expected local ba_helper_test' }
pnpm --dir apps/api exec prisma migrate deploy --config prisma.config.ts --schema prisma/schema.prisma
pnpm --dir apps/api exec tsx prisma/seed.demo.ts
pnpm prove:pinned-comprehension
pnpm verify:pinned-comprehension-browser
```

The proof command refuses a dirty or wrong-commit checkout and any database
other than `ba_helper_test` on a loopback host (`localhost`, `127.0.0.1`, or
`::1`). Remote database hosts are rejected to keep proof data out of unrelated
databases. It writes an ignored
`artifacts/evaluation/pinned-code-comprehension-proof.json` with snapshot IDs,
source-backed projection counts, path-shape counts, and local timing/hardware.
Seed the demo login before running the proof. The browser command starts and
stops the API and web servers, runs five required real-browser samples, and
fails if assertions, process exit, or server cleanup do not pass. It measures fresh-process
projection, initialized-pool cache misses, and projection cache hits separately,
then records five samples for multi-scenario, indirect, most-related, unresolved,
and no-test methods. The required browser command fails if the proof or its
measurement groups are absent; ordinary Playwright runs may still skip this
optional corpus test. It appends API and browser verification, response sizes,
and five timing samples to the artifact. Run it after database-resetting
E2E suites; a reset invalidates the saved snapshot.
The proof independently matches displayed source evidence and graph edges to
persisted snapshot rows, artifact ownership, canonical repository paths, and
existing source line ranges. Its unresolved workload must retain the scenario
diagnostic `ASSERTION_INVOCATION_UNRESOLVED` in every sample.
These samples verify one pinned workflow and are not a general accuracy or
production latency estimate.
Playwright starts the actual document worker and waits for its structured
`WORKER_READY` startup event. Finalization captures the reviewed snapshot and
enqueues report rendering; it does not synchronously generate the document.
Browser jobs default to Redis database 1 on the configured test Redis server;
`PW_REDIS_URL` can override the complete URL. This keeps browser workers away
from development/integration queues. Both the main
report route and the separate snapshot viewer must render frozen trace data.
Browser backend processes use ts-node transpilation without repeating the
type checker at each API/worker boot. The separate full backend/web typecheck
gate remains mandatory before browser CI. CI and local Jest configurations
resolve both workspace root exports and capability subpaths to source.

Backend tests cover analysis permission enforcement before source reads,
evidence membership in a returned path, immutable source locator checks,
versioned snapshot serialization, rejection filtering and detached capture.
The worker context and report renderer must preserve saved paths even when
live relation readers are empty, reject foreign snapshot identity, leave
historical null snapshots unchanged and escape source-authored Markdown text.
The DB pipeline gate also persists and reads the new JSON field and reads path
evidence through the real repository. Its lifecycle is seeded finalized for
that capture check; finalization policy remains covered separately.

`tests/analyzer/production-graph.e2e-spec.ts` drives `RunScanJobUseCase` through
the runtime adapter and real repositories with only source acquisition and
embedding enqueue replaced. It asserts persisted CALLS/TESTS, source evidence
provenance, the API graph read model, retry deduplication, and historical
snapshot preservation. Run it against the isolated test PostgreSQL database:

```bash
pnpm exec jest --config jest.e2e.config.ts --runInBand tests/analyzer/production-graph.e2e-spec.ts
```

Verify at minimum:

```text
BookingController.cancel -> BookingService.cancelBooking
BookingService.cancelBooking -> PaymentService.refund
BookingService.cancelBooking -> SlotService.releaseSlot
BookingService.cancelBooking -> NotificationService.notifyOwner
```

### Retrieval tests

Given the change request, verify relevant cancellation/refund evidence is
selected and unrelated fixture noise is not over-selected.

Retrieval pass/fail for the first fixture:

```text
MUST retrieve:
- BookingController.cancel()
- BookingService.cancelBooking()
- PaymentService.refund()

MAY retrieve when graph expansion is enabled:
- SlotService.releaseSlot()
- NotificationService.notifyOwner()
- Booking / PaymentTransaction entities
- booking-cancel.spec.ts

MUST NOT classify as affected solely from keyword similarity:
- AdminRefundReportService
```

### Impact/invariant tests

Start with a fake LLM provider. Verify:

```text
Missing refund percentage cannot become an EVIDENCED claim.
Unknown refund policy is generated when not present in evidence.
EVIDENCED facts contain direct Evidence relations.
INFERRED insights contain contextual Evidence relations and reasoning.
UNKNOWN insights contain a reason and retrieval scope.
CONFLICTING insights require opposing evidence records.
UNKNOWN behavior does not create a fake TraceabilityLink.
Evidence origin is compatible with snapshot or requirement revision used by analysis.
Persisted evidence excerpts redact detected secrets while retaining provenance metadata.
Generated output is tied to the snapshot commitSha.
LLM evidence references not present in the retrieved evidence bundle are rejected.
Acceptance criteria and QA scenarios label unsupported policy assumptions rather than presenting them as evidenced current behavior.
Affected artifact conclusions expose EVIDENCED/INFERRED basis; retrieval candidates alone are not reported as affected.
API output validates against the shared Zod response contract rather than exposing persistence shape.
```

### State and persistence tests

Verify:

```text
invalid lifecycle transitions fail
WAITING_FOR_REVIEW analysis cannot be cancelled after draft output exists
analysis accepts published READY/PARTIAL snapshots only
analysis on PARTIAL snapshot requires explicit acknowledgement and warning
retry does not duplicate artifacts, edges, links, or evidence joins
retry does not duplicate evidences, insights, draft documents, or retry-scoped events
same scan requestKey cannot create duplicate scan executions
same impact-analysis requestKey cannot create duplicate analysis executions
same requestKey with changed command payload is rejected
repeated review command with the same requestKey does not append an event or reapply after a later decision
reusing a review requestKey with a changed action, rationale, target, or actor returns REQUEST_KEY_MISMATCH
new no-op review commands record one command receipt; replaying that requestKey does not add another receipt
accept -> reject -> accept keeps three audit events for both insight and impact review items
concurrent identical review commands serialize and persist one mutation/event
frontend review retries retain their requestKey until success and rotate it for a later command
later safe moving-ref resolution projects older completed output as isStale=true even when extraction fails
same commit with a different analyzerVersion does not mutate old extracted evidence
same commit reached from different targets does not overwrite target provenance
stale WAITING_FOR_REVIEW analysis cannot be reviewed or finalized as current output
concurrent target observation update racing review/finalization causes the stale mutation to reject or fail its conditional commit
review-note upsert or clear racing finalization waits on the PostgreSQL `ImpactAnalysis` row lock; a late mutation fails after finalization commits and cannot alter the frozen review snapshot
rerun creates a new ImpactAnalysis instead of overwriting history
processor completion is not acknowledged before required state/event writes complete
```

Idempotency tests must include an artifact with nullable symbol/line metadata
to prove duplicate prevention uses `artifactKey`, not nullable composite fields.

### Review tests

Verify confirmed/rejected decisions are persisted with audit events. Verify
explicit finalization is required for `COMPLETED`, creates approved projections,
excludes rejected insights from approved conclusions, and retains unreviewed
statements only as labeled items. Verify repeated finalization does not create
duplicate approved projections. When unreviewed insights remain, finalization
without `acknowledgeUnreviewed=true` is rejected and finalization with explicit
acknowledgement succeeds without promoting those items to approved facts.

Report response tests must verify an existing analysis displays the immutable
revision title/text used at creation, even after a newer requirement revision
changes its title or raw text.

### Error and logging tests

Where a failure path is introduced, verify:

```text
typed domain/application error maps to the expected stable API/job error code
unsafe raw code, secret values, and unredacted provider payloads are absent from logs/errors
repository detail surfaces the resulting blocker/partial diagnostics and stable scan error code
```

### Prompt injection handling test

Place instruction-like text in a fixture comment or README and verify it is
treated as source data, not an instruction to the LLM provider/pipeline.

### Negative and conflict fixtures

After the primary slice passes, add minimal variants to prove failure behavior:

```text
No refund artifact exists:
  Requirement mentions refund, but analysis returns UNKNOWN rather than a fake
  affected PaymentService.

No matching booking/cancellation artifact exists:
  Snapshot remains READY when scanning succeeded; impact output reports UNKNOWN
  rather than treating the scan as failed.

Unconnected refund artifact exists:
  Refund-like symbol with no dependency path is a candidate/inference at most,
  not an EVIDENCED impact.

Conflicting cancellation rules exist:
  Opposing evidence produces a CONFLICTING insight with both evidence links.
```

### Hostile-input E2E coverage

When secure public-repository ingestion changes, add API/app-level hostile-input
coverage for at least:

```text
non-canonical GitHub URL rejected before repository creation
unsafe repository ref rejected before scan queueing
limit-triggered scan publishes PARTIAL diagnostics visible in repository detail
unsupported framework or blocked scan exposes stable FAILED error code and blocker diagnostics
```

### Opt-in runtime trace import

`packages/analyzer/tests/runtime/jest-runtime-trace.fixture-spec.ts` joins a
local result shape to the real booking behavior fixture's scanned artifact.
`packages/analyzer/tests/runtime/jest-runtime-trace.spec.ts` verifies separate
runtime evidence, exact snapshot/path/source-line correlation, parallel result
ordering, missing and ambiguous locations, outside-root paths, collection-only
results, unsupported outcomes, and Jest runner column bases. It also verifies
that titles and failure messages do not enter the manifest. The performance
regression imports 5,000 synthetic results, checks a fixed latency ceiling and
serialized output budget, and does not execute fixture code. Retry history,
method spans and mock invocation details are explicit unsupported capabilities.

The local import command is documented in
[runtime-test-tracing.md](runtime-test-tracing.md). CI must never run a
customer repository to create this evidence; CI may import only a report
created by an explicitly configured, user-controlled test job.

## Test Completion Gate

Before moving to frontend work, the backend must prove this behavior:

```text
For the booking fixture and cancellation/refund change request:
- persist snapshot, artifacts, edges, evidence, and insights
- reject unqualified repository/requirement inputs before analysis
- produce evidenced/inferred/unknown separation
- avoid inventing unsupported refund policy
- support insight confirmation and rejection
- finalize explicitly into reviewed output while preserving immutable history
```

Before reporting implementation complete, use
[done-checklist.md](done-checklist.md) to identify verification performed and
any checks that are not yet available.
