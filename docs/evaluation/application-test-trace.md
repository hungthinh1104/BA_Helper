# Application source trace evaluation

## Reproduce

Run `pnpm verify:application-test-trace`. It verifies upstream Git blob hashes,
parses only the selected files, and writes
`artifacts/evaluation/application-test-trace-scorecard.json`. CI runs the same
regression gate and uploads the scorecard. No external dependencies are
installed and no external code or tests are executed.

Ground truth: `tests/evaluation/application-test-trace.ground-truth.json`.
Initial measurement: `tests/evaluation/application-test-trace.baseline.json`.
Regression policy: `tests/evaluation/application-test-trace.regression.json`.
The ground-truth SHA-256 is
`d87059c07d9f36a4ae61e58515230aaf9bdcea96d65ac8a1bddd0fdd206c013f`.
Labels were read from source and frozen before the first analyzer run. They
were not changed to match predictions. They have not been independently
adjudicated by human reviewers.

## Selection and units

The selected application capabilities are billing/subscription and subscriber
lifecycle. Source screening also found a local constructor factory example.
This purposeful selection is not a random sample or a full application scan.

| Application | Pinned commit | Selected TypeScript files |
| --- | --- | ---: |
| [Amplication](https://github.com/amplication/amplication/tree/7656495d27f0dceff89657590c3f14149e45c7a6/packages/amplication-server/src/core) | `7656495d27f0dceff89657590c3f14149e45c7a6` | 4 |
| [Novu](https://github.com/novuhq/novu/tree/3d5fb5ffb54405e0d94bb3f8ba4e2fb4b1a3ef2d/apps/api/src/app) | `3d5fb5ffb54405e0d94bb3f8ba4e2fb4b1a3ef2d` | 6 |

There are 27 source test declarations, 28 desired TESTS references and 22
selected-source CALLS. Each `it.each` callback is graded once using its literal
unexpanded title. Its data rows are not counted as independently extracted
runtime cases. Typed mock object properties, spyOn strings and assertion-only
member references are not direct calls. Calls to classes outside the selected
production files are outside the graded universe and remain unresolved.

Novu uses Mocha/Chai and unbound `describe`/`it`. The current analyzer recognizes
that global syntax under its documented Jest-style assumption. These results
do not verify runner identity. The precise difference must remain visible when
interpreting the case metric.

## Pattern compatibility (analyzer@0.7.0)

| Pattern | Status | Evidence boundary |
| --- | --- | --- |
| Literal Jest `describe` / `it` / `test`, including named `@jest/globals` aliases | Supported | Source declarations and callback body are parsed; no test is run. |
| `.skip`, `.only`, `.todo` modifiers | Supported | Modifiers affect the static declaration state; skip/todo cases do not create TESTS edges. |
| Inline array `it/test.each([...])`, including `.skip.each` and `.only.each` | Supported | One source callback per declaration; data rows are not executed or expanded. |
| Unbound `describe` / `it` globals | Partial | Syntax is accepted under a Jest assumption; runner identity/configuration is not verified. This includes the selected Novu Mocha source. |
| Explicit `new Class()` test subjects and local immutable bindings | Supported | Lexical scope and imported class identity are required. |
| `TestingModule.get(ClassToken)` | Supported | `Test` must be imported from `@nestjs/testing`; all observed assignments must resolve to the same class token. |
| Same-file zero-argument synchronous factory returning `new Class()` | Supported | One direct return; conditional, async, generic, imported, writable or escaped factories are rejected. |
| Private/protected Injectable service helpers | Supported | They remain service artifacts; controller helper visibility does not create routes. |
| `ModuleRef.get/resolve`, runtime DI, barrels/path aliases and dynamic receivers | Unsupported | No relationship is inferred; report as unresolved when a diagnostic is available. |
| Tagged/dynamic tables, `describe.each`, concurrent/conditional declarations, async suites and malformed callbacks | Unsupported | No individual test artifact or TESTS edge is claimed. |
| Mocked providers and spies | Partial | A source reference to the declared class token is static only; it does not prove invocation, assertions, execution or pass/fail. |

The measured corpus includes only the rows represented in the pinned source
slices. Other supported rows are covered by analyzer fixtures and regression
tests, not by these public-repository accuracy denominators.

## Measured results, October 21

| Measure | Baseline: 0.6.0 | 0.6.1 | Current: 0.7.0 |
| --- | ---: | ---: | ---: |
| Source declarations found | 23/27 (85.2%) | 23/27 (85.2%) | 27/27 (100%) |
| CALLS precision / recall / F1 | 100 / 90.9 / 95.2% | 100 / 100 / 100% | 100 / 100 / 100% |
| TESTS precision / recall / F1 | 100 / 75.0 / 85.7% | 100 / 85.7 / 92.3% | 100 / 100 / 100% |
| False positive declarations / CALLS / TESTS | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |
| Direct-edge source evidence integrity | Not measured | Not measured | 50/50 (100%) |

Observed precision is 100% within each declared universe. These small,
purposefully selected slices do not establish generalization, whole-project
impact accuracy, LLM reasoning quality, or product effectiveness. The initial
baseline was measured before the two fixes; the fixed corpus is now regression
data. These local runs used an uncommitted working tree on base commit
`0ac83a7b5f585232ba276e15b3f0787954113584`. Analyzer versions label the
measurements; there is no release-certified tool commit.

The current scorecard checks each emitted CALLS and TESTS edge against its
pinned source file, artifact line range and direct-call token. The measured
50/50 is a source-location integrity check, not a second human judgment that a
relationship is relevant to the requirement. Diagnosed unsupported patterns
were 0/27 observed declarations. Unsupported patterns that produce no parser
diagnostic are not counted by this rate. The evaluator also refuses a passing
accuracy result if a graded method symbol maps to multiple selected files;
current ambiguity count is zero.

The measured fixes are:

- Extract private/protected Injectable service helpers as SERVICE_METHOD
  artifacts, preserving source evidence and direct edges. Two Novu helpers
  previously disappeared before graph resolution. Controller helper visibility
  does not create new HTTP endpoint artifacts.
- Resolve a test receiver through a same-file synchronous, zero-argument
  function with one `return new Class(...)` statement. Reject writes, aliases,
  async/generator functions, imports and conditional/object returns. Cache
  resolution per build. This recovers three static references through a factory
  constructing the source subject with mocked dependencies.

## Parameterized declarations and gate meaning

The four Amplication `it.each` declarations and their four TESTS references are
resolved in `analyzer@0.7.0`. The unchanged ground-truth digest above still
matches. Accuracy and regression statuses both pass within this source scope.

The regression policy now permits zero misses and zero false positives. It
also requires the frozen label digest and expected universes to match. An empty
prediction set, edited labels or a reduced expected universe fails. The prior
allowed-miss lists have been removed; do not widen them to hide a regression.

`it/test.each([...])`, `.skip.each` and `.only.each` create one source artifact
with `testCase.parameterized: true`, an unchanged literal title template and
callback-only TESTS references. Array expressions are not executed and data rows
are not expanded. Empty tables are source declarations too and imply no runtime
cases. Supported forms follow the [Jest API](https://jestjs.io/docs/api#testeachtablename-fn-timeout).

Parameterized identity hashes include the `PARAMETERIZED` tag, separating a
declaration from an ordinary case with the same title; existing ordinary case
identities are unchanged. Table edits change the source content hash. Metadata
survives persistence, QA projection and frozen reports. Live UI, saved UI and
Markdown/PDF identify parameterized declarations and explain the unexpanded data.
The optional field leaves historical metadata unchanged and requires no database
migration. Source extraction is shared by the fixture and selected-file scanners.

Dynamic/tagged tables, parameterized suites and concurrent forms remain outside
this bounded implementation and emit limitations. Human adjudication and reviewer
time/accuracy remain unmeasured. Follow the existing counterbalanced study
protocol; no automated or fake-provider result substitutes for real reviewers.
