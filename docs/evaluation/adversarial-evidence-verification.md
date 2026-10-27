# G2B-AUTO-Lite Adversarial Evidence Verification and Completion Report

## Purpose and trust boundary

This bounded regression suite checks selected scanner and graph properties at
claim levels L0-L2: source/AST facts, direct static relationships, and declared
Jest setup/action/assertion/mock associations. It does not establish runtime
execution, test pass/fail, coverage, or human behavioral understanding (L3-L4).
It uses fixed local TypeScript snippets, the production `scanProject` scanner,
and production `buildGraph`; it never installs dependencies or executes fixture
code.

The existing public and application trace evaluators remain the source-authored
corpus gates. This suite complements them with deterministic before/after source
transformations. Expected relationships and diagnostics below are specified
from the fixture transformation before analyzer output is collected.

## Phase 0: Existing coverage and remaining gaps

| Failure mode | Existing coverage | Missing property | Risk | Classification |
| --- | --- | --- | --- | --- |
| Incorrect target identity | Ambiguous same-name re-exports fail closed; source-trace evaluation scores qualified file and symbol identity. | No direct-call transformation added an unrelated same-method decoy file while preserving the imported target. | Wrong method or same-named file could mislead trace readers. | PARTIALLY_COVERED |
| Incorrect direct TESTS edge | Real graph tests cover direct calls, unrelated receivers, excluded targets, and unresolved methods; public and application corpora compare source-authored relationships. | A controlled edit must prove an old edge disappears when its invocation is removed or retargeted. | A stale or name-reused TESTS edge could falsely associate a test. | PARTIALLY_COVERED |
| Incorrect CALLS edge | Real graph tests cover aliases, unrelated receivers, excluded imports, unresolved targets, duplicate symbols, and re-exports. | Computed method calls in production code are skipped without an explicit unresolved diagnostic. | An absent edge can be mistaken for evidence that no call exists. | PARTIALLY_COVERED |
| Source location drift | Behavior claims validate source offsets/text; graph tests validate direct call lines; line shifts are checked for identity stability. | No transformed graph check proves locations move with the call and still point into transformed source. | Stale line provenance undermines evidence review. | PARTIALLY_COVERED |
| Ambiguous reference | Duplicate symbols, ambiguous re-exports, reassigned receivers, and ambiguous assertion subjects have unresolved regressions. | Reuse these gates; avoid cloning equivalent ambiguity fixtures. | A guessed target creates false confidence. | ALREADY_COVERED |
| Setup/action confusion | Jest behavior tests distinguish hooks from body actions and keep inherited setup outside the action list. | No uncovered extractor property selected. | Setup may be described as a test action. | ALREADY_COVERED |
| Mock/assertion confusion | Tests cover mock identity, matcher classification, assertion-to-invocation association, and unresolved associations. | No uncovered extractor property selected. | Mock configuration may be misrepresented as production behavior. | ALREADY_COVERED |
| Unsupported relationship misrepresented | Dynamic matchers, nested callbacks, namespace exports, and unsupported targets have diagnostics. | A computed production method reference currently disappears without a graph diagnostic; computed test calls also lack a specific dynamic-reference reason. | Users cannot distinguish unsupported/dynamic code from no relationship. | PARTIALLY_COVERED |
| Snapshot isolation | Analyzer builds are scoped to a fixed `ScanResult` and graph-source-index tests prove indexes do not cross builds. | `ScanInput` exposes repository root and optional commit SHA, not persisted `snapshotId`; snapshot isolation is not observable at this analyzer seam. | A snapshot-level test here would claim more than the API can prove. | OUT_OF_SCOPE |

## Phase 1: Verification contract

The mandatory properties use four outcomes:

- **PRESERVE**: the relationship identity remains the same after a valid alias
  rename.
- **REMOVE**: the old relationship disappears after the target invocation is
  removed or changed. A replacement edge is allowed only when the transformed
  source directly supports it.
- **REMAP**: the same relationship remains valid while its canonical file path
  or reported source line changes with the transformed source.
- **UNRESOLVED**: a computed target does not produce a confident edge and has a
  specific unresolved diagnostic.

Relationship identity is compared as edge type plus canonical source file and
symbol/test identity. Provenance compares canonical relative path and exact
start/end line against the authored transformed source. Artifact IDs and content
hashes may legitimately change after edits and are not required to stay equal.

| Case ID | Risk | Deterministic transformation | Expected property | Independent rationale |
| --- | --- | --- | --- | --- |
| AE-IDENTITY-SAME-METHOD-01 | Same method name across files | Add an unrelated `RefundService.refund` beside the imported `PaymentService.refund` target. | PRESERVE the `TESTS` edge to `src/payment.service.ts#PaymentService.refund`; do not add a decoy edge. | The import resolves to one canonical file; an unreferenced method name is not a reference. |
| AE-PROVENANCE-NESTED-01 | Nested call source selection | Move the invocation into a multiline assertion argument. | REMAP provenance to the inner production call line, not the outer assertion. | Nesting changes layout while preserving the called method. |
| AE-IDENTITY-ALIAS-01 | Imported target identity | Rename the local imported class alias and its constructor use; keep the method call unchanged. | PRESERVE the `TESTS` edge to `src/payment.service.ts#PaymentService.refund`; retain the authored call line. | A local alias changes spelling, not the imported declaration or method being called. |
| AE-IDENTITY-SUBSTITUTE-01 | Stale/wrong direct target | Replace `service.refund()` with `service.authorize()` where both methods exist. | REMOVE the old refund edge; add only the directly supported authorize edge. | The transformed AST names a different declared method; the former target is no longer referenced. |
| AE-NEGATIVE-IMPORT-01 | Import mistaken for invocation | Keep the import and constructed service; remove `refund()` from the test body. | REMOVE the `TESTS` edge and report `NO_SUPPORTED_DIRECT_REFERENCE`. | An import or variable declaration does not invoke a production method. |
| AE-PROVENANCE-SHIFT-01 | Stale graph line | Insert comments and blank lines before the same direct invocation. | REMAP the same edge to the new exact call line; source audit must find the target call there. | A harmless prefix shift changes line coordinates but not the call or target. |
| AE-IDENTITY-MOVE-01 | Stale path identity | Move the production file and update the relative import, keeping class, method, and test title unchanged. | REMAP the same `TESTS` relationship to the new canonical target path; the old path must be absent. | The import resolves to the moved file; file identity is part of the target identity. |
| AE-UNRESOLVED-TEST-DYNAMIC-01 | Computed Jest target | Replace `service.refund()` with `service[methodName]()` where the key is not statically fixed. | UNRESOLVED: no `TESTS` edge and a `TEST_TARGET_UNRESOLVED / DYNAMIC_METHOD_REFERENCE` diagnostic. | The source does not identify one method declaration. |
| AE-UNRESOLVED-CALL-DYNAMIC-01 | Computed production target | Replace `this.payment.refund()` with `this.payment[methodName]()` where the key is dynamic. | UNRESOLVED: no `CALLS` edge and an `UNRESOLVED_METHOD_TARGET / DYNAMIC_METHOD_REFERENCE` diagnostic. | The source does not identify one target method; absence must remain distinguishable from no relationship. |
| AE-UNRESOLVED-INJECTION-DECOY-01 | Unresolved DI and same-name decoy | Add a same-named service at a different path while the imported injection target remains missing. | UNRESOLVED: no `CALLS` edge and the same `UNRESOLVED_INJECTION_TOKEN / IMPORT_RESOLUTION_FAILED` diagnostic before and after. | A matching symbol name does not establish the imported receiver identity. |

Expected edge lists, diagnostics, and source lines are encoded separately from
the observed analyzer output. Each case scans both baseline and transformed
files through the real analyzer and graph builder. Source hashes are recorded
for both variants. Temporary files are removed on success and failure.

## Metrics and reporting

The machine report is `artifacts/evaluation/adversarial-evidence-verification.json`.
It records tool commit SHA and worktree cleanliness, analyzer/suite versions,
content-derived fixture snapshot identifiers, per-file fixture SHA-256 values,
expected and observed relationship deltas, case outcomes,
diagnostics, invalid supported edges, missing expected edges, provenance
violations, unresolved correctness, elapsed time, and scope limitations.

- Property satisfaction is passed mandatory properties divided by evaluated
  mandatory properties.
- False supported relationship count is the number of observed relationships
  outside the case's independently specified expected set.
- Provenance integrity is valid locations divided by evaluated locations, or
  `null` when no location was evaluated.
- Unresolved correctness requires no supported edge and the declared
  uncertainty diagnostic for each computed-target case.
- A sensitivity probe deliberately moves a valid relationship location to the
  test declaration line and requires the source audit to reject it.
- The report records a source-delta digest with the base commit SHA so an
  uncommitted candidate can be distinguished from its starting commit.
- No empty-set accuracy, precision/recall, runtime-coverage, or human-value
  claim is made.

## Pre-infrastructure baseline

Measured on the local Windows checkout at `72c37a6f892793fab2a4269de689574b46e94ae8`
with repository-local Node 22.23.3, before adding this suite:

| Gate | Baseline result |
| --- | --- |
| `pnpm test:analyzer` | 45 suites, 272 tests passed; 19.135 s |
| `pnpm verify:public-test-trace` | PASS; 22/22 cases, 24/24 TESTS, 10/10 CALLS, 34/34 direct-edge locations supported |
| `pnpm verify:application-test-trace` | PASS; 27/27 cases, 28/28 TESTS, 22/22 CALLS, 50/50 direct-edge locations supported |
| `pnpm benchmark:static-test-graph -- ci` | 800 cases: p95 scan 1,068.96 ms, p95 graph 481.93 ms; output digest `742bd8d7f43723b49c95f1bf923c97a0b289afd89ca635e8e77a95b2312795a9` |

These are regression baselines, not customer capacity or broad accuracy
estimates. The Windows Node process required a temporary `os.userInfo()` shim
for `tsx`; the shim does not alter analyzer input or results.

## Limitations

This is a small synthetic transformation suite, not independently adjudicated
repository ground truth. It verifies selected static source relationships and
provenance only. Dynamic dispatch outside the explicit cases, runtime behavior,
test execution, test pass/fail, coverage, and L4 comprehension remain unverified.

## Completion report

### 1. Repository baseline

- Branch: `codex/fix-backend-runtime-ci-boundary`.
- Base HEAD and live branch tip: `72c37a6f892793fab2a4269de689574b46e94ae8`; local `origin` tracking ref and GitHub branch API agree.
- The worktree is dirty. It contains this G2B candidate plus separately scoped G2A study-mode edits; no commit, push, merge, or deployment was made.
- Hosted GitHub Actions run [#121](https://github.com/hungthinh1104/BA_Helper/actions/runs/40429982126) passed at the base SHA. It predates the G2B CI step and does not certify this candidate.
- Reused the production `scanProject` and `buildGraph`, direct trace evaluators, Jest semantic extractor tests, and static graph benchmark. No second analyzer or test platform was introduced.

### 2. Implemented changes

- Added ten source-authored baseline/transformation cases: a same-method decoy file, import alias, target substitution, import without invocation, line shift, nested call, file move, dynamic test reference, dynamic production reference, and unresolved injection with a same-name decoy.
- The graph builder now recognizes computed element-access calls as unresolved candidates. Dynamic Jest calls emit `TEST_TARGET_UNRESOLVED / DYNAMIC_METHOD_REFERENCE`; computed production calls on a resolved receiver emit `UNRESOLVED_METHOD_TARGET / DYNAMIC_METHOD_REFERENCE`. Neither creates a confident edge.
- The harness compares expected and observed relationships, diagnostics, exact source lines, source-audit results, deltas, and source hashes. It removes each temporary fixture in `finally` and never executes fixture code.
- Added negative sensitivity checks for a forged target identity and a valid edge whose source location is deliberately moved to a non-call line. The machine report records the base commit and a source-delta digest for the dirty candidate.
- Added one `verify:adversarial-evidence` script and one CI step; the generated JSON is included in the existing analyzer artifact upload.

### 3. Adversarial results

The final run reports **10/10 mandatory properties passed**, **15/15 source locations valid**, **0 false supported relationships**, **0 missing expected relationships**, and **3/3 unresolved cases handled without confident edges**. The forged-location probe was rejected with `TARGET_CALL_NOT_AT_REPORTED_LOCATION`. The fixture versions and full case outcomes are in `artifacts/evaluation/adversarial-evidence-verification.json`.

### 4. Reproduced defect

With the base graph builder restored temporarily, the new adversarial verifier failed **2 of 10** properties. A computed Jest call produced only the generic `NO_SUPPORTED_DIRECT_REFERENCE` diagnostic at the test declaration line; a computed production call produced no unresolved diagnostic. The cause was that graph extraction continued past every call whose callee was not a `PropertyAccessExpression`.

The fix handles `ElementAccessExpression` before the property-access path, checks the receiver using existing resolver APIs, and emits a bounded unresolved diagnostic without inventing a `TESTS` or `CALLS` edge. The post-fix cases and the full analyzer suite pass.

### 5. Performance

Measured on Windows x64 with Node 22.23.3, Intel Core 5 120U, 12 logical CPUs, and 16.86 GB reported memory:

| Measure | Baseline | Candidate | Observation |
| --- | ---: | ---: | --- |
| Analyzer Jest suite | 45 suites / 272 tests, 19.135 s default workers | 46 suites / 285 tests; default-worker samples 9.32 s, 24.925 s, and 10.788 s; `--runInBand` 29.486 s | One default-worker sample exceeded baseline; the later sample was below it. Worker modes are not comparable, and no repeatable suite-level regression is established. |
| 800-case graph scan p95 | 1,068.96 ms | 1,027.85 ms | -3.9%, below the investigation heuristic. |
| 800-case graph build p95 | 481.93 ms | 448.08 ms | -7.0%. |
| 800-case output digest | `742bd8d7f43723b49c95f1bf923c97a0b289afd89ca635e8e77a95b2312795a9` | Same digest | Synthetic graph output unchanged. |
| Adversarial harness | Not present | 1,394 ms measured suite duration | Ten cases; temporary source copies are isolated. |

The harness process sampled RSS at 129,191,936 bytes before and 160,927,744 bytes after, and heap use at 52,980,048 and 62,796,488 bytes. These are process snapshots, not peak or incremental per-endpoint memory. The graph benchmark's 800-case p95 samples came from three scan passes and five graph passes on Windows x64 with Node 22.23.3, Intel Core 5 120U, 12 logical CPUs, and 16.86 GB reported memory. No capacity or production-latency claim is made.

### 6. Verification

| Command or check | Result |
| --- | --- |
| `pnpm verify:adversarial-evidence` | PASS: 10/10; 15/15 locations; 0 false or missing edges; provenance tamper rejected. |
| `pnpm exec jest --config jest.analyzer.config.ts --runInBand --runTestsByPath packages/analyzer/tests/graph/adversarial-evidence.spec.ts` | PASS: 1 suite, 13 tests. |
| `pnpm test:analyzer --runInBand` | PASS: 46 suites, 285 tests, 29.486 s; not comparable with the default-worker baseline. |
| `pnpm test:analyzer` | PASS in three default-worker samples: 46 suites, 285 tests; 9.32 s, 24.925 s, and 10.788 s. The 24.925 s sample was not repeated; baseline was 19.135 s. |
| `pnpm verify:analyzer-quality` | PASS: 1 suite, 1 test. |
| `pnpm verify:public-test-trace` | PASS: 22 cases, 24 TESTS, 10 CALLS, 34/34 source locations; semantic behavior regression passed. |
| `pnpm verify:application-test-trace` | PASS: 27 cases, 28 TESTS, 22 CALLS, 50/50 source locations. |
| `pnpm benchmark:static-test-graph -- ci` | PASS: 800-case p95 scan 1,027.85 ms, graph 448.08 ms; baseline output digest preserved. |
| `pnpm typecheck` | PASS across backend, web, and scripts; after the later source-digest helper change, `pnpm typecheck:scripts` also passed. |
| `pnpm lint` | PASS, 61 existing type-only-import warnings and 0 errors; focused ESLint on the changed G2B files also passed. |
| `pnpm test:ci` | PASS: 231 suites, 1,348 tests, 1 snapshot. |
| `pnpm test:web` | PASS: 28 suites, 137 tests. |
| Focused comprehension API E2E | PASS: 1 suite, 11 tests on isolated PostgreSQL and Redis. |
| `pnpm test:e2e` | PASS: 22 suites, 132 tests on isolated PostgreSQL and Redis. |
| `pnpm prove:pinned-comprehension` | PASS: 18/18 declared tests and 21/21 direct cases; independent review remains pending. |
| `pnpm verify:pinned-comprehension-browser` | PASS: five repeated runs; browser assertions and server cleanup passed. |
| `git diff --check` | PASS with expected CRLF conversion notices. |
| Hosted CI for this uncommitted candidate | Not run. Run #121 certifies only the base SHA. |

The temporary `os.userInfo()` shim was needed because Node 22.23.3 raises `ENOMEM` in this Windows environment. It was removed after verification. No test was treated as passed when skipped.

### 7. Remaining risks

- Ten deterministic synthetic cases are not independent repository ground truth and do not estimate general analyzer accuracy.
- The fix covers dynamic element access on resolvable receivers; other dynamic dispatch remains unsupported and must stay unknown.
- Static evidence does not establish runtime execution, Jest pass/fail, coverage, or human understanding.
- The candidate CI workflow change has not run on a hosted commit. GitHub Actions #121 passed only on the base SHA; local tests do not certify the hosted candidate workflow.

### 8. Decision

**PARTIAL.** The selected L0-L2 properties, negative relationship check, provenance rejection check, local analyzer/regression gates, persistence-backed E2E, and pinned API/browser proof pass. Hosted CI for this uncommitted candidate remains unavailable, so `AUTO_LITE_PASS` is not supported yet. The suite makes no human-accuracy or product-value claim.
