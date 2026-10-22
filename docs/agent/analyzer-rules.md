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

### NestJS graph publication (`analyzer@0.9.0`)

The checkout root and accepted source-file paths are canonicalized through
filesystem real paths before computing repository-relative artifact identity.
This treats Windows short/long names and directory junction aliases as the
same checkout. Only the accepted file list is canonicalized; it does not
re-enumerate files or load excluded imports. Historical snapshots from earlier
analyzer versions remain immutable; rescan to replace malformed path identities.

The TypeScript adapter builds dependency edges from exactly the selected
`tsFiles` used by extraction. Graph construction must not re-enumerate paths,
resolve excluded imports from disk, or execute repository code. Artifact paths
are normalized to repository-relative forward-slash paths on every platform.
Persisted artifact keys include the canonical repository-relative path and the
qualified source symbol. Method overload keys also include a SHA-256 digest of
their parameter signature. Test-file keys use an escaped canonical path; a
basename or flattened path must never determine identity. Graph edge IDs encode
the source, edge type, and target as separate components.
`SCAN_HEALTH.scannerVersion` comes from the analyzer package's scanner version
constant. Snapshot list and drift projections read that persisted diagnostic;
they do not infer scanner version from analyzer version or repository profile.

Direct method relationships resolve the receiver's local class declaration or
relative named/default import and its constructor-injected parameter property.
Test-case relationships resolve explicit `new Class()` instances in immutable
`const` bindings, preserving lexical scope and import aliases. They also resolve
class-token `.get(Class)` calls on a variable whose observed writes all come
from `await Test.createTestingModule(...).compile()`, with `Test` imported from
`@nestjs/testing`. The acquired subject may be assigned in a setup hook; every
observed write must resolve to the same imported class token. Generic type
arguments, when present, must agree with that token. Receiver results are
cached within one graph build.

Graph construction indexes test artifacts by accepted source file and caches
call-expression offsets once per file. Test bodies query fully contained calls
through a sorted range index instead of rescanning every call for every test.
Keep equal-offset traversal order, ambiguity exclusions, skip/todo handling,
diagnostics and provenance identical. This optimization does not change the
extraction contract or require an analyzer-version bump. The synthetic
`pnpm benchmark:static-test-graph -- current` measurement records output digests
and timing samples; it is not an end-to-end latency or accuracy gate.

Injectable service methods include private/protected helpers because changed
policy can live behind a public entry point. They retain SERVICE_METHOD identity
and source evidence. Private/protected controller helpers remain excluded from
API_ROUTE extraction; this does not make them HTTP endpoints.

An active test body may also reference a method through a same-file,
zero-argument function declaration whose sole statement is `return new Class(...)`.
The factory must be synchronous, non-generator and non-generic, with no
parameters, writes, aliases or escaped references. Only direct calls are
accepted; imported factories, conditional returns and object-returning helpers
remain unresolved. Factory results are cached per graph build. This is a source
relationship even when constructor dependencies are mocks, never runtime coverage.
The selected-file and legacy fixture entry points both default to the current
analyzer version. Existing snapshots remain immutable and require a rescan.

Type annotations, string tokens, arbitrary `.get()` methods, builder aliases,
conflicting assignments, destructuring writes and mutable fake module bindings
do not establish a relationship. Mocked providers remain static references to
their declared class token; no runtime execution or assertion coverage is
implied. Setup acquisition itself creates no TESTS edge.

Changing-`this` function scopes and colliding artifact keys are
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
Inline-array `it.each([...])` / `test.each([...])`, including `.skip.each`
and `.only.each`, produce one source declaration per callback with
`parameterized: true`. Preserve the literal title template; do not interpolate
values, execute data expressions, expand rows or claim a runtime case count.
An empty inline table still has a source declaration and implies no execution.
Unbound Jest-style globals are a syntax assumption, not verified runner
configuration. Local shadows and imports from another framework are not Jest.
Do not execute tests or load repository dependencies.

Each case stores redacted suite/title labels, effective and declared modifiers,
source range and its parent file key. Modifiers describe declarations, not test
results. Case identity is `test-case:<relative-path>::<sha256>` where the digest
is SHA-256 of JSON `[suitePath, title]` before redaction for literal cases.
Parameterized declarations use `[suitePath, title, "PARAMETERIZED"]`, keeping
them distinct from a literal case with the same title. Ordinary case identities
remain unchanged. Body/line/modifier/table-row changes retain identity; content
hashes capture source content and the effective modifier. The optional flag
passes through persisted metadata, QA projection and saved reports without
defaulting or rewriting historical metadata.
Offsets used to assign calls to a body are transient and never persisted.

Literal suites are bounded to 20 levels and labels to 1000 characters.
Dynamic titles/tables, tagged tables, `describe.each`, concurrent/conditional
declarations, async suites, nested tests and
malformed callbacks emit `JEST_UNSUPPORTED_DECLARATION`. Duplicate identities
are all omitted with `JEST_DUPLICATE_TEST_IDENTITY`; retain the file as evidence.
Unsupported declarations must not be presented as individually traced cases.

### Static Jest behavior evidence

For active Jest cases, the scanner records common setup and teardown hooks, literal/static
input declarations, direct calls, Jest mock APIs, matcher assertions and
explicit matcher arguments as `behaviorEvidence` in case metadata. These are
`STATIC_DECLARATION` claims: they describe source syntax only and never report
test execution, pass/fail, or coverage. Parameterized tests retain one claim
for their inline table expression; rows are not evaluated or expanded.

Each claim is bound to the resolved scan `commitSha` and a canonical
repository-relative path with UTF-16 start/end offsets (exclusive end),
one-based line/column coordinates, and redacted source text. Persistence
links claims to the persisted test-file evidence and rejects a claim whose path
differs from its test file or whose commit differs from the published snapshot.
Without commit context, no behavior claim
is emitted and `JEST_BEHAVIOR_UNRESOLVED` reports `COMMIT_CONTEXT_REQUIRED`.
The scanner bounds each case at 100 claims, each scan at 20,000 claims and
each source excerpt at 2,000 characters. Dynamic matchers, nested callbacks and snapshot expectation
contents remain unresolved with explicit diagnostics; do not infer their
meaning or execution. Analyzer contract changes require a version bump and
rescan; historical snapshots remain unchanged.

### Opt-in Jest runtime observations

The local runtime prototype consumes an explicit Jest JSON result only. It
does not execute tests or source code from the analyzer, API or worker. Runtime
records use `RUNTIME_OBSERVATION` and stay in a separate manifest; do not add
them to static behavior evidence or reinterpret static `TESTS`/`CALLS` edges.
Correlate only against a static test artifact from the same commit using the
canonical repository-relative file and Jest's exact case declaration line.
Missing, duplicate or mismatched inputs remain unmatched/ambiguous with
diagnostics. Do not infer method execution from a matched test outcome.

The importer accepts only bounded Jest JSON and static indexes, drops titles,
source text, assertion arguments, mocks, failure messages and console output,
and writes local output without overwriting an existing file. It captures the
Jest case's final status and available timing only. Retry histories, method
spans, mock invocations and assertion-to-method coverage remain unavailable;
label these capabilities false. See
[runtime-test-tracing.md](runtime-test-tracing.md) for the opt-in workflow and
retention boundary.

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
