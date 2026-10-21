# Local verification — October 20, 2026

Scope: the uncommitted working tree based on
`0ac83a7b5f585232ba276e15b3f0787954113584`, including the staged visual trace
implementation and subsequent release fixes. Committed release certification
requires a CI run on the reviewed revision.

## Executed checks

| Check | Result |
| --- | --- |
| Full root suite, final isolated Node 22 run | 199 suites / 1,112 tests passed |
| CI Jest configuration | 193 suites / 1,101 tests passed |
| Analyzer configuration | 36 suites / 186 tests passed |
| Web unit/component tests | 21 suites / 100 tests passed |
| API/database E2E | 18 suites / 103 tests passed |
| Browser journeys with the real document worker | 3 passed: keyboard, desktop finalization/report freeze, mobile rationale |
| Full backend + web typecheck | Passed |
| Workspace lint | Passed; existing 57 API and 5 runtime type-import warnings remain |
| Architecture boundaries | Passed |
| Migration upgrade / legacy data survival / repeated deploy | Passed again in the final serial run |
| Curated production-path quality gate | 20 cases passed; precision 0.975, critical/overall recall 1.0 |
| Controlled-beta readiness evaluator | Passed against the local drill evidence |
| Production Docker release drill | 11 passed, 1 explicit live-provider skip |
| Public source trace corpus | 22 cases, 24 TESTS and 10 CALLS matched; zero false positives in this fixed scope |

Ignored machine evidence is written to `artifacts/evaluation/`,
`artifacts/release/`, and `e2e/.artifacts/`. Test logs remain under `tmp/`.
The dev and test databases were migrated with the 31-migration chain. Local
PostgreSQL/Redis remain available through the documented development compose
project. Environment files and generated secrets remain outside Git.

One concurrent local full-suite run encountered `Server has closed the
connection` in the database integration gate. PostgreSQL had no container
restart/OOM indication. Its cause was not established; the final full suite
passed serially after the Docker drill, using Node 22 to match CI/runtime.
No retry or excluded test was added for that failure.

The release drill exercises image builds, authenticated production startup,
migrations, disabled dev-login, safe liveness/readiness responses, admin-only
operations, a rejected weak Redis configuration, the web login page, process
restart survival, and logical backup/restore with pgvector and a persisted audit
row. Its live scan/analyze/finalize/export leg needs actual provider credentials
and remains explicitly skipped. The real-worker browser journey and DB E2E
exercise the deterministic review/report path.

## Corrections made during verification

- Canonicalize checkout and accepted file paths, including Windows short/long
  names and junctions, before creating artifact identities and graph links.
- Resolve JWT configuration at Nest initialization, after environment loading.
- Validate optional retrieval JSON before mapping it into the graph contract.
- Keep migration upgrade work in a temporary copied migration chain and unique
  database; preserve legacy reports, identities and null metadata on upgrade.
- Keep login controls disabled during client session initialization. Advance
  review decisions through pending items with wraparound.
- Start the actual document worker for browser tests; keep its queues separate
  from other runs. Display frozen traces on the main report route and verify
  they survive deletion of the live edge.
- Make demo reseeding handle dependency edges and generated documents in FK
  order, and validate its scan diagnostic against the contract.
- Scope curated fake-provider claims to the change request, split the static
  scenario templates, and reject positive evaluation cases with no claims.
- Enable decorator/source resolution in the analyzer/CI Jest configurations.
- Exclude local tooling/build evidence from Docker context, remove unused
  Google font compilation fetches, and avoid duplicate backend type checking
  during browser server startup. The full typecheck remains a separate gate.

## Accuracy and product-validation limits

The source-authored pilot found 0/24 TESTS references at `analyzer@0.5.1`.
`analyzer@0.6.0` recognizes bounded Nest TestingModule class-token acquisition
and consistent setup-hook assignments, recovering 24/24 in the same corpus.
Negative tests cover unrelated factories, string tokens, shadowing and
conflicting/reassigned bindings. References to mocked providers stay static
source observations.

These are selected source slices from three repositories, with two under the
NestJS owner. Labels were authored before analyzer execution by the coding
agent; independent human adjudication and held-out application repositories
remain. See [the evaluation protocol](../evaluation/static-test-trace.md).
Reviewer accuracy/time improvements have not been measured.

## Tool and CI versions

Local isolated verification uses Node 22.23.3 and the repository-pinned pnpm
11.5.1. The Node archive was checked against its
[official SHA-256 manifest](https://nodejs.org/dist/v22.23.3/SHASUMS256.txt).
Production Docker and CI use Node 22.
Portable Windows binaries are under `tmp/tooling/`; verification commands
prepend their Node and pnpm bin directories to the process PATH.

Official action releases/metadata were checked on October 20 before updating
the workflow: [checkout 7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1),
[setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0),
[upload-artifact 7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2),
and [pnpm/action-setup 6.1.0](https://github.com/pnpm/action-setup/releases/tag/v6.1.0).
Their action runtime uses Node 24; the application test runtime stays Node 22.
