# G2A Completion Report

**Audit date:** 2026-10-27
**Decision:** `PARTIAL`
**Scope:** study preparation and local engineering verification; no product-value claim

## 1. Baseline

- Branch: `codex/fix-backend-runtime-ci-boundary`.
- Local HEAD and final worktree base commit: `7750d45e7ea43ab4e219c731c746744ff94f395e`. No commit was created; G2A changes remain in the worktree.
- GitHub's branch endpoint reports the same remote SHA. Compared with `main` (`27b388adc25638e0c9737578872baf71e9aa0d2a`), the branch is 11 commits ahead and 0 behind. No open PR was found.
- GitHub Actions run [#122 / run 40516487044](https://github.com/hungthinh1104/BA_Helper/actions/runs/40516487044) passed on that exact SHA. It includes lint, typecheck, build, unit, web, E2E, pinned API proof, and pinned browser proof. The combined commit status also has a failing Vercel check; it was not investigated because no deployment work is in scope.
- The hosted browser proof uses the existing G1 pinned corpus, not this G2A candidate. It does not certify local G2A changes.
- No push, merge, deployment, policy change, or external repository code execution occurred.

### Capability baseline

| Capability | Implemented? | Verified? | G2A gap? |
| --- | --- | --- | --- |
| Code-first artifact discovery | Yes; Explorer selects production methods | Yes; five candidate methods extracted, persisted, and projected | No API-selection gap found |
| Source conditions and dependencies | Yes; structured source evidence and static relationships | Yes; candidate projections carry pinned source evidence | No |
| Related Jest scenario discovery | Yes; direct and bounded static paths | Yes; selected declarations and actual API scenarios inspected | Some unresolved static links remain explicit |
| Assertion/invocation associations | Yes; AST claims and association status | Yes; candidate projections include claims; provenance checked | Unresolved associations stay unresolved |
| Mock boundaries and uncertainty | Yes; mocks and limitations are represented | Yes; mocked calls and `NOT_IMPORTED` runtime status observed | Task difficulty still needs human review |
| Evidence provenance validation | Yes | Yes; five source records and 18 displayed relationships match persisted pinned evidence | No mismatch found |
| Scenario pagination UI | Yes; keyboard-accessible Load More and explicit cap state | Yes; scenario-list suite passed | Candidate-specific browser navigation timing not measured |
| Textual evidence mode | Yes; study-only route hides graph controls | Yes; B/C parity and condition tests passed | Fixed assigned URL remains operator-controlled |
| Interactive visual mode | Yes; existing lazy graph and evidence navigation | Yes; flow tests and G1 hosted browser proof passed | Candidate-specific graph timing not measured |
| Independent ground truth | Candidate package and blinded template prepared | Not yet; all labels are pending | Independent reviewer must adjudicate labels and task difficulty |
| Human study instrumentation | Standalone schema, validator, and scorecard exist | Yes; empty dataset reports `NOT_COLLECTED`, zero observations | No participants or human measurements exist |

## 2. Implemented Changes

- Replaced the active study corpus with the public MIT repository `mutoe/nestjs-realworld-example-app` pinned at `0c30a1828af52cf6528d0b3e9ddf86fc459723f6`. The package declares NestJS and Jest. The task pool covers five methods and all five required task families.
- Added nine source-authored candidate test/target annotations and a blank CSV for blinded review. The labels distinguish direct links, a static path crossing a mocked service, and an absent negative pair. They remain `PENDING_INDEPENDENT_REVIEW` because the author had access to analyzer compatibility output.
- Archived the original `suites-dev/suites-unit` candidate and its annotation rows without changing the individual labels. Its plain TypeScript targets were not emitted as selectable production artifacts, so it is no longer the active task corpus.
- Added a reproducible candidate proof runner and a focused corpus-validation helper. They verify the clean pinned checkout, license/framework metadata, exact Git blobs, production scan, persisted graph/evidence, selected Explorer projections, repeatability, and cache timings. The runner does not install dependencies or execute the public repository.
- Extended the pinned-provenance proof to verify persisted redacted excerpts against redacted source text. The candidate has a password-like test fixture that the existing redactor correctly masks; the verifier now confirms redaction without exposing the literal.
- Updated the candidate answer key, blinded reviewer packet, study protocol, and the BA/QA documentation boundary. The existing A/B/C Explorer, pagination, and scorecard behavior were reused; no product UI, API, schema, or analyzer behavior changed.

## 3. Evidence Reliability

The active task dataset is `tests/evaluation/developer-comprehension/dataset.template.json`. Tasks target `AuthService.validateUser`, `AuthService.login`, `AuthController.login`, `AuthService.register`, and `AuthService.generateToken`. The annotation template contains nine test/target pairs, including a direct target, an indirect static path through a mocked service, multiple scenarios, test-controlled mocks, assertions, and a negative control.

The candidate proof verified six source/metadata files against pinned Git blobs, scanned 26 TypeScript files with full coverage, and produced 39 artifacts and 29 graph edges. One warm-up plus five same-process scans produced the same digest on every pass: `5c174c7c0f239f9fb9b21f5e45deed815e3c12cf37ccc6b4d0280f04ff7508b2`.

The real persistence step saved 39 artifacts, 29 edges, and 39 evidence rows to a `READY` snapshot at the candidate SHA, with zero dropped edges and zero evidence-provenance mismatches. The actual `GetCodeComprehensionUseCase` projected all five selected methods. The pinned provenance verifier checked five production-source records and 18 displayed relationships against the persisted snapshot and source locations.

Direct projected test relationship counts by task were T1 3, T2 1, T3 1, T4 3, and T5 1. Related scenario counts were 5, 2, 1, 4, and 7. T5's seven includes indirect caller scenarios; only one is a direct test relationship to `generateToken`. The study material keeps that distinction. All projections report `runtimeObservations=NOT_IMPORTED`; declarations are not represented as executed or passing tests.

The scanner reported `JEST_BEHAVIOR_UNRESOLVED` (9), `TEST_TARGET_UNRESOLVED` (5), and `UNRESOLVED_INJECTION_TOKEN` (1). These remain diagnostics; no edge or runtime behavior was invented. A password-like source fixture is redacted in persisted evidence. The independent reviewer must confirm that task answers remain discoverable from the remaining evidence.

The original pinned 18-link G1 benchmark remains unchanged and is not independent ground truth. The G2A labels are source-authored candidates only; the author saw compatibility output. There are no approved labels, accuracy metrics, or participant observations.

## 4. Experiment Readiness

- **A — Existing workflow:** participant's normal IDE, source, tests, search, and the same AI assistant policy; BA Helper is unavailable.
- **B — Textual evidence:** the selected method and static evidence projection with graph controls hidden.
- **C — Visual Test Trace:** the same projection and evidence plus the existing graph and evidence navigation.

Existing condition tests verify A does not request comprehension data, B and C use the same projection, and unsupported or duplicate condition values fail closed. The ordinary Explorer remains unchanged without a study condition. Pagination exposes additional scenarios, errors, loading, and the retrieval cap. No new study condition is stored in evidence identity.

The six-slot counterbalanced plan covers all 15 condition/task-family cells without repeating a task under multiple conditions for one participant. The scorecard rubric keeps correctness, source support, test/mock understanding, uncertainty, change safety, time, confidence, unsupported claims, usefulness, and voluntary reuse separate.

The standalone observation schema stores a pseudonymous session code, condition, task, repository/tool SHAs, timing, answer, rubric, evidence references, unsupported claims, and completion status. It rejects identity fields and inconsistent provenance. Raw answers and evidence details have a 90-day retention limit. The current dataset remains `NOT_STARTED`; validation reports `NOT_COLLECTED`, zero observations, and null empty metrics.

Before recruitment, an independent reviewer must adjudicate each candidate relationship and assess whether these five tasks are sufficiently matched. All tasks are in one authentication subsystem and may differ in difficulty. The reviewer should also confirm that redaction has not made a task materially harder. The condition is URL-controlled rather than bound to a server-side participant session, so the operator must preserve each assigned URL.

## 5. Performance

Measurements ran on Windows, Node v22.23.3, Intel Core 5 120U, 12 logical CPUs, and about 16.86 GB reported system memory. They are small-sample local measurements, not an SLA or controlled before/after comparison.

| Measurement | Condition and samples | p50 / p95 | Other evidence |
| --- | --- | ---: | --- |
| Source enumeration | Same process; 1 warm-up + 5 measured scans | 103.6 / 142.2 ms | 26 TypeScript files |
| Scanner extraction | Same process; 1 warm-up + 5 measured scans | 664.2 / 721.2 ms | Digest stable across all passes |
| Graph construction | Same process; 1 warm-up + 5 measured scans | 648.9 / 728.2 ms | 29 edges |
| Full scan pipeline | Same process; 1 warm-up + 5 measured scans | 1,449.4 / 1,527.6 ms | Filesystem/runtime caches warm after first pass |
| Projection cache miss | Warm process/database; new use-case instance; 25 samples, 5 per target | 45.25 / 118.29 ms | Query count p50 13; response bytes p50 101,560 |
| Projection cache hit | Same warm process; 25 samples, 5 per target | 5.34 / 8.11 ms | Query count p50 2; snapshot and artifact identity still read |

Fresh-process projection, process memory, candidate browser readiness, scenario navigation, evidence interaction, and visual graph readiness are `NOT_RUN`. The G1 hosted browser results are not substituted for candidate-specific timings. No performance regression comparison was made.

## 6. Tests and Checks

| Command/check | Result |
| --- | --- |
| `pnpm prove:g2a-study-corpus` | Could not launch locally: `pnpm` is not on PATH. |
| `tmp/tooling/node-v22.23.3-win-x64/node.exe node_modules/ts-node/dist/bin.js --transpile-only scripts/prove-g2a-study-corpus.ts` with the local `os.userInfo` shim | PASS; full scan, persistence, five API projections, 18 displayed provenance links, and 25 miss/25 hit measurements. |
| `tmp/tooling/node-v22.23.3-win-x64/node.exe node_modules/tsx/dist/cli.mjs scripts/validate-developer-study.ts tests/evaluation/developer-comprehension/dataset.template.json` with the shim | PASS; `NOT_STARTED`, `NOT_COLLECTED`, zero observations. |
| `tmp/tooling/node-v22.23.3-win-x64/node.exe node_modules/typescript/bin/tsc --noEmit --project tsconfig.scripts.json` | PASS. |
| `tmp/tooling/node-v22.23.3-win-x64/node.exe node_modules/jest/bin/jest.js --config jest.config.ts --runInBand --runTestsByPath tests/evaluation/developer-comprehension/developer-study.scorecard.spec.ts scripts/verify-pinned-comprehension-provenance.spec.ts` | PASS; 2 suites, 12 tests. |
| From `apps/web`: `..\..\tmp\tooling\node-v22.23.3-win-x64\node.exe ..\..\node_modules\jest\bin\jest.js --config jest.config.ts --runInBand --runTestsByPath src/app/(app)/repositories/[repositoryId]/snapshots/[snapshotId]/artifacts/[artifactId]/page.test.tsx src/app/(app)/repositories/[repositoryId]/snapshots/[snapshotId]/artifacts/[artifactId]/study-conditions.test.tsx src/app/(app)/repositories/[repositoryId]/snapshots/[snapshotId]/artifacts/[artifactId]/_components/scenario-list.test.tsx src/app/(app)/repositories/[repositoryId]/snapshots/[snapshotId]/artifacts/[artifactId]/_components/code-comprehension-trace-flow.test.tsx` | PASS; 4 suites, 14 tests. |
| `tmp/tooling/node-v22.23.3-win-x64/node.exe node_modules/eslint/bin/eslint.js scripts/prove-g2a-study-corpus.ts scripts/g2a-study-corpus-support.ts --max-warnings 0` | PASS; zero errors or warnings after changing the support import to type-only. |
| `git diff --check` | PASS; Git printed line-ending conversion notices. |
| Hosted GitHub Actions #122 on exact base SHA `7750d45e7ea43ab4e219c731c746744ff94f395e` | PASS; not a run on this dirty worktree. |

The first candidate proof attempt exposed that the provenance checker rejected a deliberately redacted excerpt. The checker was updated to validate the persisted redacted excerpt against the redacted pinned source, and its dedicated regression test passes. The external candidate's Jest suite was not executed.

## 7. Risks and Limits

- Independent label review and task difficulty matching are pending; candidate annotations are not accuracy results.
- One repository and one authentication subsystem do not establish generalization to NestJS business applications.
- Secret redaction affects a password-like fixture; the reviewer must confirm the relevant task remains answerable.
- The candidate-specific UI was not opened in a browser, so A/B/C route timing and graph readiness for these exact methods remain unmeasured.
- Study conditions use fixed operator-supplied URLs, not a server-side assignment lock.
- No participant data exists and neither the code-comprehension nor visualization hypothesis is proven.
- The combined GitHub status includes an unresolved Vercel failure. No deployment work was performed.

## 8. Product Decision

**`PARTIAL`.** The task/reviewer package, existing condition parity and pagination, empty-data scorecard, candidate scan, persisted evidence checks, and local API timing are prepared and verified. An independent reviewer still needs to approve/correct labels and assess task matching. Candidate-specific browser measurements and human study data are absent. The report makes no claim that BA Helper or Visual Test Trace improves developer outcomes.

## 9. Next Human Action

An independent reviewer who has not seen candidate labels or analyzer output should use the pinned-source packet and blank CSV, assign a random reviewer code, annotate all nine pairs, and assess task difficulty and the effect of secret redaction. Reconcile disagreements before changing the dataset review status. Then freeze the tool/corpus SHAs and condition URLs, recruit 6–8 relevant developers unfamiliar with the code, and run the counterbalanced pilot. Only collected human observations and approved labels can support an outcome claim.
