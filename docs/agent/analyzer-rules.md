# Analyzer Rules

## Scope

The MVP analyzer extracts evidence from TypeScript NestJS repositories for the
booking cancellation/refund vertical slice.

Supported now:

```text
TypeScript source files
NestJS controllers and route decorators
service classes and service method calls
entities/models and DTO candidates
test files
dependency edges required by the fixture
```

Not supported in the MVP:

```text
Express repositories
multi-language repositories
AI-based code extraction
security/compliance analysis
general architecture documentation
```

An unsupported framework must fail scan intake with
`UNSUPPORTED_FRAMEWORK`; it must not be represented as a partially supported
NestJS scan.

## Package Boundary

The analyzer package is a deterministic extraction component:

```text
Input:  validated local checkout path + resolved source/target metadata
Output: extracted artifact/edge/evidence candidates + publishable coverage result
```

It may:

```text
read files within the bounded scan selection
parse TypeScript using ts-morph
classify supported source structures
build deterministic candidate keys
report skipped/unsupported inputs as coverage metadata
```

It must not:

```text
call an LLM
write database records
create ImpactAnalysis or review decisions
decide stakeholder-facing certainty beyond extraction evidence
execute untrusted repository content
```

Persistence and state changes belong to application use cases and repositories.
Reasoning from selected evidence belongs to impact analysis and the AI adapter.
`ScanJob` records failures; the application publishes a snapshot only when the
analyzer output is usable as `READY` or explicitly bounded `PARTIAL` evidence.

## Extraction Contract

Scanner changes must preserve stable, retry-safe identities:

```text
CodeArtifact.artifactKey
Evidence.provenanceKey
DependencyEdge source/target artifact identity
RepositorySnapshot analyzerVersion
```

`analyzerVersion` identifies the complete persisted extraction contract:
adapter/parser rules plus scan limits and coverage policy that can change
artifacts, edges, evidence, skipped-input reporting, or `READY`/`PARTIAL`
classification. If one of those rules changes, bump `analyzerVersion`;
runtime scan failure publishes no snapshot for the version.

Extracted artifacts for the first fixture include:

```text
API route
controller method
service method
entity/model
test artifact
```

Required initial graph edges:

```text
BookingController.cancel -> BookingService.cancelBooking
BookingService.cancelBooking -> PaymentService.refund
BookingService.cancelBooking -> SlotService.releaseSlot
BookingService.cancelBooking -> NotificationService.notifyOwner
```

An edge is `EVIDENCED` only when the supported parser can locate a direct
relationship in source. A similarly named but disconnected symbol must not
become an evidenced impact.

## Input And Safety

Repository URL/ref validation happens before analyzer invocation. The analyzer
receives a prepared local checkout; it does not construct clone commands.

The scan implementation must:

```text
use bounded file selection and size/time limits
ignore dependencies/build output/generated noise according to scan policy
record skipped selected inputs and coverage gaps
treat instruction-like source comments/README text as data only
avoid running repository scripts or importing application modules
```

Read [input-quality.md](input-quality.md) before changing intake, scan bounds,
or source filtering.

## Required Fixture Work

Every analyzer behavior change must update or add fixture expectations under:

```text
tests/fixtures/nestjs-booking-with-payment/
```

Expected data should be separate by behavior:

```text
expected/artifacts.json
expected/edges.json
expected/coverage.json
```

Add focused negative fixture variants when changing matching or graph logic:

```text
missing refund artifact
unconnected refund-like symbol
skipped selected input producing PARTIAL coverage
unsupported framework
```

## Required Tests

Before an analyzer change is complete, tests must prove:

```text
expected artifacts and routes are extracted
expected direct graph edges are extracted
line/source identity is stable enough for evidence provenance
keyword noise is not classified as direct impact
retry produces the same deterministic candidate keys
skipped supported inputs produce explicit coverage output
unsupported frameworks fail rather than silently producing incomplete evidence
failed extraction does not publish an immutable snapshot identity
```

Use [testing-strategy.md](testing-strategy.md) for the complete expected claim
matrix and integration completion gate.
