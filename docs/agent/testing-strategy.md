# Testing Strategy

## Approach

Use-case-first development is mandatory for the analysis engine:

```text
acceptance criteria
-> fixture repository
-> expected artifacts/edges/insights
-> automated tests
-> implementation
```

Do not validate quality by reading generated prose and deciding that it looks
reasonable.

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

### Scanner fixture tests

Verify routes, controller/service methods, entities/models, tests, line ranges,
commit/analyzer-version identity, coverage, and skipped files.

Verify scan processing failures live on `ScanJob` only; the scanner does not
publish a `FAILED` or `SCANNING` snapshot record that blocks a later successful
retry for the same identity.

Verify a completed scan response provides the `sourceTargetId` and
`snapshotId` needed for impact analysis, while a post-resolution extraction
failure may expose only target observation and no usable snapshot.

### Graph tests

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
repeated identical review decision does not append a duplicate change event
later safe moving-ref resolution projects older completed output as isStale=true even when extraction fails
same commit with a different analyzerVersion does not mutate old extracted evidence
same commit reached from different targets does not overwrite target provenance
stale WAITING_FOR_REVIEW analysis cannot be reviewed or finalized as current output
concurrent target observation update racing review/finalization causes the stale mutation to reject or fail its conditional commit
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
