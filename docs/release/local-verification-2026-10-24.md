# Engineering baseline and local verification, October 24, 2026

This record covers the current working tree and is evidence for the checks
listed below only. It is not hosted CI certification, a reviewer study, or a
general accuracy estimate.

## Scope

- Scanner/analyzer contracts: `scanner@0.7.0` / `analyzer@0.14.0`.
- External repositories were scanned from pinned local checkouts without
  installing their dependencies or executing their code/tests.
- Runtime observations were not imported into the static comprehension API.

## Baseline identity

- Repository HEAD: `61762e45351a83eec5d6fbf91028390c951a3ddc`; local `main` is
  aligned with `origin/main` at this inspection point.
- Analyzer versions: `scanner@0.7.0` / `analyzer@0.14.0`.
- Public trace ground-truth digest: `c2152a358eabeffea24209bf71f6dd2918d0a6dc7f28e4e1cb84c1ed1224a831`.
- Application trace ground-truth digest: `d87059c07d9f36a4ae61e58515230aaf9bdcea96d65ac8a1bddd0fdd206c013f`.
- Synthetic benchmark output digest:
  `742bd8d7f43723b49c95f1bf923c97a0b289afd89ca635e8e77a95b2312795a9`.

The reproducible local commands used for the current baseline were
`node_modules/.bin/jest.cmd --config jest.unit.config.ts --runInBand`,
`node_modules/.bin/jest.cmd --config jest.analyzer.config.ts --runInBand`,
`node_modules/.bin/jest.cmd --config jest.integration.config.ts --runInBand`,
the root Jest configuration with `node_modules/.bin/jest.cmd --runInBand`,
`pnpm@11.28.6 -r build`, `pnpm typecheck`, `pnpm lint`, and the benchmark
through `node -r ts-node/register/transpile-only
scripts/benchmark-static-test-graph.ts ci`.

## Results

| Check | Result |
| --- | --- |
| Analyzer tests | 45 suites, 270 tests passed |
| Focused analyzer/API tests | Passed, including semantic association, pagination/cache, graph, and persistence regressions |
| Runtime trace importer regression | Passed; 8 correlation/limit/provenance cases plus 5,000-case import performance fixture |
| Full unit suite | 221 suites, 1,268 tests passed; 1 snapshot passed |
| Root Jest suite | 227 suites, 1,281 tests passed; 1 snapshot passed in 296.46 s, including the golden-path drift payload bound and no-supported-test-reference regression |
| Web tests | 26 suites, 116 tests passed |
| Full API E2E | 21 suites, 123 tests passed in 189.059 s; a prior local run observed approximately 970 MB Node working set |
| Comprehension API E2E | 1 suite, 3 tests passed in 8.581 s against PostgreSQL/Redis |
| Backend and web typechecks | Passed |
| Workspace build (`pnpm@11.28.6 -r build`) | Passed; all 8 workspace projects built, including the comprehension route |
| Backend package/API builds | Passed |
| Next production build | Passed; comprehension route emitted |
| Architecture boundary checks | Passed; workspace graph and backend-runtime duplication checks (direct script invocation; the pnpm/tsx wrapper hit host `uv_os_get_passwd ENOMEM` before starting) |
| Backend lint | Passed with 62 pre-existing type-import warnings; no errors |
| Web lint | Passed |
| Analyzer quality gate | Passed; critical/overall recall 1.0, evidence coverage 1.0, negative-control pass 1.0, orphan claims 0, artifact precision 0.975 |
| Public static trace gate | Passed; 22/22 cases, 10/10 CALLS, 24/24 TESTS, source evidence 34/34; semantic claims 13/13 and unsupported declarations 4/4 |
| Application static trace gate | Passed; 27/27 cases, 22/22 CALLS, 28/28 TESTS, source evidence 50/50 |
| Product validation / SaaS entry gate | Focused tests passed; template CLI returned `INSUFFICIENT_OBSERVATIONS` / `INCONCLUSIVE`, and metric-only PROMOTE is locked unless all five tasks, 15 cells, 3 cases, and 3 sessions exist in both datasets |
| Integration Jest config | Passed the source-to-persistence-mapper fixture integration check; no DB-backed `*.integration-spec.ts` suite exists yet. |
| DB-backed comprehension E2E | Passed; 1 suite, 3 tests validate persisted source/semantic evidence, snapshot authorization, and the no-supported-reference limitation against PostgreSQL/Redis. |
| Drift projection bound | Passed; combined artifact samples are capped at 10 with explicit `samplesTruncated` metadata, and the golden-path payload remains under 5,000 serialized bytes |

After the final Jest behavior helper extraction, the analyzer suite was rerun
at 45 suites / 270 tests, the analyzer package build passed, and workspace
typecheck/lint remained green. The root Jest count above was rerun after the
no-supported-test-reference regression and includes that additional test.

## Pinned external corpus

- `leosuncin/nest-api-example` at
  `b49ae92a6c0b0db39b6542338a2ffea3eda15717`: 107 files, 246 artifacts,
  43 `TESTS`, 19 `CALLS`, 34 `USES`; 18/18 manually labeled test-to-method
  links recovered, zero false positives.
- `kchpp940/Nestjs-pg-crud` at
  `abe2d073c2dffddaac4a4cc46c2e8cc815fdbdcb`: 54 files, 146 artifacts;
  27/27 labeled links recovered, zero false positives.
- `kentloog/nestjs-sequelize-typescript` at
  `6ec21637a0ad70c8a4e7d9e2498cc8b284e3eb74`: 32 files, 56 artifacts;
  24/24 labeled links recovered, zero false positives after the evaluator
  retained nested suite identity for duplicate test titles.

The three corpus measurements were rerun with the current scanner and
`buildGraph` directly after the final AST changes. Each label is keyed by
canonical file path, full Jest suite path, and test title; the external
checkout is read-only and its dependencies are not resolved. The resulting
scan/graph digests were deterministic across two consecutive runs:

| Repository | Scan digest | Graph digest | Representative unresolved diagnostics |
| --- | --- | --- | --- |
| leosuncin | `06bb06c97478ddcf1aaaa86864c02f6b64b61273809a8778e91bc61910af9b2f` | `b19562474c8a151e1a223e96ad09a97e2c1ce69044b77f4f033c2b3ac3c153c2` | 118 no direct reference; 7 import-resolution injection tokens; 4 method artifact misses |
| kchpp940 | `4247defe2c0405d37b0e90d9789dd773d66c6abf37e3eedfad0901e06084bb73` | `5a746ce4cc51edc9bbf0ec0ba71558085a554ca35ada00bb9fb9891493d3cd8d` | 7 import-resolution injection tokens; 2 unresolved receivers |
| kentloog | `542607302268cf6b8254e1aa44651c9705df4f04bee0c65efdfe671a22323a29` | `0d7f64d54baed001939da229ff438fbbe3bcfba5c6f891542004ad6fbcc518f5` | 8 unresolved receivers; 2 import-resolution injection tokens |

These diagnostics remain visible in the scan output and do not create
fabricated relationships.

Full diagnostic counts from the same runs were: leosuncin
`JEST_BEHAVIOR_UNRESOLVED=357`, `JEST_UNSUPPORTED_DECLARATION=1`,
`TEST_TARGET_UNRESOLVED:NO_SUPPORTED_DIRECT_REFERENCE=118`,
`UNRESOLVED_INJECTION_TOKEN:IMPORT_RESOLUTION_FAILED=7`, and method-artifact
misses `4+3`; kchpp940 `JEST_BEHAVIOR_UNRESOLVED=71`, import-resolution
injection tokens `7`, unresolved receivers `2`; kentloog
`JEST_BEHAVIOR_UNRESOLVED=31`, unresolved receivers `8`, method-artifact
misses `2`, and import-resolution injection tokens `2`.

## Performance sample

Five measured post-warmup runs recorded on the first pinned corpus produced
median scan time 808 ms and median graph time 669 ms. The maximum observed
graph RSS was 292 MB. This pinned-corpus sample predates the final
association/pagination changes; the current synthetic rerun below covers the
association overhead. Neither is a replacement for CI hardware or a historical
baseline.

The current synthetic scalability gate also passed after behavioral association
extraction and the scanner AST release change. Three post-warmup scan samples
and five graph samples per scale recorded:

| Cases | Scan p50 / p95 | Graph p50 / p95 |
| ---: | ---: | ---: |
| 100 | 236 / 262 ms | 78 / 125 ms |
| 200 | 308 / 336 ms | 105 / 110 ms |
| 800 | 1,074 / 1,125 ms | 484 / 651 ms |

The largest observed process RSS was 519 MB across the sequential benchmark
scales; this is a runner observation, not a production capacity guarantee.
The recorded benchmark output digest is
`742bd8d7f43723b49c95f1bf923c97a0b289afd89ca635e8e77a95b2312795a9`.
The benchmark records tails explicitly, while retaining the existing first-scan
and median-graph regression limits.

## Remaining limitations

- The reviewer-study protocol has no participant observations yet, so
  comprehension-time improvement is unverified.
- Runtime tracing remains opt-in and separate from static evidence.
- Integration coverage currently exercises the source-to-persistence-mapper
  fixture plus the new DB-backed comprehension E2E; broader persistence paths
  still rely on the existing E2E suites.
- Curated quality gates do not establish broad repository accuracy or business
  rule correctness.
- The largest synthetic benchmark sample reached about 519 MB RSS; the current
  gate limits latency but does not fail on RSS because the runner is variable.
- The full API E2E run reached about 970 MB Node working set and the latest root
  Jest run reached about 1.16 GB on this Windows host; these are observations
  requiring follow-up profiling, not capacity claims.
- Assertion associations are emitted only for exact AST subject references;
  the API returns unresolved diagnostics for ambiguous or unsupported subjects.
- The comprehension projection uses a bounded 64-entry process cache keyed by
  snapshot, artifact, and projection version; distributed cache behavior was
  not measured.
