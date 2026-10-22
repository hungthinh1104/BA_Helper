# Local analyzer verification, October 21, 2026

Historical local verification record. It captures the October 21 working tree
based on commit `0ac83a7b5f585232ba276e15b3f0787954113584`; it is not evidence
for the current checkout. The follow-up in this file measured `analyzer@0.7.0`;
the current analyzer contract is `analyzer@0.10.0`. The original `0.6.1` results are
retained as the earlier measurement.

## Source and environment

- Base commit: `0ac83a7b5f585232ba276e15b3f0787954113584`, branch `main`,
  with uncommitted changes including the earlier release/trace work.
- Analyzer version: `analyzer@0.6.1`; Node `22.23.3`, pnpm `11.5.1` on Windows.
- Existing PostgreSQL and Redis services were healthy. Database test suites and
  the quality gate ran sequentially against the test database.
- Hosted CI certification on a reviewed committed revision remains pending.

## Changes verified

Added pinned Amplication and Novu application source slices with source-authored
ground truth frozen before the first analyzer run. Raw upstream blob hashes and
the label digest are checked on every evaluation. External source is parsed,
never executed; its dependencies are not installed.

Measured fixes preserve private/protected Injectable service method artifacts
and resolve static test references through a bounded local constructor factory.
The legacy fixture scanner also defaults to the version under test.
Negative tests reject ambiguous/dynamic factories and preserve controller
visibility rules. See [application evaluation](../evaluation/application-test-trace.md)
for exact pins, units, before/after results and remaining limitations.

## Executed checks

| Command | Result | Local log |
| --- | --- | --- |
| `pnpm typecheck` | PASS, backend and web | `tmp/p1-application-typecheck.log` |
| `pnpm lint` | PASS, existing type-import warnings remain | `tmp/p1-application-lint.log` |
| `pnpm test` | 202 suites, 1,128 tests, one snapshot passed | `tmp/p1-application-full-tests.log` |
| `pnpm test:analyzer --runInBand` | 38 suites, 199 tests passed | `tmp/p1-application-analyzer-tests.log` |
| `pnpm test:e2e` | 18 suites, 103 tests passed | `tmp/p1-application-e2e.log` |
| `pnpm verify:analyzer-quality` | PASS, existing thresholds unchanged | `tmp/p1-application-quality.log` |
| `pnpm verify:public-test-trace` | PASS, 22 cases / 10 CALLS / 24 TESTS | `tmp/p1-public-pilot-regression.log` |
| `pnpm verify:application-test-trace` | Regression PASS; accuracy INCOMPLETE | `tmp/p1-application-gate.log` |
| `pnpm verify:architecture-boundaries` | PASS | `tmp/p1-application-boundaries.log` |
| `git diff --check` | PASS | Executed after verification |

The new focused tests first reproduced three failures, then all 13 passed
after implementation. Full tests also cover the application regression policy:
new misses, false positives, edited labels and a reduced expected universe fail.
The generated tracked benchmark report was restored after the test run;
dependency lockfiles were unchanged.

## Remaining work

Application CALLS improved from 20/22 to 22/22 and TESTS from 21/28 to 24/28;
no false positives were observed within the selected scope. Four `it.each`
source declarations and their four references are still missed and reported as
unsupported. They are the only misses permitted by the separate regression
policy. Raw accuracy remains FAIL until all desired relationships are found.

These selected-source results need independent human adjudication and do not
measure full-application impact reasoning or reviewer effectiveness. P3 still
requires real reviewers under the counterbalanced protocol. Browser and Docker
drill evidence for the earlier working tree is recorded in
[October 20 verification](local-verification-2026-10-20.md); run the release
pipeline on the reviewed committed revision for certification.

## Analyzer 0.7.0 follow-up

### Delivered

- Closed all four source-audited inline-array `it.each` misses without changing
  the frozen ground truth. The application corpus now finds 27/27 declarations,
  28/28 TESTS and 22/22 CALLS, with zero false positives. Its regression policy
  permits zero misses; the former exception lists are empty.
- Added optional `testCase.parameterized` metadata from parser to persistence,
  QA and frozen reports. Live/saved UI and Markdown/PDF explain that rows are
  unexpanded. Literal identities and historical metadata remain unchanged.
  Parameterized identity includes a distinct tag; table edits change content
  hashes. Empty tables remain source declarations and imply no execution.
- Consolidated fixture/selected-file extraction and default coverage into one
  implementation, reducing `scanner.ts` from 219 to 88 lines. File selection,
  canonical paths, source keys and supported class visibility remain tested.
- Extended the reviewer protocol with unexpanded/empty-table cases. Reviewer
  observations and product-effectiveness measurements remain outstanding.

### Executed checks

| Check | Result | Local log |
| --- | --- | --- |
| Root tests | 204 suites, 1,147 tests, one snapshot passed | `tmp/p2-each-root-tests.log` |
| Analyzer tests | 39 suites, 213 tests passed | `tmp/p2-each-analyzer.log` |
| Web tests | 21 suites, 101 tests passed | `tmp/p2-each-web-all.log` |
| API E2E | 18 suites, 103 tests passed | `tmp/p2-each-api-e2e-final.log` |
| Real browser | Three scenarios passed, including frozen parameterized metadata after live-edge deletion | `tmp/p2-each-browser-final.log` |
| Typecheck | Backend and web passed after the final test-helper changes | `tmp/p2-each-final-typecheck.log` |
| Lint | Passed; existing 57 API and five runtime type-import warnings | `tmp/p2-each-lint.log` |
| Quality gate | Passed with existing thresholds | `tmp/p2-each-quality.log` |
| Public sample corpus | 22/22 declarations, 24/24 TESTS, 10/10 CALLS | `tmp/p2-each-public-gate.log` |
| Application corpus | 27/27 declarations, 28/28 TESTS, 22/22 CALLS | `tmp/p2-each-application-gate.log` |
| Architecture boundaries | Passed | `tmp/p2-each-boundaries.log` |
| Production Docker drill | 11 PASS, one explicit SKIP for live AI credentials; fresh 31-migration database, restart and backup/restore checks passed | `tmp/p2-each-release-drill.log` |

Docker rebuilt API/worker/web images from the final source. The drill returned
`PASS_WITH_SKIPS` and cleaned its isolated project. Live scan/analyze/finalize/
export with a real AI provider remains unexecuted because credentials are
absent; curated fake-provider checks do not replace that verification. The
artifact is `artifacts/release/production-release-drill.json`.

### Failures found and addressed

The initial API E2E run had one timeout in the multi-request account lifecycle
test. A focused measurement recorded **7,025 ms**, exceeding its inherited
5,000 ms limit. The test now has a scoped 30-second budget for real scrypt,
HTTP and audit operations. Its complete assertions remain; production password
parameters were not changed. The full rerun passed 103/103. Initial failure:
`tmp/p2-each-api-e2e.log`; measurement: `tmp/p2-auth-lifecycle-timing.json`.

The initial browser run found a duplicate text locator because both Markdown
and the saved trace correctly rendered the new notice. The assertion now
targets the saved trace region. The first cold development load also timed out
while the login field was disabled awaiting hydration; its trace captured HMR
reload activity before any session request. The helper now explicitly awaits
an editable form with a bounded readiness budget. The final run passed all
three scenarios. Original traces are retained in
`tmp/p2-keyboard-initial-trace.zip` and `tmp/p2-report-initial-trace.zip`.

The ground-truth digest remains
`d87059c07d9f36a4ae61e58515230aaf9bdcea96d65ac8a1bddd0fdd206c013f`.
Human adjudication, reviewer A/B observations, and hosted CI on a reviewed
committed revision remain outstanding. These measurements cover the listed
source slices; they do not certify whole-application impact accuracy.

## Accuracy-integrity and API boundary follow-up

### Evaluation integrity

- Both source-trace scorecards now calculate precision, recall and F1 with
  `null` for empty expected/predicted universes. A graded production symbol
  that resolves to multiple selected source artifacts fails the gate instead
  of receiving symbol-only credit.
- Every emitted direct CALLS/TESTS relationship is checked for the pinned
  source file, source-artifact line range and target call token. This is
  provenance integrity, not independent proof that the relationship is
  business-relevant or executed.
- The unsupported-pattern rate includes parser-diagnosed declarations only;
  undiagnosed syntax is not observable in that denominator.
- Current public slice: 22/22 cases, 10/10 CALLS, 24/24 TESTS, F1 1.00 in all
  three universes, and 34/34 direct-edge evidence checks. Current selected
  application slice: 27/27 cases, 22/22 CALLS, 28/28 TESTS, F1 1.00 in all
  three universes, and 50/50 evidence checks. Both report zero identity
  ambiguities. Ground truth remains source-read and frozen, not independently
  human-adjudicated.
- One-run selected-slice scan/graph timings were 297/253/154 ms for the three
  public repositories and 575/276 ms for Amplication/Novu. These are single
  samples, not latency distributions or a scale benchmark; memory was not
  measured. Full scope, source pins and metric limitations are in the
  [public](../evaluation/static-test-trace.md) and
  [application](../evaluation/application-test-trace.md) evaluation reports.

### API boundary fixes

- `/api/v1/workspace/current` now permits anonymous bootstrap but validates
  any supplied bearer token through the normal JWT strategy. Expired, revoked,
  malformed or disabled-user tokens receive 401 instead of bypassing those
  checks through a separate manual verification path. Legacy tokens without a
  credentials version remain supported.
- Zod request parsing now maps malformed bodies and query parameters to a
  generic 400 response without returning input values or validation issues.
  Response-contract parsing still fails server-side when the implementation
  returns an invalid DTO.
- OpenAPI documents the optional-auth behavior and generic validation response.

### Final local checks for this follow-up

| Check | Result |
| --- | --- |
| Root tests | 212 suites, 1,185 tests, one snapshot passed |
| API E2E | 20 suites, 120 tests passed |
| Web tests | 22 suites, 105 tests passed |
| Focused API/evaluator regression tests | 5 suites, 24 tests passed |
| Public/application source-trace verifiers | Both PASS; counts and limits above |
| `pnpm verify:analyzer-quality` | PASS; critical/overall artifact recall 1.00, evidence coverage 1.00, negative controls 1.00, artifact precision 0.975 |
| `pnpm verify:architecture-boundaries` | PASS; backend-runtime duplication boundary passed |
| API production TypeScript build | PASS (`pnpm --dir apps/api build`) |
| Typecheck | Backend and web PASS |
| Lint | PASS, zero errors; 57 API and five backend-runtime type-import warnings remain |
| `git diff --check` | PASS; Git reported working-tree line-ending normalization warnings |

This remains local worktree evidence. It does not certify hosted CI or a
reviewed committed revision. Independent adjudication, held-out repository
evaluation, repeated latency/memory measurements, reviewer-effectiveness
study, and live-provider workflow validation remain open. Do not interpret the
100% source-slice metrics as whole-application impact accuracy.
