# October 21 maintenance and closure review

Historical local record for the October 21 working tree on main, based on
0ac83a7b5f585232ba276e15b3f0787954113584. It is not hosted CI or certification
of a later checkout. Use the [current roadmap](roadmap-status.md#current-status-2026-10-22)
for open gates.

## Dependency maintenance

The production audit initially reported 116 advisories: 7 critical, 43 high,
55 moderate and 11 low. After maintenance it reports one low advisory, with no
moderate/high/critical findings. This is a registry advisory result, not proof
that every initial issue was exploitable in this application.

| Component | Previous | Selected |
| --- | --- | --- |
| Node.js runtime | 22.23.3 | 22.23.3, verified against the official Node 22 release index |
| pnpm | 11.5.1 | 11.28.6, integrity pinned |
| Next.js / eslint-config-next | 16.2.6 | 16.4.2 |
| NextAuth | 4.24.5 | 4.24.15 |
| Nest common/core/platform/testing | 11.1.24 | 11.2.7, aligned |
| Nest BullMQ / BullMQ | worker 11.0.4 / 5.77.6 | 11.0.5 / 5.81.5, aligned and exact-pinned |
| Prisma CLI/client/adapter-pg | 7.8.0 | 7.10.1, aligned |
| Mermaid | 11.15.0 | 11.17.2 |
| Zod | 3.23.8 | 3.25.76, aligned with provider SDK peers |
| Workspace TypeScript | 5.4.5 | 5.9.3 |
| Node type declarations | root 25 / web 20 | 22, matching the runtime |
| jest-dom / explicit DOM peer | 6.9.1 / implicit | 7.0.1 / 10.4.2 |

Compatible dependency ranges and their transitives were refreshed. No peer
dependency issues remain. Removing unused dependencies reduced the audit graph
from 939 to 769 packages before the requested Scalar reference work. Serving
Scalar's pinned standalone browser bundle locally brings the final graph to
921 packages. These are resolution counts, not browser bundle-size measurements.

- Removed unused `simple-git`; repository acquisition already uses the Git
  subprocess adapter with argument arrays and no shell.
- Removed the `shadcn` generator CLI from runtime dependencies. Its unchanged
  4.8.1 primitive stylesheet now lives in `ui-primitives.css`, with its MIT
  license. A checksum test protects the state variants and animation rules.
- Removed the obsolete `@types/dotenv` and `@types/uuid` stubs.
- Kept automatic Prisma client build scripts disabled; CI and Docker explicitly
  generate the client. Replaced the previous placeholder build permission.
- Swagger 11.4.7 pins js-yaml 5.3.0. A parent/version-scoped pnpm override uses
  5.4.1 to address
  [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm).
  Remove it when Swagger fixes its dependency pin.
- `verify:dependencies` blocks high/critical production advisories in CI and
  `verify:stability`; it does not suppress lower-severity findings.

The remaining low finding is
[KaTeX GHSA-238p-pmpm-9mq7](https://github.com/advisories/GHSA-238p-pmpm-9mq7),
through Mermaid's 0.16 range. The fixed 0.18.2 lies outside that range. Keep
tracking the dependency; no incompatible KaTeX override was introduced.

Official release references checked for the selection:
[Node schedule](https://github.com/nodejs/Release#release-schedule),
[Node release index](https://nodejs.org/dist/index.json),
[pnpm 11.28.6](https://github.com/pnpm/pnpm/releases/tag/v11.28.6),
[Next 16.4.2](https://github.com/vercel/next.js/releases/tag/v16.4.2),
[Prisma 7.10.1](https://github.com/prisma/orm/releases/tag/7.10.1).
Prisma's selected release includes transaction isolation and advisory fixes.
Major migrations to TypeScript 7, Nest 12, Mermaid 12 or Prisma 8 RC were not
needed for these fixes and remain outside this maintenance change.

## Source graph performance

Test files/cases are indexed by accepted source file, ambiguous identities use a
set, and call offsets are cached once. A sorted call index performs full-body
containment queries instead of revisiting every file call for every test.
Equal-offset order, repeated locations, ambiguity exclusions, skipped cases,
diagnostics and snapshot selection remained unchanged. The graph benchmark was
measured against extraction contract `analyzer@0.7.0`; it does not measure the
current `analyzer@0.10.0` contract.

`pnpm benchmark:static-test-graph -- current` builds a deterministic synthetic
fixture: 20 test files, 40 declarations per file, four calls per declaration and
821 artifacts. It performs one warmup and five timed graph builds, records
implementation hashes and checks the complete graph output digest.

With the same refreshed dependencies, a local comparison between the original
full-scan query strategy and indexed queries measured median graph build times
of **205.16 ms → 140.03 ms**, approximately **32% lower**. Both strategies keep
the same index construction in this comparison to isolate lookup work. The
full graph/diagnostic digest is identical:
`7525fdcd02c509f330816d1c7da8ad811d828a6ecee16c49354b9e8e42eff337`.

These are synthetic local measurements with five samples, not controlled
whole-application p50/p95 estimates or an end-to-end speed claim. JSON evidence
is in ignored `artifacts/performance/static-test-graph-*-refreshed.json`.

## Report rendering boundary

The existing Mermaid renderer used loose mode and inserted its SVG directly.
It now uses strict mode, SVG text labels, suppressed error markup and separate
DOMPurify SVG sanitization before insertion. Render failures show escaped source
text; stale results are ignored and empty/new input clears the old diagram.
Tests exercise scripts, event handlers, foreign objects and JavaScript URLs.
This follows the KaTeX advisory's separate-sanitizer guidance, while preserving
the remaining dependency warning.

The browser suite also exercises malformed Bearer headers against a protected
web route, alongside the existing keyboard/mobile/finalized-report journeys.

## Compatibility failures found during verification

- The first full backend run could not load sanitize-html's ESM htmlparser2
  dependency under Jest/CommonJS on Node 22. That run was stopped after the
  repeated import failure; it is not passing verification. Six backend Jest
  configurations now share a bounded transform for the parser's ESM dependency
  chain. Unrelated node_modules remain excluded, and the actual PDF-export
  use-case suite plus configuration checks passed after this change.
- TypeScript 5.9 exposed 25 errors from `jest.fn<any>()` async stubs in two
  embedding specs. Their Promise-returning function signatures are explicit
  now, preserving the same fixture rows and behavior assertions.
- Renderer tests first failed for loose initialization and stale content on
  empty input. The final state is associated with its chart, avoiding an extra
  synchronous effect reset; the late-render cancellation guard remains.
- A compatible-range refresh briefly selected deprecated jest-dom 6.10.0.
  Its publisher identifies Node 22 and the required DOM peer as breaking
  changes and directs users to version 7. The final selection is 7.0.1 with
  an explicit 10.4.2 peer, matching the project's Node baseline.
- The first browser attempt stopped during worker startup: the worker's exact
  old queue versions and runtime's refreshed ranges loaded different
  `WorkerHost` constructors. Both packages now pin the same adapter/queue
  versions. A regression test checks actual module resolution and constructor
  identity across those package boundaries. The browser attempt did not reach
  its scenarios; it is not passing evidence.

## Verification

| Check | Executed result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts` | PASS, pnpm 11.28.6 |
| Prisma client generation | PASS, 7.10.1 |
| `pnpm peers check` | No peer dependency issues |
| `pnpm verify:dependencies` | PASS; one low KaTeX advisory remains |
| `pnpm typecheck` | PASS, backend and web |
| `pnpm lint` | PASS; 57 API and five backend-runtime type-import warnings remain |
| `pnpm test` | 210 suites, 1,171 tests, one snapshot passed (290.767 s), including Scalar contract coverage |
| `pnpm test:e2e` | 19 suites, 106 tests passed (260.848 s), including the generated OpenAPI validator |
| Browser regression | Five scenarios passed; desktop/mobile review, approved report SVG, auth headers and Scalar |
| `pnpm verify:release-drill` | 12 passed, one explicit real-provider skip; production Scalar/spec/local JS, 31 migrations, restart and backup/restore verified |
| `pnpm test:web` | 22 suites, 105 tests passed |
| `pnpm test:analyzer --runInBand` | 41 suites, 219 tests passed |
| `pnpm verify:migration-upgrade` | PASS, legacy data survived the 31-migration chain |
| `pnpm verify:architecture-boundaries` | PASS |
| Public trace corpus | 22/22 declarations, 24/24 TESTS, 10/10 CALLS, no false positives |
| Application trace corpus | 27/27 declarations, 28/28 TESTS, 22/22 CALLS, no false positives |
| `pnpm verify:analyzer-quality` | PASS, 20 curated fake-provider cases; unchanged thresholds |

Application labels retain their frozen SHA-256:
`d87059c07d9f36a4ae61e58515230aaf9bdcea96d65ac8a1bddd0fdd206c013f`.
The curated fake-provider metrics remain critical/overall recall 1, precision
0.975, evidence coverage 1, negative-control pass rate 1 and orphan claims 0.
These do not measure real-provider accuracy or reviewer effectiveness.

The Scalar reference is documented in [its verification record](api-reference-2026-10-21.md).
The production Docker drill completed with `PASS_WITH_SKIPS`: its live
real-provider scan/analysis path is explicitly unexecuted. The local API is
running for review; these checks do not publish or deploy an external service.
Earlier results in [local verification](local-verification-2026-10-21.md)
describe the preceding dependency set and are not substituted for this run.
