# Local release hardening verification, October 26, 2026

## Latest hosted verification — run #118 passed

Commit `59d6c5d6988bfe3907dee75f0734ffb69a74ffd7` is the local and remote
branch tip. GitHub Actions
[#118](https://github.com/hungthinh1104/BA_Helper/actions/runs/40349912038)
passed all 46 workflow steps, including production dependency advisories,
migrations, analyzer and trace gates, scalability, architecture boundaries,
lint, typecheck, builds, tests, demos, browser journeys, persisted proof, and
the required pinned browser proof. The code-bearing parent commit also passed
all 46 steps in run #117; #118 revalidated its documentation-only descendant.
Run #118 uploaded `browser-review-results` (artifact
[12663912089](https://github.com/hungthinh1104/BA_Helper/actions/runs/40349912038/artifacts/12663912089),
including `artifacts/evaluation/pinned-code-comprehension-proof.json`) and
`analyzer-quality-scorecard` (artifact
[12663221854](https://github.com/hungthinh1104/BA_Helper/actions/runs/40349912038/artifacts/12663221854)).
The ordinary browser-review command keeps the pinned corpus case opt-in; the
separate required pinned browser command ran five real-browser samples and
completed successfully.

The pinned proof used a clean tool checkout at `59d6c5d`, corpus
`leosuncin/nest-api-example` at
`b49ae92a6c0b0db39b6542338a2ffea3eda15717`, and analyzer `0.15.0`. It scanned
108 files and persisted 246 artifacts, 96 edges, and 246 evidence records with
zero dropped edges. Five measured scan passes after one warm-up produced the
same digest on all six passes:
`9200c1684cf0f707491cff90ead6dc1f32b33bed2aeaf3e81c40d4f9ead93880`.
Persisted projection checks covered 5 source evidence items, 8 relationships,
and 7 source files. The live API/browser proof validated 25 responses over five
samples against the same snapshot and commit.

The latest pinned scan still reports 122 `TEST_TARGET_UNRESOLVED` diagnostics
(118 `NO_SUPPORTED_DIRECT_REFERENCE`, 4 `METHOD_ARTIFACT_NOT_EXTRACTED`), 7
`UNRESOLVED_INJECTION_TOKEN` diagnostics (`IMPORT_RESOLUTION_FAILED`), 3
`UNRESOLVED_METHOD_TARGET` diagnostics, 357 unresolved semantic behavior
claims, and 1 unsupported Jest declaration. The behavior diagnostics include
183 nested callbacks, 130 unresolved action receivers, 16 unresolved mock
identities, and 11 unresolved assertion invocations. These counts describe
explicit gaps; aggregate edge totals and zero dropped edges do not establish
precision or recall.

### Latest hosted performance samples

The scan ran on Linux with Node `v22.23.3`, an AMD EPYC 9V45 runner reporting 4
logical cores and 16,766,414,848 bytes of system memory. One warm-up and five
measured passes shared a process; filesystem/runtime caches were warm after the
first pass. Scan p50/p95 was 371/423 ms, graph construction 211/239 ms, and
end-to-end enumeration, scan, and graph 581/687 ms. This is a small CI sample,
not a capacity benchmark.

| Projection condition | Samples | p50 / p95 | Database work and response |
| --- | ---: | ---: | --- |
| Fresh Node processes; initialization excluded from timed projection | 5 | 106.85 / 113.26 ms | 12 queries, 16 rows, 22,457 bytes per sample |
| Warm database pool; projection cache miss | 10 | 7.58 / 8.78 ms | 12 queries, 16 rows per sample |
| Populated projection cache hit | 10 | 1.20 / 2.11 ms | 2 queries, 2 rows per sample |

For the fresh-process projection, RSS p50 before/after was 316/364 MB and
heap-used p50 was 163/169 MB. These are process snapshots, not incremental
endpoint memory. Five browser samples each covered five API responses totaling
127,449 bytes. Browser p50/p95 was 2,442/4,514 ms to usable; 61/86 ms to expand
a scenario; 379/393 ms for graph readiness; 64/70 ms for evidence inspection;
2,367/2,416 ms for method switching; and 439/447 ms for scenario switching.
The first-use development-server sample affects time-to-usable p95; these
browser measurements do not establish production latency.

The Vercel status for this SHA is separately `failure` at deployment
`dpl_7KpxkPLUsKrT9173AjGp3otnH2ms`:
[deployment details](https://vercel.com/diphungthinh-projects/ba-helper-web/7KpxkPLUsKrT9173AjGp3otnH2ms).
The page/logs are inaccessible in this environment, and neither the Vercel CLI
nor a Vercel token is configured here, so the cause remains unverified. This is
not a failed GitHub Actions run.

Focused local checks on the same code-bearing source tree passed: API/repository
unit tests, 4 suites / 32 tests; Code Evidence Navigator integration, 1 suite /
11 tests. The public trace gate passed 22/22 cases, 24/24 `TESTS`, 10/10
`CALLS`, zero false positives/misses, and evidence integrity 34/34. The
application trace gate passed 27/27 cases, 28/28 `TESTS`, 22/22 `CALLS`, zero
false positives/misses, and evidence integrity 50/50. These fixed selected
source sets are not independent human adjudication or a general accuracy
estimate.

G1 remains **PARTIAL**: the October 24 report records 18/18 links, but its exact
label list is not checked in, so that score cannot be rerun against
analyzer@0.15.0. The pinned scan still has unresolved relationships, and the
Vercel deployment failure remains unexplained. G2 remains **NOT READY** because
no reviewer-study observations exist.

## Previous hosted verification — run #115 passed

Commit `62f10cc3e751570c593db127816d649f0460a7c1` passed hosted workflow
[#115](https://github.com/hungthinh1104/BA_Helper/actions/runs/40339953306)
on 2026-10-26. Every step passed, including production dependency advisories,
analyzer quality and corpus gates, scalability, boundaries, migration upgrade,
lint, typecheck, all builds, all test suites, E2E, golden-path demos, browser
review journeys, and both persisted and browser pinned-repository proofs.

Hosted test totals: Analyzer 45 suites / 272 tests; App 229 / 1,329 tests / 1
snapshot; Web 26 / 126 tests; E2E 22 / 132 tests. The analyzer package build
step passed before backend-runtime, and the pinned proof completed after the
previous missing-dist failure. This certifies the workflow at `62f10cc`; the
remaining accuracy limits below still apply.

## Follow-up after hosted run #112

The first release-hardening commit `333ff432c3e0fbff83b6734dd9dca29b89ea37c1`
was pushed. Hosted workflow run #112 failed in **Analyzer tests** because the
golden source offsets were produced from CRLF checkouts while Linux CI checked
out LF. The source text, line/column coordinates, and hashes matched; only
UTF-16 offsets differed. Reproducing this exposed a second issue: the scanner
parsed normalized LF text, while `GraphSourceResolver` independently loaded raw
CRLF text, so late-in-test call spans could miss `TESTS` edges.

The first follow-up commit `1cfc671dda7fe161b28ad09264ef059540445030` passed
hosted analyzer gates, lint, typecheck, all builds, and Analyzer tests, but run
#113 then failed one app test: `runtime-config.spec.ts` built a production
config from an explicit env object but validated it against the CI process
environment, where `ENABLE_DEV_LOGIN=true` is intentionally set. I reproduced
the failure with that environment and fixed the test to pass an explicit
`ENABLE_DEV_LOGIN=false` env to both config creation and validation. The
focused regression now passes 32/32 tests with the outer CI-style variable set
to true.

Hosted run #114 passed App tests, E2E, both golden-path demos, and browser
journeys, but failed while persisting the pinned proof: CI had not built
`@ba-helper/analyzer`, whose package entry is `dist/index.js` and which the
runtime proof imports through `@ba-helper/backend-runtime`. I reproduced the
missing-module error by temporarily removing the generated analyzer `dist`
directory, then restored it; `pnpm --filter @ba-helper/analyzer build` followed
by a runtime import passed. The workflow now explicitly builds the analyzer
before backend-runtime. Hosted run #115 passed this path and the full workflow.

The follow-up normalizes accepted TypeScript source to LF before both scanner
and graph parsing, defines source offsets against that canonical decoded text,
and bumps `ANALYZER_VERSION` to `analyzer@0.15.0`. Consumers opening working
files with other line endings should map by the persisted line/column values.
Regression cases compare LF and CRLF artifacts, graph edges, and source slices,
including a call near the end of a long test body. The pinned corpus was scanned
again at `leosuncin/nest-api-example@b49ae92a6c0b0db39b6542338a2ffea3eda15717`;
its API-backed browser flow passed 5/5 samples and server cleanup passed.

Latest pinned scan: 108 files, 246 artifacts, 96 edges (43 `TESTS`, 19
`CALLS`, 34 `USES`), 246 evidence records, and 0 dropped edges. Six same-process
outputs had the same digest. Five measured passes gave scan p50/p95
786/945 ms, graph 698/853 ms, and combined enumeration/scan/graph 1,587/1,912
ms. This is one local run, not a controlled benchmark; its combined p50 is near
the earlier approximate 2-second scan-plus-graph baseline. Browser samples
used the pinned commit and a 127,449-byte response; time-to-usable p50 was
2,639 ms and p95 12,057 ms due to first-use development compilation. These
figures do not establish production capacity.

The follow-up analyzer suite passed 45 suites / 272 tests, and typecheck passed
after the graph-loader correction. Full workspace lint and build also passed
after that correction; lint retained 61 pre-existing
`consistent-type-imports` warnings and no errors. The full `test:ci` result
(229 suites / 1,329 tests / 1 snapshot) and full E2E result (22 suites / 132
tests) were run before that final graph-loader correction; they are not
represented as post-fix runs. Hosted run #113 exposed the test env leak; #114
passed App tests, E2E, demos, and browser journeys but failed on the missing
analyzer runtime build. Run #115 passed all tests and workflow steps, including
the pinned real-repository proof. The env regression passes locally with CI's
outer `ENABLE_DEV_LOGIN=true`; the analyzer build and runtime package import
also pass locally. This addendum
supersedes later statements in this report that no first hosted run existed.

Remaining pinned diagnostics are still explicit: 122 unresolved test targets,
357 unresolved behavior claims, 7 unresolved injection tokens, and 3 unresolved
method targets. The manually labeled 18-link score was not rerun after this
follow-up, so these graph totals do not establish precision or recall. G1 stays
**PARTIAL** until the labeled edge evaluation is rerun against analyzer@0.15.0.

The original local-verification sections below record the pre-follow-up tree at
`27b388a`; rows labeled “Current” refer to that historical run. The addendum
above supersedes them for current analyzer version, pinned proof, CI status, and
post-fix checks.

## Initial checks before line-ending follow-up

This records local results for the initial release-hardening tree on branch
`codex/fix-backend-runtime-ci-boundary`, based on HEAD
`27b388adc25638e0c9737578872baf71e9aa0d2a`. It is not hosted CI certification
or a broad accuracy claim. No target repository dependencies or tests were
installed or executed.

## Changes verified

- Artifact browsing uses bounded, snapshot-scoped pages and reports the limit
  instead of silently implying that the full index was shown.
- Code comprehension marks output truncated only when data was actually omitted
  or a bounded analysis reports a limit. Tests cover exact and exceeded edge,
  dependency, and relationship limits. A retrievable next scenario page no
  longer sets the truncation flag; the offset ceiling still does.
- The backend-runtime HTTP boundary check parses TypeScript imports and
  decorators. This avoids the former text search matching decorator-like text
  inside a test fixture string; it also catches inline CommonJS reads of Nest
  HTTP symbols while allowing same-named properties from local modules.
- The pinned proof summary now includes bounded file-enumerator diagnostics
  alongside scanner diagnostics, matching the diagnostics persisted with the
  scan.
- API and browser proof runners verify source provenance, snapshot/commit
  identity, response contracts, browser navigation, and cleanup.

## Checks

Rows below record the latest local checks after the pagination-status correction. Earlier rows are retained as historical results where noted.

| Check | Result |
| --- | --- |
| Earlier analyzer regression suite | 45 suites, 270 tests passed after the final proof-harness and catch-source regression changes |
| Current pnpm typecheck | Passed for backend, web, and scripts after the pagination correction |
| Current `pnpm lint` | Passed with 61 existing `consistent-type-imports` warnings and no errors (5 backend-runtime, 56 API); changed files lint clean |
| Current `pnpm build` | Passed for all 8 workspace projects with `NEXT_BUILD_DIST_DIR=.next-g1-verification`; Next's generated `tsconfig.json` include entries were removed after the build. |
| Current analyzer quality gate | Passed via `ts-node --transpile-only`: critical/overall recall 1.0, evidence coverage 1.0, negative-control pass 1.0, orphan claims 0, artifact precision 0.975. The `tsx` wrapper attempt failed before test startup with Windows `uv_os_get_passwd ENOMEM`. |
| Current public/application trace gates | Passed via `ts-node --transpile-only`: public 22/22 cases, 10/10 CALLS, 24/24 TESTS, 34/34 evidence, 13/13 semantic claims, 4/4 unsupported patterns; application 27/27 cases, 22/22 CALLS, 28/28 TESTS, 50/50 evidence |
| Current architecture and HTTP boundaries | Passed via `ts-node --transpile-only`, including backend-runtime duplication and HTTP AST checks |
| Current pinned proof and browser proof | Passed in required order on snapshot `7b23b1ae-acd4-4438-b3a4-ab2723175552`; 25 API responses validated, 5/5 browser samples passed, runner exit code 0 and server cleanup passed |
| Current `pnpm test:ci` | 229 suites, 1,327 tests, 1 snapshot passed in 276.675 s |
| Earlier pnpm test | 234 suites, 1,335 tests, 1 snapshot passed (full root suite before the pagination correction) |
| Earlier pnpm test:web | 26 suites, 126 tests passed before the pagination correction |
| Current pnpm test:e2e | 22 suites, 132 tests passed in 259.787 s after the pagination correction |
| Focused comprehension, pagination, API controller, and artifact repository tests | 4 suites, 32 tests passed after the final review fixes |
| After pagination fix: comprehension/use-case/controller unit tests | 3 suites, 29 tests passed |
| After pagination fix: backend typecheck and changed-file ESLint | Both passed |
| After pagination fix: PostgreSQL comprehension E2E | 1 suite, 11 tests passed; persisted 49/50/51-case pages with two TESTS edges per case, plus 80 callers, 561 TESTS edges, five cache misses and ten cache hits |
| `pnpm verify:backend-runtime-http-boundary` | Passed (TypeScript AST check) |
| Final boundary and proof-diagnostic regression tests | 2 suites, 16 tests passed, including inline `require('@nestjs/common').Controller` and file-enumerator proof diagnostics |
| `pnpm test scripts/verify-backend-runtime-http-boundary.spec.ts` | Earlier run: 1 suite, 12 positive/negative boundary cases passed |
| Current migration upgrade / data survival | Passed by `ts-node --transpile-only scripts/verify-migration-upgrade.ts`; the `tsx` wrapper could not start because Node returned `uv_os_get_passwd ENOMEM` on this Windows worker |
| Architecture boundary scripts | Passed, including backend-runtime duplication check. The `tsx` wrapper retry failed before script startup with Windows `uv_os_get_passwd ENOMEM`; invoking both scripts through `ts-node --transpile-only` passed. |
| `pnpm benchmark:static-test-graph -- ci` | Passed; 800-case scan p50/p95 2,262/2,514 ms, graph p50/p95 804/1,044 ms |
| `pnpm demo:golden-path` | Passed, 1/1 |
| `pnpm demo:multi-repo-golden-path` | Passed, 1/1 |
| `pnpm test:pw --reporter=line` with prestarted API/worker/web servers and `PW_PRESTARTED_SERVERS=1` | Passed: 6 browser tests; the pinned proof case was the single intentional opt-in skip. Exit code 0. The pinned case passed separately through the required proof command above. |
| Default `pnpm test:pw --reporter=line` webServer lifecycle | Not verified on this Windows worker: three runs completed the mobile test/teardown but did not exit after web-server shutdown began. They are not counted as passes. The explicit pinned runner's managed server cleanup did pass. A one-test local repro completed all four expected HTTP assertions and Playwright fixture teardown, then logged `Terminating the WebServer` while both test-owned servers remained live. Direct `taskkill /PID <test-owned-wrapper> /T /F` returned `Access denied` in the managed Windows worker; this is consistent with sandbox process-tree termination restrictions, so it does not establish an application teardown defect or count as a pass. |
| Production dependency audit | Not rerun locally: the required npm advisory request was rejected by automatic approval review because it would disclose dependency metadata. The earlier hosted run on this HEAD passed its production advisory step. |
| `git diff --check` | Passed; Git reported only existing LF/CRLF conversion notices |

The inspected hosted CI failure was run `40164089216` / workflow run
`#111`: the old recursive text check matched `@Post('cancel')` inside a string
fixture. The replacement AST verifier passes locally. GitHub's job details confirm
production dependency advisories passed at step 7, then the backend-runtime
boundary check failed at step 17; boundary duplication, migration, lint,
typecheck, builds, analyzer/app/web/E2E, and browser steps 18-34 were skipped.
Remote `main` at `27b388a` still contains the old check. At the time of run
#111, the release-hardening branch had not yet been pushed. The first hardening
commit was later pushed; its run #112 failure and the follow-up are recorded at
the top of this report. The base commit's combined status reports a Vercel
failure.

## Initial pinned repository evidence (analyzer@0.14.0)

The proof used `leosuncin/nest-api-example` at
`b49ae92a6c0b0db39b6542338a2ffea3eda15717`. It scanned source with the
production file enumerator, scanner, and graph builder; it did not install
dependencies or execute repository code or tests.

- 108 scanned files, 246 artifacts, 96 graph edges (43 TESTS, 19 CALLS, 34
  USES), 246 evidence records, and 0 dropped edges.
- Deterministic output digest across one warm-up and 5 same-process measured runs:
  `d951094a44dee615289ad52daf364ccddf0d699b79c5a22eace012a8f24fe7fa`.
- Latest proof artifact snapshot: `7b23b1ae-acd4-4438-b3a4-ab2723175552`; tool HEAD `27b388adc25638e0c9737578872baf71e9aa0d2a`, with the worktree marked dirty in the proof JSON.
- Shape counts: 25 direct, 14 indirect, and 9 methods without a supported test
  link. Provenance verification checked 5 source evidence items, 8
  relationships, and 7 source files.
- API proof validated 25 responses totaling 640,835 bytes and validated the
  response contract, snapshot, and provenance. The latest required browser run
  passed all 5 samples with exit code 0 and server cleanup. Scenario expansion
  p50/p95 was 108/118 ms; graph readiness 568/602 ms; evidence inspection
  137/139 ms; method switching 4,189/4,321 ms; scenario switching 559/655 ms.
  Time-to-usable p50/p95 was 4,389/17,480 ms; the p95 includes first-use
  development compilation. Each UI sample observed a 128,167-byte API response.
  The first browser-run attempt stopped before test execution because the
  Playwright child process could not resolve `pnpm` from `PATH`; a temporary
  local shim fixed the invocation, and the subsequent five-sample run passed.
- The latest scan proof used one unmeasured warm-up and five measured passes in
  one process. Source enumeration p50/p95 was 215/266 ms, scanner extraction
  1,160/1,352 ms, graph construction 874/982 ms, and end-to-end enumeration,
  scan, and graph 2,229/2,571 ms. The digest was identical across all six
  passes. This run is slower than the earlier same-day run and its approximate
  two-second scan-plus-graph baseline; it is a single-process measurement, not
  a controlled benchmark. The controlled `.12`/`.14` differential below still
  does not reproduce a twofold regression.
- The earlier release note's supposed `.12` baseline was mislabeled: commit
  `61762e4` actually contains scanner `0.6.0` / analyzer `0.12.0`; the note
  recorded `0.7.0` / `0.14.0`, which commit `f01f053` later introduced along
  with `codeEvidence` extraction. A controlled interleaved same-process
  differential (five measured samples per revision after warm-up) measured
  `.12` scan/graph p50 at 1,168/1,378 ms and `.14` at 1,587/1,106 ms. The sums
  of phase medians were 2,546 vs 2,693 ms (+6%), with maximum process RSS
  379.5 vs 382.4 MB. Both outputs had the same digest. This does not reproduce
  a twofold total slowdown: scanner time increased while graph time decreased.
  A temporary diagnostic A/B omitting code-evidence extraction showed scanner
  p50 1,139 ms versus 1,761 ms with it enabled, indicating material cost, but
  that variant is not a valid product output. Two single-pass traversal
  experiments (ts-morph and raw TypeScript) were slower and have been reverted.
  No optimization from those experiments remains.

The proof still reports unresolved items: 122 `TEST_TARGET_UNRESOLVED`
diagnostics (118 with no supported direct reference and 4 whose method artifact
was not extracted), 7 unresolved injection tokens, 3 unresolved method
targets, 357 unresolved semantic behavior claims, and 1 unsupported Jest
declaration. The latest enumeration emitted no file diagnostics; regression
coverage verifies those are included when present. These remain explicit;
the zero dropped-edge count is not a false-positive score. The previous
October 24 report records 18/18 manually labeled links for this corpus, but
that label evaluator was not rerun in this verification.

The pinned proof ran on Windows (`win32`) with Node v22.23.3, an Intel Core 5
120U (12 logical cores), and 16,856,768,512 bytes of reported system memory.
Projection measurements separate process initialization from repeated work:

| Projection condition | Samples | p50 / p95 | Database work |
| --- | ---: | ---: | --- |
| Fresh Node process; modules and DB connection initialized before timing | 5 | 343.25 / 381.04 ms | 12 queries, 16 returned rows per sample |
| First projection after scan; shared process and DB pool | 1 | 149.17 / 149.17 ms | 12 queries, 16 rows |
| Warm DB pool, projection cache miss | 10 | 42.95 / 54.07 ms | 12 queries, 16 rows per sample |
| Populated projection cache hit | 10 | 7.32 / 15.72 ms | 2 queries, 2 rows per sample |

The measured response was 22,643 bytes. RSS/heap samples are retained in the
proof JSON, but are noisy process snapshots and do not establish incremental
endpoint memory. These local samples are not a capacity benchmark.

Running the browser proof by itself against an older artifact initially failed
because that artifact referenced a pinned project no longer present in the
isolated test database. Regenerating the pinned proof before the browser run,
as the CI workflow does, produced a persisted project and a passing 5/5 browser
verification. A stale artifact is therefore a hard failure, not a successful
skip.

## Review follow-ups

- The artifact search offset cap is exported once from `packages/contracts` and
  consumed by the API controller, persistence repository, and web pagination
  hook. The previous hook export remains as an alias for compatibility.
- The scenario pagination cases were moved into
  `get-code-comprehension.pagination.spec.ts`; the main comprehension behavior
  spec is now below the repository's 400-line review threshold. Shared setup
  lives in a test-only fixture module.
- `get-code-comprehension.usecase.ts` remains a large orchestration use case
  (459 lines). It coordinates one bounded, snapshot-scoped read and validates
  graph/evidence provenance before mapping a single response; mapper and
  persistence work remain in their existing boundaries. Splitting it now
  would add another service boundary without reducing repository
  responsibility, so this is an explicit local justification rather than a
  claim that the size is ideal.
- `LoginForm` exposes a client-ready DOM marker only after React mounts. The
  browser auth fixture waits for it so a click cannot land on server-rendered
  markup before the submit handler is attached. This test synchronization seam
  does not change authentication state or capabilities.

## Comprehension performance sample

The latest PostgreSQL-backed synthetic high-fanout E2E covered 80 caller
artifacts, 8 Jest cases, 80 CALLS edges, 561 TESTS edges, and 641 total edges.
The bounded response was 31,965 bytes with `truncated: false`. Five requests
used distinct scenario offsets to force projection cache misses against the
same graph on a warm database pool. They each issued 16 queries and returned
833 rows; the latest sample p50/p95 latency was 147.58/160.85 ms. The responses
contained 8, 7, 6, 5, and 4 scenarios and each reported `truncated: false`. Ten repeated
full-response cache hits measured p50/p95 25.69/45.32 ms, with 6 queries and 6
rows per response; these are full-request cache-hit timings, not projection
compute timings. A separate latest 12-request one-scenario sample measured
31.07/51.90 ms p50/p95 and returned 9,844-byte responses; its test does not record query
counts, so those timings are not used as a database-work measurement. The test
process reached 378,662,912 bytes RSS across the suite; this is not incremental
endpoint memory. The single-run persisted pagination matrix is a correctness check,
not a latency benchmark. These local synthetic samples are regression evidence, not a
capacity benchmark or pinned-repository high-fanout result.

## Remaining limits

- The local production dependency audit remains unverified because automatic
  approval review rejected the npm advisory request. The hosted production
  advisory step passed in run #115 for commit `62f10cc`.
- The manually labeled 18-link evaluation was not rerun in this record.
- The pinned corpus still has unresolved target and semantic diagnostics shown
  above. Fixture quality gates do not establish broad real-repository
  precision or business-rule correctness.
- The reviewer study has no participant observations; comprehension-time
  improvement is unverified.
- Browser timings include local Next.js development compilation, and the
  memory observations do not establish production capacity.
- The normal Playwright `webServer` teardown still does not exit on this
  Windows worker. The six ordinary browser tests pass with prestarted servers,
  and the separately managed required pinned browser run exits cleanly.
- Scan timings vary materially by run. The old recorded baseline revision and
  analyzer versions were inconsistent; the controlled `.12`/`.14` differential
  did not reproduce a twofold total slowdown, but scanner extraction regressed
  while graph time improved. Code-evidence extraction is a measurable cost;
  attempted one-pass rewrites were slower and were discarded. More repeated
  controlled profiling is still needed before making a performance or capacity
  claim.

## Release decision

**Historical decision at the time of the earlier local report: G1 PARTIAL; G2
NOT READY.** The latest hosted state is recorded at the top of this document.
The manually labeled 18-link result remains unreproducible because its exact
labels are not checked in. Performance samples distinguish fresh-process,
cache-miss, and cache-hit conditions, but remain small local samples and are
not a capacity benchmark. The Vercel deployment failure is separate from
GitHub Actions and still needs authorized project-log inspection.

The user authorized committing and pushing this branch; no merge authorization was given. Hosted GitHub Actions CI passed in run #118. The pinned-label, Vercel deployment, and reviewer-study limits above remain.
