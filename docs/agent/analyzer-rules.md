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

### NestJS graph publication (`analyzer@0.5.0`)

The TypeScript adapter builds dependency edges from exactly the selected
`tsFiles` used by extraction. Graph construction must not re-enumerate paths,
resolve excluded imports from disk, or execute repository code. Artifact paths
are normalized to repository-relative forward-slash paths on every platform.

Direct method relationships resolve the receiver's local class declaration or
relative named/default import and its constructor-injected parameter property.
Test-case relationships resolve explicit `new Class()` instances with lexical
scope and import aliases; variable receivers must be immutable `const`
bindings. Changing-`this` function scopes and colliding artifact keys are
reported as unresolved rather than mapped. Unresolved methods/imports produce diagnostics and
never fall back to the first method of a class. Barrels, path aliases, runtime
DI and dynamic receivers remain outside this resolver's supported patterns.

Edges carry deterministic resolver provenance and up to 20 unique source line
locations, with an omitted-location count when bounded. Persistence references
the source artifact's redacted `Evidence.provenanceKey` in the same snapshot.
`TESTS` means a static source reference from a supported active **Jest case
body** to a method. Setup hooks and skipped/todo cases create no TESTS edges.
Historical `analyzer@0.4.0` edges originated at file level and could include
setup; they retain their original meaning. Neither version establishes
assertion coverage, execution or pass/fail. A call path through mocked
dependencies is not runtime coverage.
Confidence describes extraction resolution, not a calibrated probability.

Changing the graph extraction contract requires a new analyzer version and
rescan. Historical snapshots are not backfilled with inferred relationships.

### Jest case extraction

Keep a `TEST` file container (`TEST_FILE`) and extract separate
`JEST_TEST_CASE` (`TEST_CASE`) artifacts. Recognize literal `describe`, `it`,
`test`, `.skip`, `.only`, `.todo`, and named aliases from `@jest/globals`.
Unbound Jest-style globals are a syntax assumption, not verified runner
configuration. Local shadows and imports from another framework are not Jest.
Do not execute tests or load repository dependencies.

Each case stores redacted suite/title labels, effective and declared modifiers,
source range and its parent file key. Modifiers describe declarations, not test
results. Case identity is `test-case:<relative-path>::<sha256>` where the digest
is SHA-256 of JSON `[suitePath, title]` before redaction. Body/line/modifier changes
retain identity; content hashes capture body and effective modifier changes.
Offsets used to assign calls to a body are transient and never persisted.

Literal suites are bounded to 20 levels and labels to 1000 characters.
Dynamic/parameterized/conditional declarations, async suites, nested tests and
malformed callbacks emit `JEST_UNSUPPORTED_DECLARATION`. Duplicate identities
are all omitted with `JEST_DUPLICATE_TEST_IDENTITY`; retain the file as evidence.
Unsupported declarations must not be presented as individually traced cases.

### Persisted Static Test Paths

QA projection consumes semantic persisted `TESTS` and `CALLS` relationships;
it must not derive analysis results from a truncated/layout-oriented graph.
One active Jest case starts a path, followed by at most four `CALLS` hops.
Setup/file-level legacy TESTS, skipped/todo cases, `REFERENCES` and `IMPORTS`
do not establish such paths. Indirect paths remain structural source
observations because injected dependencies may be mocked in the case.

Every traversed edge must have `TS_AST_DIRECT_CALL` provenance pointing to its
source artifact's persisted evidence in the same snapshot. Validate edge,
both endpoint identities, evidence origin/type, source file and containment of
location samples in the artifact/evidence ranges. Missing, malformed or
cross-snapshot support is excluded with a projection limitation, never filled
by name matching. Cycles terminate and each case contributes one deterministic
shortest path. This read projection does not change extraction or historical
snapshot identity and requires no analyzer version bump.

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

## Repository Profiling Foundation

Phase 20A adds deterministic repository profiling before persisted extraction is
consumed elsewhere.

Profile detection support is intentionally broader than extraction support:

```text
profile detection:
- TypeScript + NestJS
- Generic TypeScript fallback

extraction support:
- NestJS only
```

Rules:

```text
profile detection may classify a repository as GENERIC_TYPESCRIPT
unsupported extraction still fails the scan with UNSUPPORTED_FRAMEWORK
only published READY/PARTIAL snapshots persist RepositoryProfile
failed unsupported scans persist no RepositoryProfile row
```

`RepositoryProfile` is snapshot-scoped metadata, not an editable repository
setting. Its domain classification is conservative: weak evidence resolves to
`UNKNOWN`, not an invented bounded context.

Use [testing-strategy.md](testing-strategy.md) for the complete expected claim
matrix and integration completion gate.
