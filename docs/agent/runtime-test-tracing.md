# Opt-In Jest Runtime Trace Prototype

## Boundary

The prototype imports an explicitly created Jest JSON report in a local or
user-controlled CI workspace. The importer never starts Jest, calls a Git
command, reads application source, sends data over the network, writes to the
database, or changes static artifacts and edges. There is no server-side test
execution endpoint.

Every imported record is `RUNTIME_OBSERVATION`, separate from static
`STATIC_DECLARATION` behavior claims and static `TESTS`/`CALLS` graph edges. A
matched runtime result is attached to the existing stable test artifact key;
it does not prove that a method on a static call path ran, that an assertion
covered a specific business rule, or that mocks were invoked.

## Local workflow

Run these commands only in a checkout where executing the tests is intended.
The first command is the user's explicit test execution; BA_Helper does not
invoke it. Jest documents [`--json`, `--outputFile` and
`--testLocationInResults`](https://jestjs.io/docs/30.4/cli) and the per-case
location, start time and duration fields in its
[result processor shape](https://jestjs.io/docs/30.4/configuration#testresultsprocessor-string).
Replace the angle-bracket placeholders with the actual full commit SHAs and a
unique run ID before running the import.

```powershell
New-Item -ItemType Directory -Force .runtime | Out-Null
pnpm exec jest --config jest.config.ts path/to/selected.spec.ts --json --outputFile=.runtime/jest-results.json --testLocationInResults
pnpm exec tsx scripts/import-jest-runtime-trace.ts --jest-json .runtime/jest-results.json --static-index .runtime/static-test-artifacts.json --repo-root . --commit-sha <full-tested-commit-sha> --static-commit-sha <full-static-snapshot-commit-sha> --run-id <unique-run-id> --output .runtime/runtime-trace.json
```

The static index is a JSON array of analyzer test artifacts or an analyzer scan
result object with an `artifacts` array. The importer uses only each test
artifact's `stableId`, `type`, `filePath`, `startLine`, and test-case metadata.
Create the index from the same repository snapshot and keep its commit SHA in
`--static-commit-sha`. The importer refuses to claim a match when the tested
commit differs from that static snapshot. The output file is created exclusively
and is never overwritten; choose a fresh path for each run. Omit `--run-id` to
generate a UUID, or provide one to reproduce an import exactly.

For `jest-jasmine2`, pass `--column-base 0`; Jest Circus, the default runner,
uses one-based columns. The importer normalizes either input to one-based
source coordinates. Jest's case location must point to the declaration line;
missing locations and ambiguous declarations remain explicitly unresolved.

## Captured data and limitations

The manifest contains the run ID, tested and static snapshot commits, stable
test artifact ID, repository-relative test file and source line/column, Jest
case outcome, and the case start time and duration when supplied. Parallel
worker results are sorted before output. Output contains no test titles, source
text, assertion arguments, mock values, failure messages, stack traces, stdout,
or stderr. The local Jest JSON input can contain failure details, so keep that
file in a protected local/CI workspace and remove it according to that
workspace's retention policy after import.

Jest's aggregate JSON result reports final case results and durations. The
prototype marks every row `FINAL_RESULT_ONLY`; it does not reconstruct retry
attempts. It also does not capture method-level spans, mock invocations, async
resource lifetimes, or assertion-to-method coverage. Those capabilities are
false in the manifest. `test.each` runtime rows may each map to the same static
source declaration; that reflects one declared callback, not multiple static
cases. Collection-only (`wouldRun`) records are discarded rather than
misreported as execution.

Imports are bounded to a 20 MiB Jest report, 10,000 suites, 10,000 case
results, 100,000 static test artifacts, and a 20 MiB output. The importer aggregates
path/correlation/timing errors by stable diagnostic code and never includes an
outside absolute path in a diagnostic. `traceDigest` covers the normalized
manifest, not a cryptographic attestation of the test runner; a local result
file can be edited and should be treated as user-supplied evidence.

The analyzer regression tests measure import latency and output size over
5,000 synthetic case results. This measures post-run import cost, not the
overhead of Jest's own JSON reporter or an application's test runtime.
