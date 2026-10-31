# BA_Helper Product Integrity v1 — Evidence Ledger

Updated: 2026-10-31
Verdict: **PARTIAL — not a release sign-off**

## Candidate and release decision

- Branch `codex/integration-product-integrity-v1`, HEAD
  `762759cb2623ff51ee2fcb785352a826125b7131`. A fresh `git fetch --all --prune`
  confirmed HEAD matches `origin/codex/integration-product-integrity-v1`; it is
  63 commits ahead of `origin/main` and 0 behind. Both source branch tips are
  ancestors of this integration branch. The worktree has 282 staged/unstaged/
  untracked status entries, with 0 staged, and no candidate commit SHA. No
  hosted CI run covers these exact file contents.
- Both source branches are incorporated in merge
  `1bd036b9a48fc35533e19e3ff526ede3410e46bc`. The 16 overlapping paths were
  compared across both parents and the merge: 14 differ from the first parent
  in the merge commit; among all 16, 13 merge blobs combine/extend parent
  content, one matches the first parent, one matches the second parent, and the
  expected-artifacts fixture is identical in both parents. The finalize spec
  retains the conditional `WAITING_FOR_REVIEW` transition assertion and the
  race regression that rejects a lost transition before snapshot creation. No
  unmerged paths remain. This overlap audit does not replace full CI or
  route/browser verification.
- No production database write, deployment, merge, or remote write was
  performed in this verification pass.
  `.pnpm-store` currently contains untracked local cache artifacts (including
  temporary SQLite WAL files); preserve them locally and exclude them from any
  release candidate.
- The user selected a maintenance-window report migration: stop/drain API and
  worker writers, migrate, then start only the updated services. README records
  this order. The migration creates replacement identities before dropping the
  old index, but old/new writer overlap is unsupported and has not been tested.
  No live rollout was run.

## Release gate evidence

| Area | Evidence | Status |
| --- | --- | --- |
| Hosted CI | After a fresh `git fetch origin`, branch and remote still match exact HEAD `762759cb2623ff51ee2fcb785352a826125b7131`; no newer PR-triggered workflow run was returned. Actions run `40878312242` is attached to that SHA and failed `quality-and-tests`. Its log confirms two idempotency tests rejected with `Request key reuse with different payload` because mocked persisted rows omitted nullable lineage identities; six lineage cases hit undefined `prisma.impactAnalysis.findUnique` because that Prisma delegate was absent from the mock; ten graph cases lost nodes/edges because fixtures lacked snapshot/revision scope required by the projection filter. This turn reran both exact suites on the worktree: 2/2 suites and 45/45 tests passed. These are fixture/mock regressions, not a reproduced production behavior failure. No hosted run covers these dirty contents. Vercel still reports failure; its deployment logs remain unavailable. | Open |
| Current App regression | On 2026-10-31, latest root `pnpm test` passed 256/256 suites, 1,492/1,492 tests and 1/1 snapshot; `pnpm test:ci` passed 250/250 suites, 1,481/1,481 tests and 1/1 snapshot. Root typecheck passed and lint exited 0 with type-only import warnings and no errors. | Pass locally; hosted CI on exact candidate remains open |
| Focused embedding/retrieval checks | This turn: offline embedding/retrieval passed 4 suites / 40 tests; isolated PostgreSQL/pgvector + Redis E2E passed 2 suites / 14 tests (8 model-identity/index/reuse cases and 6 provenance cases) on `ba_helper_goal_embed_caf1c1023c94`, then dropped it. The equal-dimension foreign-model vector was excluded and reported lexical fallback; PostgreSQL ranked distinguishable vectors only inside project/repository/snapshot/model scope. Earlier full E2E evidence also passed. Production historical model distribution remains unverified. | Pass locally |
| Migration upgrade | Hosted run `40878312242` passed on base HEAD. On 2026-10-31, the current-worktree upgrade verifier passed on scratch PostgreSQL: legacy rows survived, valid upgrades applied twice, and invalid cross-scope and confidence history failed closed without data loss. A new Prisma catalog-parity regression first failed with 10 name-only differences (5 foreign keys, 5 indexes); explicit Prisma `map` names removed the catalog diff. Production historical counts and hosted CI on the current candidate remain open. | Pass locally |
| API/DB/Redis E2E | On 2026-10-31, the full `pnpm test:e2e` run before the report-authorization follow-up passed 42/42 suites and 283/283 tests using a fresh PostgreSQL scratch database and Redis logical DB 1. Two E2E seed fixtures first failed the new evidence-origin constraint, were corrected to include snapshot scope, then passed in the full rerun. The subsequent focused report-authorization test passed 1/1 on another disposable DB; both scratch databases were removed and the Compose containers/volumes remain intact. | Pass locally; exact-candidate hosted CI remains open |
| Web | On 2026-10-31, latest `pnpm test:web` passed 48/48 suites and 206/206 tests (115.986 seconds) after the report-navigation change. Production webpack build, route smoke, responsive sweep and browser suites are recorded in the current-worktree follow-up below. | Pass locally |
| Routes and navigation | Inventory found 18 user-facing `page.tsx` routes. On the production build, route smoke passed login and all 17 workspace/marketing/print paths, query-state refresh/back-forward, missing resources, deep links and active navigation. The multi-repo detail and merged-report routes also pass a positive API-backed review/finalize journey on desktop and mobile. Broader unauthorized/locale/error-state matrices remain partial. | Partial |
| Responsive and accessibility | On the production build, `e2e/responsive-sweep.pw.ts` passed on 9 critical screens, light/dark, all five required widths and automated WCAG 2.2 A/AA checks at 375/1440. The multi-repo detail/report journey passed on desktop and Pixel 7 mobile and checked both routes at 320, 375, 768, 1024 and 1440px without horizontal page overflow. Manual focus/contrast and assistive-technology checks remain open. | Partial |
| Security and project scope | On 2026-10-31, API + PostgreSQL `auth-rbac` passed 49/49 and dedicated project-role, membership and resource authorization passed 13/13. The route-authentication E2E dynamically covered 105 API handlers: 100 protected routes returned 401 unauthenticated, and denied roles returned 403 on all 12 global-role routes. Cross-project tests now cover 13 analysis/report read endpoints plus 2 report mutations using real persisted resources: a non-member REVIEWER receives 404 with no report/evidence disclosure and creates no snapshot, document job or domain event. Project-role capabilities and cross-project masking have broad real-DB coverage, but project permissions are not yet paired with every route/role/scope outcome. | Partial |
| Provider secret redaction | Real provider adapters sent requests to a local HTTP capture server; OpenAI, Anthropic, Google and DeepSeek cases passed 4/4 with synthetic secrets absent from captured payloads. No external provider was called. | Pass at adapter seam |
| Analyzer/retrieval | Pinned trace/adversarial fixture gates passed in prior local runs. PostgreSQL-backed production-path evaluation and independent human review remain open. | Partial |

## Phase 0 local read-only baseline (2026-10-31)

- Audited localhost/ba_helper_test inside a transaction confirmed as READ ONLY;
  no production endpoint was used. Application row counts were: Project 1,
  Repository 1, RepositorySnapshot 1, CodeArtifact 22, DependencyEdge 11.
  Every other application table had 0 rows; _prisma_migrations had 59 rows.
- Migration catalog showed 0 failed and 0 unfinished migrations, 3 explicitly
  rolled-back history rows, and all 56 current migration directories represented
  by applied rows. Latest applied migration was
  20261031140000_confidence_range_integrity. A separate SHA-256 comparison
  found 4 applied-row checksums that differ from the current migration files:
  `20261030100000_generated_document_snapshot_identity`,
  `20261030160000_dependency_edge_snapshot_scope`,
  `20261030180000_evidence_artifact_snapshot_scope`, and
  `20261031100000_multi_repo_child_lineage_scope`. The four files are additions
  in the current index/worktree, so this local DB history is not proof that the
  current SQL bytes were applied. The cause and any relationship to deployed
  history are unknown; do not repair `_prisma_migrations` or migrate this
  persistent test DB as part of this audit.
- A read-only `prisma migrate status --config prisma.config.ts` against
  localhost/ba_helper_test reported "Database schema is up to date"; that
  status only agrees on migration names and does not clear the checksum
  discrepancy. `pnpm verify:migration-upgrade` separately passed against fresh
  scratch databases, so current migration SQL has scratch-upgrade coverage.
  No shared-database migration was run.
- PostgreSQL reported 69 validated foreign keys, 33 validated primary keys,
  7 validated checks and 1 validated unique constraint; there were no NOT
  VALID constraints or invalid indexes. The audited cross-scope and duplicate
  identity queries returned 0 violating rows. ReviewNote's mapped table was
  checked separately and also returned 0.
- The test database has no Requirement, RequirementRevision, RepositoryTarget,
  Evidence, ImpactAnalysis, EmbeddingChunk, GeneratedDocument, report snapshot,
  or queue-job rows. Thus the zero violation counts do not exercise those
  histories or replace the disposable-DB migration/E2E tests.
- pnpm verify:migration-upgrade was rerun after inspecting its isolation
  behavior. It passed its legacy-survival and fail-closed cases on random
  scratch databases; post-run inspection found no remaining
  ba_helper_upgrade_* databases and confirmed the persistent test row counts
  above were unchanged. The selected rollout for the report migration remains:
  stop and drain API and worker writers, migrate, then start only updated
  services.

## Evidence-link boundary follow-up (2026-10-31)

- A production-source scan found runtime evidence-link writes only through
  InsightRepository.linkEvidenceMany and
  TraceabilityRepository.linkEvidenceMany. The impact-analysis use cases call
  these methods; no API or worker caller directly creates join rows. The demo
  seed is a separate direct Prisma writer outside the runtime request path.
- Both repository methods load the owning analysis scope and candidate
  Evidence inside one database transaction, validate snapshot/revision
  provenance, then insert. Insight and traceability reads apply the same
  analysis-evidence scope predicate. It preserves the two supported origins:
  evidence from the analysis snapshot, or requirement-only evidence for the
  matching immutable requirement revision.
- A fresh API/PostgreSQL run of matrix-drilldown.e2e-spec.ts passed 1 suite and
  3 tests on an isolated database. It rejected foreign-project links through
  both guarded repositories, then inserted an intentionally invalid legacy
  join row directly and verified the API omitted its ID and excerpt. The
  scratch database was dropped; ba_helper_test was not the test target.
- Classification remains TEST_GAP at the direct database-write boundary:
  internal direct Prisma/SQL can still create an out-of-scope join. No current
  API/worker writer bypasses the transaction guard. Because Evidence supports
  either snapshot scope or requirement-revision scope, a database constraint
  would need duplicated scope columns or a trigger to encode the valid
  disjunction. Current runtime evidence supports retaining guarded application
  writes and fail-closed reads without adding that migration.

## Review/finalize concurrency spot-check (2026-10-31)

- The focused final-reviewed-report API/PostgreSQL test passed 1/1; the other
  36 cases in that file were filtered out. It pauses finalization after the
  frozen review payload is built while the analysis row is locked, starts the
  review-note HTTP request, and confirms PostgreSQL reports that request
  waiting on the row lock.
- After finalization commits, the finalizer returns 201, the later note write
  returns 409 INVALID_STATE_TRANSITION, the earlier note remains unchanged,
  and exactly one reviewed snapshot exists. This is an actual PostgreSQL
  interleaving, not an in-memory promise-order simulation.
- The test ran against a newly created scratch database and removed it. A
  read-only post-check confirmed ba_helper_test row counts were unchanged and
  no evidence-scope or report-race scratch databases remained. This seam uses
  one API process; it does not simulate multiple deployed API replicas.

## Adversarial evidence ledger

| Classification | Finding -> source -> invariant | Reproduction -> risk | Required change -> verification |
| --- | --- | --- | --- |
| `CONFIRMED_DEFECT` in base HEAD; patched and verified locally | `EmbedSnapshotArtifactsUseCase`, `EmbeddingProviderPort`, `EmbeddingChunkRepository`, and `HybridRetrievalService`: provider identity and returned model identity were used inconsistently, and vector search did not filter by model. Stored/reused/searched vectors must share one canonical model identity. | Base behavior could miss reuse or rank same-dimension vectors from incompatible models. | Worktree uses configured `modelName`, validates provider responses, scopes search/reuse by model, and fails closed on mismatch. Offline embedding/retrieval tests passed 7 suites / 50 tests; the latest API/PostgreSQL/Redis E2E passed 41/41 suites and 273/273 tests, including model identity and provenance cases. Production historical model distribution remains unverified. |
| `CONFIRMED_DEFECT` at runner boundary; fixed and verified | `RuntimeDocumentJobRunnerAdapter.markRunning` read a queued/running job then updated by ID only. A stale worker could resume after another worker committed `COMPLETED`, reopen it as `RUNNING`, and mark it `FAILED` after a later rendering error. | The stale-read unit regression failed before the fix and passed after it. The real API/PostgreSQL E2E pauses the stale DB read while another worker publishes. | The runner now compare-and-sets from the observed status and returns the persisted report for an already-completed job. Runner/use-case/repository tests passed 3 suites / 21 tests, and the full API E2E suite passed locally. |
| `CONFIRMED_DEFECT` in response contract and matrix projection | Retrieval emits the `KIND` signal and versioned per-artifact diagnostics, but the shared signal enum omitted `KIND`; `retrievalDiagnostics` and matrix `retrievalSignals` were `z.any()`. Matrix mapping also read signals from `Evidence`, which has no retrieval-metadata field. | New contract, graph and matrix-use-case regressions failed before the fix: `KIND` rejected the whole graph retrieval object, diagnostics accepted malformed payloads, and matrix evidence returned no signals. | Shared contracts now validate all five signals and the versioned diagnostics structure. Matrix mapping reads validated signals/diagnostics from the owning traceability link. API-contract documentation records the legacy graph omission exception. Focused contract, graph, matrix and controller tests pass 4 suites / 31 tests. |
| `CONFIRMED_DEFECT`, fixed and verified at PostgreSQL API seam | `HybridRetrievalService.retrieve` returned only artifacts; `ImpactEvidenceCollectionStep` always persisted `strategy: hybrid`, including model mismatch, vector failure, and no model-scoped chunks. | The service logs provider errors, but an empty result carried no run-level fallback state and persisted analysis metadata could describe lexical-only retrieval as hybrid. | Retrieval now returns `{ artifacts, diagnostics }` with `strategy: hybrid | lexical_fallback` and `vectorStatus: USED | NO_COMPATIBLE_CHUNKS | MODEL_MISMATCH | FAILED | NOT_READY`; the impact-analysis step persists these fields. Service and application-step regressions were observed red before implementation and green after it. The real API + PostgreSQL E2E passed 8/8 on 2026-10-31, including the foreign-model-only case. |
| `STRUCTURAL_GAP` in base; database fix verified locally | `Evidence.artifactId` and `snapshotId` are nullable. PostgreSQL `MATCH SIMPLE` lets an artifact ID with NULL snapshot bypass the composite FK; the old migration preflight also skipped those rows. | The migration upgrade and direct-write API/PostgreSQL E2E passed against disposable no-volume PostgreSQL, including missing and mismatched historical provenance fixtures. No historical rows were repaired. | Keep the database CHECK and fail-closed preflight. Inspect actual production historical counts before rollout. |
| `STRUCTURAL_GAP` in base; scoped constraint verified locally | `DocumentJob.generatedDocumentId` previously referenced only `GeneratedDocument.id`, so a direct write could link another analysis's report. | The fail-closed migration preflight, valid legacy backfill, invalid-history rejection, same-analysis check/composite FK and `ON DELETE SET NULL` behavior passed the disposable PostgreSQL migration drill and API E2E. | Inspect production mismatch counts and use the selected maintenance window: stop/drain API and worker writers before migrating, then start only updated services. Mixed-version overlap is unsupported. |
| `SCHEMA_CATALOG_DRIFT`, corrected without DDL | Prisma's generated names differed from 5 existing foreign keys and 5 indexes after the current migration chain, although PostgreSQL definitions and behavior matched. | Real PostgreSQL `migrate diff --exit-code` reproduced 10 rename-only operations before the fix. This made schema parity checks noisy and could invite unnecessary rename migrations. | Prisma relation/index `map` values now preserve the catalog's established physical names. `prisma validate`, zero-diff catalog comparison, and the full migration-upgrade verifier passed. No production database was accessed. |
| `CONFIRMED_DEFECT` in AI output validation; patched and verified locally | `impactAnalysisAiSchema` previously accepted out-of-range confidence and `normalizeImpactAiOutput` carried it through; response contracts require `[0,1]`. Migration `20261031140000_confidence_range_integrity` now adds fail-closed PostgreSQL checks for `BaInsight` and `TraceabilityLink`, preserving NULL and endpoints. | Schema regression was red for `-0.01` and `1.01`; PostgreSQL API E2E was red because `BaInsight.confidence = 1.01` persisted. Both historical-value cases now fail migration preflight on scratch PostgreSQL without editing rows or leaving partial constraints. The API/PostgreSQL E2E rejects invalid writes with Prisma `P2039`, preserves prior values, and accepts `0`, `1`, and `null`. | AI schema suite passed 5/5; final-report API/PostgreSQL E2E passed 37/37; full migration-upgrade verifier passed. Production historical row counts remain unqueried, so rollout is still gated. |
| `CONFIRMED_DEFECT` in impact-graph projection; patched and verified locally | `ImpactGraphReadModelBuilder` previously used `link.confidence || undefined`, dropping valid zero. | The API/PostgreSQL regression was red: the graph response parsed but omitted `confidence: 0`. | Nullish mapping now preserves zero. The regression passed through the shared graph response contract and the API endpoint. |
| `DESIGN_RISK`, no current invalid writer reproduced | Progress columns are PostgreSQL `INTEGER`; production call sites use bounded constants from `0` to `100`. The current scan writer creates only `CODE`/`TEST` evidence with both snapshot and persisted artifact identity. Scanner source-line ranges are stored as integers; strict positive-line contracts exist for comprehension/workspace, while generic artifact/evidence contracts are permissive and the exported fixture analyzer emits `0` (no in-repo production caller found). `EvidencePolicy.validateEvidenceOrigin` has no callers; requirement-input evidence has no production writer. Diagnostic payload contracts currently allow `unknown` JSON despite several code-specific payload schemas. | Source inspection found no current production path writing progress outside `[0,100]`, invalid evidence origin, or fixture-analyzer line `0`. The open gaps are future-writer/type-safety risks; no production catalog or historical rows were queried. | Do not add broad DB checks solely for completeness. Preserve the currently valid dual-scope evidence query semantics; define origin/line rules and connect code-specific diagnostic JSON validation when a production writer requires them. Obtain historical counts only from an authorized isolated data copy before any constraint rollout. |
| `TEST_GAP` at direct-write database boundary | `InsightRepository.linkEvidenceMany` and `TraceabilityRepository.linkEvidenceMany` validate evidence against the owning analysis in a transaction; analysis-aware reads filter evidence scope. | `matrix-drilldown.e2e-spec.ts` and the full API/PostgreSQL E2E suite passed, covering a foreign-project write rejection and hiding a legacy invalid link. The join tables still only have ID foreign keys and allow a direct cross-scope SQL row. | Retain the application guards and include this distinction in the authorization/release record. Consider database enforcement only if its added scope fields preserve valid requirement-input evidence. |
| `TEST_GAP` | `EmbeddingChunkRepository.insertMany` performs an awaited persistence operation per chunk. | No measured overhead is available; batching could complicate correctness without evidence it is needed. | Keep the current write path and benchmark representative large snapshots before considering bulk insertion. |
| `PARTIALLY_RESOLVED` | This pass used the existing local Compose PostgreSQL/Redis services only through `.env.test`: `ba_helper_test` during focused checks and a generated scratch PostgreSQL database plus Redis logical DB 1 for the passing full E2E. The scratch database was dropped; containers and volumes were not stopped, removed, or pruned. | Model identity, relational authorization paths, migration constraints, report concurrency and queue recovery are verified on local test data. Production historical lineage/counts and exhaustive route-by-role authorization remain open. | Keep local test evidence separate from production evidence; obtain production baseline counts before rollout. |

Read-only SQL for a production historical-data preflight (not run against production):

```sql
SELECT evidence."id", evidence."sourceType", evidence."snapshotId", evidence."artifactId",
       artifact."snapshotId" AS artifact_snapshot_id
FROM "Evidence" AS evidence
LEFT JOIN "CodeArtifact" AS artifact ON artifact."id" = evidence."artifactId"
WHERE evidence."artifactId" IS NOT NULL
  AND (evidence."snapshotId" IS NULL
       OR artifact."id" IS NULL
       OR artifact."snapshotId" IS DISTINCT FROM evidence."snapshotId");

SELECT job."id", job."analysis_id", job."generated_document_id",
       document."impactAnalysisId" AS document_analysis_id
FROM "document_job" AS job
JOIN "GeneratedDocument" AS document ON document."id" = job."generated_document_id"
WHERE document."impactAnalysisId" IS DISTINCT FROM job."analysis_id";
```

| Finding | Change / evidence | Residual risk |
| --- | --- | --- |
| CI fixture drift and missing current lineage caused the two App-test failures. | The hosted red baseline is run `40878312242`; on this turn the same two suites passed 45/45 locally after current fixtures added explicit null lineage columns, missing Prisma delegates and graph snapshot/revision scope. The latest full local `pnpm test:ci` passed 249/249 suites / 1,471 tests. No hosted run covers this dirty candidate. | Full hosted CI on an exact clean candidate remains open. |
| Nullable `reviewed_report_snapshot_id` made the new generated-document unique index insufficient for legacy NULL rows. | Added a partial unique index on `(impactAnalysisId, type, status) WHERE reviewed_report_snapshot_id IS NULL` before dropping the old index. Migration workspace regression passed 8/8 and the PostgreSQL upgrade drill passed, including duplicate legacy and snapshot-document rejection. | Prisma does not express the partial index; keep its SQL and model documentation aligned. Production historical counts remain open. |
| New reviewed-report snapshot query used Prisma directly in an application use case. | Moved the query into `DocumentRepository`, preserving `(snapshotId, analysisId)` scope. Use-case/repository regressions passed, and the full API/PostgreSQL E2E suite passed. | No local residual; production historical row distribution is not represented by the disposable fixture. |
| Report response could combine live review data and a different frozen snapshot. | Source captures snapshot identity with review completion and checks frozen decision identity/state. API/PostgreSQL tests cover decision-swap rejection and stable captured-snapshot behavior; final-report audit/concurrency passed 35/35. | Local tests do not model multiple independently deployed API processes; production rollout remains open. |
| Queue acknowledgement loss and worker restart could produce false failure or duplicate work. | Retry identity and persisted-job acknowledgement paths have focused unit coverage. Isolated Redis/PostgreSQL recovery E2Es passed 5 suites / 19 tests, including restart and outage recovery. | Hosted CI and production queue history remain unverified. |
| A multi-repo child whose initial Redis enqueue failed stayed `FAILED` on same-key retry and never received a BullMQ job. | New API/PostgreSQL/Redis E2E was red before the fix. A conditional PostgreSQL transition now reopens only `FAILED` rows with `error.code=QUEUE_ENQUEUE_FAILED`; simultaneous same-key retries reuse the same run/children, emit one retry audit event and enqueue the deterministic child job. Focused use-case tests passed 26/26; the multi-repo and impact enqueue-recovery E2Es passed 2/2 suites and 11/11 tests. Backend typecheck and focused ESLint passed. | Other analysis failures remain terminal. Hosted CI on this dirty worktree and production queue history remain unverified. |
| Stale recovery changed `RUNNING` rows directly, without the queue transition policy, a persisted failure cause, or an audit event. | Recovery now checks the stale transition through `QueuePolicy`, conditionally updates each row, persists `WORKER_JOB_ORPHANED`, and writes the matching failure event in the same PostgreSQL transaction. Unit and real PostgreSQL/Redis E2Es passed, including rollback on injected audit failure. | The previous local startup `P2028` was not reproduced in the current recovery run; production worker logs are not available here. |
| Possible event-log failure after finalization commit was reviewed. | Snapshot creation/finalization pass the transaction client to event recording; the API/PostgreSQL E2E injects event-store failure and asserts rollback. | No local residual identified; hosted/production behavior remains unverified. |
| `GetFinalReviewedReportUseCase` also queried Prisma directly for jobs, generated documents, and localized reports. | Moved those reads behind `DocumentRepository`; API report tests passed 13/13, repository query tests passed 5/5, and full API/PostgreSQL E2E passed. | No local residual identified; production historical row distribution remains open. |
| Merged report review cleared the decision and note before the async request succeeded. | New component regression failed before the fix (2/2 cases), then passed after the panel awaited the mutation and preserved state on rejection. The parent now rethrows after its error toast; the panel clears only on success. Production browser multi-repo finalize/review passed on desktop and mobile. | Add equivalent retry-state coverage for other mutation forms during the broader UI state audit. |
| Code evidence and scenario screens contained untranslated user-facing labels and CTAs. | Added `next-intl` messages for Code Evidence, scenario inspection/comparison, and trace graph states in English, Vietnamese, and Japanese. Locale catalog checks pass; current full web suite passed 47/47 suites and 204/204 tests. | Manual keyboard, focus, contrast and assistive-technology checks remain open; the remaining UI state inventory is not exhaustive. |
| `get-code-comprehension.usecase.ts` (431 lines) and `multi-repo-analysis.controller.ts` (325 lines) exceed the 300-line review threshold. | Recorded as `OPEN_P2`; this pass avoids moving comprehension projection or route orchestration logic without full DB/E2E coverage. | Split or add an explicit module-level justification in a separate focused iteration. |
| Old and new report writers have incompatible identity keys during cutover. | README requires stopping and draining API and worker (including external instances), applying migration, then starting updated services. | This is an explicit maintenance-window cutover, not proven mixed-version expand/contract compatibility. |
| Worker startup previously reproduced `P2028` in local testing. | Worker restart and stale-job recovery E2Es passed on disposable PostgreSQL/Redis; `P2028` was not reproduced in this run. | Check the original hosted/production worker logs if available before claiming the incident cause was eliminated. |
| Local Vercel status failed while local web build passed. | No Vercel logs were accessible; no cause is inferred from the local build. | Diagnose the hosted deployment failure. |

## Verification record

- Code-review follow-up focused tests: 8 suites / 51 tests pass across the report use case, document repository, Code Evidence navigator, scenario list, scenario page, graph trace, study conditions, and locale message catalog.
- Before the merged-report review-form regression was added, the full web suite
  passed 46/46 suites and 202/202 tests. After the fix, the latest full web
  suite passed 47/47 suites and 204/204 tests. The final test-only lazy-mock
  cleanup was also rerun separately: scenario-list 6/6 passed.
- The first full web run after adding `next-intl` caught stale component mocks and an ESM import in tests that rendered the graph directly. Those test seams were updated before the 46-suite / 202-test pass.
- Current root `pnpm typecheck` passes. Current workspace `pnpm lint` passes with 44 pre-existing type-only import warnings (5 in backend-runtime and 39 in API); no lint errors remain.
- Worktree-wide `git diff --check HEAD` is not clean: with default settings Git reports CRLF endings in existing changed files as trailing whitespace; with `core.whitespace=cr-at-eol`, the remaining finding is one extra blank line at EOF in `apps/api/src/modules/impact-analysis/application/queries/get-matrix-row-detail.usecase.ts`. The targeted check for `scripts/verify-migration-upgrade.ts` and `apps/api/prisma/schema.prisma` passes. This pre-existing worktree issue remains outside the catalog-parity fix.
- Current focused tests after the latest fixes: 5 suites, 25 tests passed.
- This turn's focused suites passed: embedding/retrieval 7 suites / 50 tests;
  CI regression plus embedding/retrieval 4 suites / 65 tests; report
  use-case/repository/runner 3 suites / 21 tests. The stale document-worker
  regression was observed red before the compare-and-set change and green after.
- Queue stale-transition policy, audit policy, worker recovery, BullMQ service,
  and event-log service tests pass 5 suites / 64 tests. The 3 stale-transition
  suites ran red before the policy and persisted transition behavior were
  implemented. PostgreSQL event rollback behavior is covered in the passing
  35-test final-report audit E2E.
- Evidence repository and migration-workspace checks pass 2 suites / 8 tests;
  these are offline checks and do not prove PostgreSQL constraint behavior.
- PostgreSQL worker restart and stale-job recovery E2Es passed in the full API
  suite on disposable services; the startup `P2028` issue was not reproduced.
- Migration workspace test: 7/7 passed; its earlier red assertion demonstrated
  the missing legacy-NULL uniqueness protection.
- New repository/use-case tests: 2/2 passed after reproducing both failures
  before implementation.
- The first full `pnpm test:ci` rerun exposed 9 failures across two suites,
  all from stale test adapters after `RetrievalPort` changed to
  `{ artifacts, diagnostics }`. Both adapters were updated; the next full run
  passed 246/246 suites and 1,462/1,462 tests.
- After the merged-report review-form and retrieval-response contract fixes,
  `pnpm test:ci` passed again on 2026-10-31: 247/247 suites, 1,464/1,464 tests,
  1/1 snapshot, 330.488 seconds. Targeted ESLint passed for the updated shared contracts,
  matrix query, and graph-query regressions. This is local evidence; no hosted
  run covers the exact dirty worktree.
- `pnpm typecheck`, targeted ESLint, `pnpm verify:architecture-boundaries`,
  and staged/unstaged `git diff --check` passed after the latest source changes.
- An earlier migration-upgrade attempt exited before creating a scratch
  database because local PostgreSQL was unavailable. The later disposable-DB
  migration drill passed, with temporary databases removed.
- DocumentJob report-scope regression was observed red before adding its
  migration to the upgrade plan. After the change, focused migration-workspace
  and document-runner tests passed 2 suites / 11 tests. Prisma schema validation
  and client generation, root typecheck, targeted ESLint, and architecture
  boundary verification passed.
- An earlier report-scope E2E attempt failed during app setup while local
  PostgreSQL/Redis were unavailable. The full API E2E suite later passed on
  disposable services, including report-scope and provenance cases.
- Fresh embedding/retrieval verification on 2026-10-31 passed 5 suites / 40
  tests (`embed-snapshot-artifacts`, RAG isolation, embedding repository,
  OpenAI provider identity, and hybrid retrieval). `pnpm typecheck:backend`
  and targeted ESLint on the affected production files also passed. These are
  offline checks and do not prove the PostgreSQL vector-query or API/worker
  E2E assertions.
- Run-level retrieval fallback diagnostics were observed red in two service
  cases and one application-step case, then green after the retrieval result
  envelope and analysis-metadata propagation. The focused regression batch
  passed 10 suites / 70 tests; `pnpm typecheck:backend` passed. On 2026-10-31,
  the real API + PostgreSQL + Redis `embedding-model-identity.e2e-spec.ts`
  passed 1 suite / 8 tests against disposable no-volume containers on ports
  15432 and 16379. The foreign-model-only assertion verified
  `lexical_fallback / NO_COMPATIBLE_CHUNKS` and excluded the foreign artifact.
  The persistent Compose services and volumes were not used or modified.
- Historical compatibility was checked against base-HEAD source: the writer
  persisted `result.model`; OpenAI and Google providers returned the requested
  default model ID. This supports keeping existing model IDs and avoiding a
  relabel migration. Actual persisted model distribution and retrieval from
  historical production data remain unverified; the E2E used a fresh isolated
  database and does not establish the production distribution.
- Migration-upgrade verification first reproduced a diagnostic-propagation
  failure: the DocumentJob preflight raised the intended provenance exception,
  but Prisma surfaced the trailing aborted-transaction error. The migration now
  reports the preflight before `BEGIN`, then reacquires the write lock and
  rechecks before schema changes. Its migration-workspace regression was red
  before the change and passed 8/8 afterward; the complete PostgreSQL migration
  upgrade/data-survival gate then passed. Temporary databases were removed,
  and no application or persistent Compose database was used.
- On 2026-10-31, current-worktree API + disposable PostgreSQL/Redis E2Es passed:
  full `auth-rbac` 49/49; project-role, membership and resource authorization
  3 suites / 13 tests; and final reviewed-report audit flow 35/35. The report
  suite includes the real PostgreSQL Review Note vs Finalize interleaving: the
  note write waits on the analysis row lock, finalization commits one snapshot,
  and the later note receives 409 while the pre-finalization note remains.
  These suites do not establish exhaustive endpoint-by-role coverage.
- Queue recovery E2Es passed 5 suites / 19 tests on the disposable services:
  worker-process restart 1/1, document-job startup recovery 5/5, Redis outage
  and restart 1/1, scan enqueue/startup recovery 5/5, and impact-analysis
  enqueue recovery 7/7. The worker startup `P2028` issue was not reproduced in
  this run. The isolated Redis service created by the outage test and the
  disposable PostgreSQL/Redis pair were removed afterward.
- Before the confidence-integrity iteration, `pnpm test:e2e` passed 41/41
  suites and 271/271 tests on disposable no-volume PostgreSQL/Redis. The latest
  full E2E result is 41/41 suites and 273/273 tests on a fresh local Compose
  PostgreSQL scratch database. Root typecheck and lint were rerun after the
  final fixture update; lint had 44 type-only import warnings and no errors.
- Confidence-integrity regression was red before implementation: the AI
  schema accepted `-0.01`/`1.01`, PostgreSQL persisted `1.01`, and the graph
  API omitted a valid zero. After the fixes, the schema suite passed 5/5 and
  the entire final-report API/PostgreSQL E2E passed 37/37. PostgreSQL rejected
  invalid persisted confidence with Prisma `P2039`, left prior values intact,
  and accepted `0`, `1`, and `null`. `pnpm verify:migration-upgrade` passed on
  scratch databases, including separate invalid-history cases for both
  tables. Root `pnpm typecheck` passed; root `pnpm lint` had 44 existing
  type-only import warnings and zero errors. The E2E used `.env.test` target
  `localhost/ba_helper_test`; production databases were not accessed.
- The first local migration apply refused the deliberately invalid `1.01`
  row left by the red persistence test. I restored that exact test fixture,
  resolved its failed migration record as rolled back in `ba_helper_test`, and
  the subsequent full affected E2E and migration-upgrade drill passed.
- After this iteration, full `pnpm test:ci` passed 248/248 suites,
  1,469/1,469 tests and 1/1 snapshot in 328.805 seconds. This is local
  validation; the worktree is still dirty and there is no exact-candidate
  hosted CI result.
- The first full E2E run against the existing `ba_helper_test` database failed
  in two suites: its applied copy of the still-uncommitted Evidence migration
  predated the worktree CHECK addition, and the matrix fixture used malformed
  retrieval diagnostics. The matrix fixture now uses the shared runtime shape;
  both affected suites passed on a fresh scratch database, then the complete
  API E2E passed 41/41 suites and 273/273 tests on that scratch database. The
  existing `ba_helper_test` database still has the older migration state and
  should not be used as proof of the current migration contents.
- The merged-report review-panel regression was red before the form-state fix:
  both tests found that decision/note state was cleared immediately. After the
  panel awaited its async callback and the page propagated mutation failures,
  the focused component suite passed 2/2; the complete web suite passed
  47/47 suites and 204/204 tests.
- Retrieval contract regressions were red before the fix: `KIND` was rejected,
  malformed diagnostic JSON passed, and matrix evidence omitted signals. After
  the shared schema and matrix mapper change, contract, graph, matrix and
  controller tests passed 4 suites / 31 tests; full workspace typecheck passed.
- The production web build passed after the review-panel fix. The complete
  production-build Playwright run passed 15 tests and skipped 1 by design:
  route smoke covered all
  18 inventoried page routes, the responsive sweep passed its 9 screens at all
  five widths, and multi-repo review/finalize passed on desktop and Pixel 7.
  The one pinned-comprehension browser test is deliberately gated and skipped
  in the general suite; its dedicated browser verifier passed 5/5 using a
  generated proof in disposable PostgreSQL. The multi-repo journey was then
  extended to sweep detail and merged-report at all five widths; its targeted
  production browser run passed 2/2 again. Manual accessibility checks remain
  open.
- An earlier local `next dev` navigation timed out while the Reports route was
  cold-compiling (~62 seconds) and HMR/assets were still pending. The production
  build route smoke and full browser suite passed, so this reproduces a local
  dev-server performance limitation rather than a confirmed product route bug.
- Full `pnpm typecheck` and `pnpm lint` passed after the latest code change.
  Lint reports 44 existing type-only import warnings (5 backend-runtime,
  39 API) and zero errors.
- The API consumer parity sweep found two frontend hooks using
  `as unknown as z.ZodType<...>` around shared response contracts. Removed the
  casts from final-reviewed-report and requirement-create hooks so response
  types are inferred from their runtime schemas. `pnpm typecheck:web`, focused
  ESLint for both hooks, and full web Jest passed (47 suites / 204 tests). This
  closes those two compile-time assertion gaps only; exhaustive mapper field
  semantics and response parity across all API consumers remain open.
- `ScanHealthCard` accepted any string `coverageStatus` plus two numeric counts,
  then cast incomplete diagnostic JSON to the full UI type. Its regression was
  red: an incomplete payload rendered a `FULL` badge and blank metadata/counts.
  Added `scanHealthDiagnosticPayloadSchema` matching the analyzer's persisted
  writer shape; the UI now shows its unavailable state for incomplete or
  malformed payloads. The contract suite passed 2/2, component suite 2/2, full
  web Jest 48/48 suites / 206 tests, web typecheck passed, and focused ESLint
  exited 0 (with the Next rule's existing missing-`pages/` warning). This does
  not validate every diagnostic code's generic `payload` field.

The latest local full `pnpm test:ci` after report provenance validation passed
249/249 suites, 1,472/1,472 tests and 1/1 snapshot in 337.817 seconds. The full web
suite passed 48/48 suites / 206/206 tests. These validate the current dirty
worktree only; hosted CI on an exact candidate remains open.

## Clarification snapshot provenance follow-up (2026-10-31)

- A PostgreSQL API E2E reproduced report drift: an answer committed while the
  document worker was pending appeared in Markdown for a report snapshot that
  had captured the clarification as open. The assertion failed before the fix.
- Added nullable `ReviewedReportSnapshot.clarificationsSnapshot`, its shared
  Zod response contract and migration. Snapshot creation and clarification
  create/answer operations now lock the parent analysis row; answer writes use
  an `OPEN` compare-and-set. New snapshots freeze question, answer, status and
  creation time. Older snapshots reconstruct historical state from persisted
  create/answer/cancel timestamps.
- The PostgreSQL E2E now pauses finalization after snapshot data is read,
  starts an answer through HTTP, confirms PostgreSQL blocks it on the analysis
  row, then verifies both snapshot/report endpoints retain `OPEN` while the
  clarification API returns the subsequently saved answer. The full report
  audit E2E passed 38/38; the final version of the concurrency test passed
  separately 1/1. Contract/content-builder tests passed 3 suites / 14 tests.
- Root `pnpm typecheck` passed. Workspace lint passed with 44 existing
  type-only import warnings and zero errors. The full `pnpm test:ci` run passed
  249/249 suites, 1,472/1,472 tests and 1/1 snapshot in 337.817 seconds.
  Migration-upgrade/data-survival verification passed on scratch PostgreSQL.
  No persistent test or production database was modified.
- The selected rollout is to stop and drain API and worker writers, apply the
  migration, then start the updated API and worker. No live rollout or hosted
  CI run covers this dirty worktree; the release verdict remains PARTIAL.

## CI App-test failure follow-up (2026-10-31)

- GitHub Actions run `40878312242` failed on HEAD `762759cb2623ff51ee2fcb785352a826125b7131`; migration upgrade, lint, typecheck, builds, and analyzer tests passed, then App tests failed with 2 suites / 18 tests (1,382 passed). The failing suite names were `create-impact-analysis.usecase.spec.ts` and `get-impact-graph.usecase.spec.ts`.
- Log evidence shows stale unit fixtures: request-key reuse records omit nullable lineage identity fields; lineage cases lack Prisma delegates/mocks for the newly checked analysis/clarification lookups; graph evidence omits snapshot/revision identity and the artifact snapshot needed to satisfy the current scope predicate. The graph builder consequently filters those records, so the old expected nodes are absent.
- The current worktree's fixture updates now supply those fields and delegates. Running the two suites locally passed 2/2 suites and 45/45 tests. These changes are uncommitted, so this proves only the dirty worktree state; it does not replace hosted CI on an exact candidate.
- No production implementation change was needed for these failures. Classify as test-fixture drift / `TEST_GAP`; do not mark the hosted CI gate closed until the candidate commit has a passing run.

## Current-worktree migration revalidation (2026-10-31)

- `pnpm verify:migration-upgrade` passed on the current worktree. The verifier creates a randomly named scratch database on the enforced local test host, upgrades it twice, runs Prisma schema/catalog parity, checks legacy-row survival and constraint/index presence, and injects invalid historical rows to prove the provenance migrations fail closed without changing them. Its `finally` path drops the scratch database and temporary migration workspace.
- This covers the current uncommitted migration chain through reviewed-report clarification snapshots, clarification analysis scope, document-job/report scope, multi-repository lineage, and confidence bounds. It is migration evidence for this dirty worktree only; production row counts and deployment readiness remain unverified.

## Current-worktree targeted PostgreSQL reruns (2026-10-31)

- `embedding-model-identity.e2e-spec.ts` passed 1 suite / 8 tests on a disposable PostgreSQL database with API + worker and the test Redis prefix. Distinguishable same-dimension vectors from a foreign model, snapshot, and project were excluded; same-model rerun/reuse and chunker-version behavior passed. The scratch database was dropped.
- `final-reviewed-report.audit-flow.e2e-spec.ts` passed the S1/S2 retry/failure-injection case (1 passed, 37 filtered out) on a separate disposable PostgreSQL database. A failed S2 publish left S1's approved Markdown and localization unchanged; retry generated a distinct document for S2 and both report/export reads matched it. The scratch database was dropped.
- These targeted reruns strengthen local current-worktree evidence but do not replace full hosted CI or production historical-row inspection.

## API route authentication matrix (2026-10-31)

- Added `route-authentication-matrix.e2e-spec.ts`, which discovers routes from the initialized Nest `ModulesContainer` and HTTP method/path metadata. It pins the route universe at 105, asserts exactly five explicit public routes and the 12 global `@Roles` mappings, and sends unauthenticated HTTP requests to each of the other 100 routes; all returned 401 before resource lookup or mutation.
- On a disposable PostgreSQL database, the same API E2E used persisted REVIEWER and VIEWER identities to verify denied roles receive 403 on all 12 role-decorated routes; REVIEWER passed the global guard for localization while VIEWER was denied. The 3-test suite passed, backend typecheck passed, and focused ESLint passed. Scratch database and test users were removed.
- This closes route enumeration and anonymous/global-role smoke coverage. It does not yet pair all 105 routes with every project role, permission, and resource-scope outcome; that matrix remains partial.

## Next release blockers

1. Inspect production historical row counts before rollout and complete the
   project-permission route-by-role matrix. Static inspection found 26 API
   controllers and 105 route decorators; the new E2E now covers auth on every
   route and every global `@Roles` declaration. The project policy matrix
   covers 5 roles x 11 permissions, and PostgreSQL suites have broad role and
   cross-project probes, but do not yet pair each project-scoped route with
   every role and resource-scope outcome. Other full API E2E, migration drill,
   report concurrency, embedding provenance and queue recovery checks pass
   locally on disposable services.
2. Run full CI on an exact clean candidate commit. Production browser coverage
   passed locally; the general suite's pinned-comprehension test was skipped by
   design and separately passed 5/5 through its dedicated verifier.
3. Complete manual keyboard, focus, contrast and assistive-technology checks.
4. Diagnose the Vercel failure and complete API response-mapper field-semantic
   parity review. Two FE schema casts are removed; full mapper parity remains
   open.
5. Exclude staged `.pnpm-store` files and record remaining P2/P3 issues and
   unsupported configurations before release approval.

## Embedding model identity and smoke summary follow-up (2026-10-31)

- Re-inspected embedding production paths from chunk generation through reuse,
  persistence and hybrid retrieval. The current implementation keys reuse and
  vector search by `modelName`; it rejects a provider response whose reported
  model differs from the configured identity. PostgreSQL retrieval filters by
  tenant, project, repository, snapshot and model.
- Re-ran `embedding-model-identity.e2e-spec.ts` against a new local PostgreSQL
  scratch database with API, worker and the isolated test Redis target: 1 suite
  / 8 tests passed. Same-dimension vectors from a different model, snapshot or
  project were excluded; provider identity mismatch failed the indexing job
  without persisting a vector. The scratch database was dropped.
- A smoke-summary regression first failed because a persisted Google model
  name was absent from the summary. `smoke-e2e.ts` had hardcoded
  `text-embedding-3-small`. It now reads distinct model identities from the
  snapshot's persisted chunks; the summary reports the sorted identities, or
  `none` when the snapshot has no vectors. The test passed after the fix.
- Verification: smoke helper 5/5; five focused embedding/retrieval suites
  41/41; backend `tsc --noEmit`; focused ESLint on the three smoke files.
  These checks cover the current dirty worktree locally only.
- Still open: production historical embedding-model distribution, hosted CI on
  an exact clean candidate, and the unrelated current hosted App-test failures
  recorded above.

## Redis transport outage recovery E2E (2026-10-31)

- Ran `redis-outage-recovery.e2e-spec.ts` against a disposable loopback
  PostgreSQL database and a dedicated Redis container behind a TCP proxy. The
  HTTP API created a scan command; the test removed its BullMQ row, stopped
  Redis while the reconciler and BullMQ worker remained online, and confirmed
  the durable row stayed `QUEUED` during the outage.
- After restarting Redis, periodic reconciliation re-enqueued the same
  deterministic job ID, the worker received that scan ID, and BullMQ reached
  `completed`. The API E2E passed 1/1 (20.509s). The scratch database was
  dropped and the labeled Redis container was removed.
- This verifies enqueue recovery and duplicate-safe queue identity across a
  Redis transport interruption. Its test worker acknowledges the BullMQ job
  without running the production scanner; durable production job completion
  remains covered by the separate worker-process recovery E2E.

## Untrusted AI prompt boundary follow-up (2026-10-31)

- Adversarial review found two framing gaps: requirement text was inserted
  verbatim and template variables were substituted in multiple passes, so
  user text containing `{{snapshotId}}` or replacement tokens such as `$&`
  could be rewritten as prompt syntax; repository excerpt newlines could also
  place a forged `UNTRUSTED_REPOSITORY_CONTENT_END` marker on its own line.
- Added red regressions for both cases. The fix renders the prompt template in
  a single pass, JSON-encodes requirement and domain-context values, and
  JSON-escapes each evidence field. The system prompt now states that
  requirement text, domain context, and repository content are untrusted data.
  The impact-analysis prompt version was bumped from `2.1.0` to `2.2.0`; the
  smoke rubric now identifies its checked-in `2.0.0` output as historical.
- The formatter boundary regression and prompt registry regression passed
  after the fix. Focused validation passed 6 suites / 19 tests, including
  output normalization, schema checks, the scanner fixture, and real HTTP
  capture through OpenAI, DeepSeek, Anthropic, and Google adapters with
  redaction both enabled and disabled in config. Root typecheck and focused
  ESLint passed.
- No real provider was called. This verifies final adapter request framing and
  the application-side evidence normalizer; it does not prove that every real
  model will semantically ignore malicious text. The checked-in 2.0.0 smoke
  JSON remains historical and was not edited to look like a new run.
- Still open: exact-candidate hosted CI, complete changed-file review, the
  remaining authorization/UI/accessibility release gates, and production data
  inspection. Verdict remains `PARTIAL`.

## Periodic stale-worker recovery follow-up (2026-10-31)

- Reproduced a real orphan window: after the worker reported `WORKER_READY`, a
  stale `RUNNING` document row with no matching BullMQ job remained `RUNNING`
  through the four-second recovery observation. The new PostgreSQL/Redis
  process E2E failed as expected before the fix.
- Root cause: startup called both queued-row and stale-row recovery, but the
  periodic timer only re-enqueued `QUEUED` rows. A `RUNNING` row orphaned later
  could wait indefinitely for another worker restart.
- The periodic reconciliation now checks queued rows and stale running rows in
  the same non-overlapping cycle. Redis-inspection or stale-recovery failures
  produce a safe retryable diagnostic and are retried on the next cycle. The
  state-machine document now describes this behavior.
- The real worker-process E2E passed after the fix and verified the row became
  `FAILED` with `WORKER_JOB_ORPHANED` plus its `DOCUMENT_JOB_FAILED` audit
  event. The focused recovery unit suite passed 11/11; backend typecheck and
  focused ESLint passed. The test used a disposable local PostgreSQL database
  and isolated Redis target; the scratch database was dropped.
- Revalidated on the current worktree: `redis-outage-recovery.e2e-spec.ts`
  passed 1/1 with a disposable PostgreSQL database and dedicated Redis
  container/TCP proxy. A queued scan with its BullMQ row removed survived a
  Redis stop/restart; periodic recovery delivered the same deterministic job
  to a BullMQ worker while it remained online. The test handler acknowledges
  the queue job without running the production scanner. Separately,
  `worker-process-recovery.e2e-spec.ts` passed 2/2 and confirmed real worker
  process recovery, including completed report persistence after restart.
  Both scratch databases were dropped and the test Redis keys/container were
  removed.
- Re-ran `impact-analysis-enqueue-recovery.e2e-spec.ts` and
  `document-job-startup-recovery.e2e-spec.ts` together: 2/2 suites and 12/12
  tests passed. The impact suite exercises periodic redelivery after a failed
  enqueue and after killing the queue's Redis client; the document suite
  exercises periodic redelivery after a failed enqueue while recovery remains
  online. The real worker-process suite separately verifies report completion
  after restart. PostgreSQL scratch DBs were dropped and Redis DB 14 returned to
  empty after removing only the test-prefixed keys.
- This closes only the demonstrated post-startup stale-row gap. The prior
  worker-startup `P2028` report was not reproduced or diagnosed in this pass.
  Current E2Es cover scan server restart through a controlled BullMQ handler,
  impact-analysis Redis-client loss, and document enqueue failure with periodic
  recovery. They do not run the production scanner through a Redis server
  restart, exercise server restart for the other queue types, or cover
  multi-repo fan-out recovery. Other provider/queue failure points, hosted CI on
  an exact candidate, and production readiness remain open. Verdict remains
  `PARTIAL`.

## Evidence origin scope migration and standards follow-up (2026-10-31)

- Added migration `20261031160000_evidence_source_origin_scope`. CODE, TEST,
  STATIC_ANALYSIS and COVERAGE evidence must identify a repository snapshot;
  REQUIREMENT_INPUT evidence must identify an immutable requirement revision.
  The migration preflight reports invalid historical rows before adding the
  PostgreSQL check, so it fails closed without rewriting evidence.
- The API/PostgreSQL E2E was red before the migration: all five missing-origin
  cases persisted successfully. After the check was applied, the evidence
  artifact/snapshot scope suite passed 7/7 on a disposable database. The
  migration-upgrade verifier also seeded pre-existing unscoped rows, confirmed
  the expected preflight failure, verified those rows unchanged, and confirmed
  no partial constraint remained.
- The first migration-verifier run exposed a fixture defect: unquoted
  `sourcePath` was folded to lowercase by PostgreSQL. A new migration-workspace
  regression failed before that correction; the fixture now quotes the column.
  `migration-workspace.spec.ts` passed 10/10, and the full
  `pnpm verify:migration-upgrade` passed afterward, including this fail-closed
  history case. Scratch databases and temporary workspaces were cleaned up.
- Standards review found direct Prisma reads in
  `ApprovedReportContextReader` and a 411-line touched retrieval service. The
  report-context reads now go through `DocumentRepository`, retaining
  analysis/snapshot/evidence scoping. Its focused repository tests passed 7/7.
  Hybrid retrieval ranking and option parsing were extracted into focused
  helpers; the service is now 275 lines. Retrieval and migration/report
  focused suites passed 35/35.
- Local root `pnpm typecheck` passed. The complete root `pnpm test` then passed
  256 suites / 1,492 tests / 1 snapshot (175.297s) on the designated local
  `ba_helper_test` database. Root `pnpm lint` exited 0; it reports
  `consistent-type-imports` warnings (including 39 in `apps/api` and 5 in
  `backend-runtime`) but no lint errors. Focused ESLint for the recent demo and
  impact-analysis edits also had no errors. Targeted `git diff --check` passed
  for the changed files. The worktree-wide check still reports the unrelated
  existing extra blank line at EOF in `get-matrix-row-detail.usecase.ts`.
- No production database was queried or modified. Deployment still requires
  stopping and draining API and worker writers before applying the migration.
  Exact-candidate hosted CI and remaining authorization, accessibility,
  response-mapper, Vercel, and production-history gates remain open; verdict
  remains `PARTIAL`.

## Integration and full-suite follow-up (2026-10-31)

- Fresh remote inspection confirmed the integration branch includes both
  source tips, with `origin/main...origin/codex/integration-product-integrity-v1`
  at `0 63`. The exact 16-path overlap was compared by blob across the merge's
  parents. The finalize spec in the merge includes the status-guard assertion
  and a regression where a zero-row conditional transition rejects finalizing
  and does not create a report snapshot. There are no unmerged paths.
- The first full API E2E rerun exposed two seed helpers missing `snapshotId`
  under the new evidence-origin constraint. Adding the persisted analysis
  snapshot identity made both focused suites pass (88/88), followed by the
  complete `pnpm test:e2e` run passing 42/42 suites and 283/283 tests on a
  disposable PostgreSQL database plus Redis logical DB 1. The scratch database
  was dropped.
- Browser testing found the desktop finalize action could show success while
  `router.push` did not leave the review route. The successful mutation now
  performs a full navigation to the persisted approved report. The browser
  regression asserts successful finalize HTTP response, destination route,
  rendered report data, review state and supported viewport behavior. Focused
  desktop/mobile verification passed; the full `pnpm test:pw` run passed 15
  tests with one explicit opt-in pinned-proof test skipped by design (the
  dedicated pinned-proof verifier passed separately, 5/5). Route smoke passed
  all 18 inventoried routes; responsive sweep passed 9 critical screens across
  all five required widths with automated axe checks.
- Latest `pnpm test:web` passed 48/48 suites and 206/206 tests after the
  navigation fix. Root `pnpm test` passed 256 suites / 1,492 tests / 1
  snapshot; `pnpm test:ci` passed 250 suites / 1,481 tests / 1 snapshot;
  `pnpm test:analyzer` passed 46 suites / 288 tests. Root typecheck passed.
  Root lint exited 0 with type-only import warnings and no lint errors.
- These results are local to the dirty worktree. There is no hosted CI run on
  an exact clean candidate. The route-role/resource authorization matrix,
  manual accessibility checks, complete response-mapper semantic parity,
  Vercel failure diagnosis, production historical-row checks and production
  worker `P2028` verification remain open. Verdict remains `PARTIAL`.

## Approved report cross-project authorization follow-up (2026-10-31)

- Added an API + PostgreSQL regression using a real approved report and a
  REVIEWER who has no membership in its project. Seven report, snapshot,
  review-completion and export reads return 404 without exposing report text;
  snapshot creation and document-job enqueue also return 404.
- The test verifies the report snapshot count stays at one and that document
  jobs and domain events do not change after denied requests. The exact test
  passed 1/1 on a disposable PostgreSQL database, then the full affected
  `final-reviewed-report.audit-flow.e2e-spec.ts` suite passed 39/39 on another
  disposable database. The focused run excluded 38 unrelated cases by test
  name; the full suite had no skips. Both scratch databases were dropped.
  Backend typecheck and focused ESLint passed.
- This adds concrete approved-report scope coverage, but does not close the
  full route/role/resource authorization matrix. No production database was
  queried or modified; release verdict remains `PARTIAL`.

## Analysis read-model cross-project authorization follow-up (2026-10-31)

- Extended the PostgreSQL project-role test so a non-member REVIEWER is denied
  on six analysis-scoped read routes: evidence, insights, traceability, QA
  coverage, QA evidence detail, and review queue. Each returns 404 and does not
  disclose the seeded insight description or source evidence excerpt.
- The focused E2E passed 1/1; the nine unrelated cases were excluded by the
  test-name filter. The full affected `project-role-permissions.e2e-spec.ts`
  suite then passed 10/10. Both scratch databases were dropped. Focused ESLint
  passed on both changed authorization E2E files.
- Together with the report case above, this verifies 13 distinct analysis and
  report read routes and two denied report mutations. Repository/scan,
  requirement, clarification, project-member and remaining role/resource
  combinations still require explicit route-to-test mapping. The full
  authorization gate remains `PARTIAL`.

## Embedding provenance migration failure injection (2026-10-31)

- Closed a migration-test gap: the upgrade verifier preserved one valid legacy
  `EmbeddingChunk`, but had no invalid historical embedding provenance case.
- Added `verifyEmbeddingChunkProvenanceHistoryFailsClosed` to the PostgreSQL
  scratch-database upgrade harness. It seeds a valid legacy chunk, changes its
  commit SHA, confirms the persisted chunk and snapshot disagree before
  migration, then attempts the embedding provenance upgrade.
- The first run exposed a diagnostic gap: Prisma reported only an aborted
  transaction instead of the migration's actionable provenance preflight
  message. The migration now runs that preflight before `BEGIN`, then locks the
  affected tables and repeats the invariant check inside the transaction to
  close the race before applying constraints.
- The PostgreSQL regression now requires the exact
  `Cannot enforce EmbeddingChunk provenance` diagnostic, verifies the failure
  occurs in `20261030150000_embedding_chunk_provenance_scope`, and confirms the
  historical row/content and absence of newly added constraints/indexes after
  failure. `pnpm verify:migration-upgrade`, `pnpm typecheck:scripts`, and
  focused ESLint for the migration verifier passed after the fix.
- Only scratch PostgreSQL databases were used; no production data or schema was
  touched. Rollout still requires stopping and draining API and worker writers
  before migration. The release verdict remains `PARTIAL`.

## Final reviewed report audit-flow revalidation (2026-10-31)

- Re-ran `apps/api/test/e2e/final-reviewed-report.audit-flow.e2e-spec.ts` against
  a fresh isolated PostgreSQL database. The E2E harness deployed the current
  migration chain before starting the API.
- Result: 1 suite passed, 39/39 tests passed, 0 skipped. The exact scratch
  database was dropped after Jest exited; no production database was used.
- The passing suite includes the fail-closed live-review/frozen-snapshot
  mismatch cases, decision-set change between report reads, concurrent
  clarification/snapshot ordering, and the PostgreSQL Review Note vs Finalize
  lock interleaving.
- This revalidates the report snapshot, export, review, and finalization flow on
  the current worktree. It is local evidence only; hosted CI has not run on this
  dirty worktree and the release verdict remains `PARTIAL`.

## Project authorization E2E revalidation (2026-10-31)

- Re-ran the route-authentication matrix, auth/RBAC, project-role, project-
  resource, and project-membership PostgreSQL API E2E suites together on the
  current worktree. They passed 5/5 suites and 65/65 tests with no skips.
- The route matrix checks every registered HTTP route for authentication and
  declared global-role behavior. The authorization suites exercise project
  role permissions, foreign resource IDs, denied-write persistence, and
  cross-project analysis, repository, report, review, and multi-repository
  endpoints.
- The harness used a fresh local PostgreSQL database and Redis DB 14, confirmed
  empty before the run. It dropped the scratch DB afterward; only test-prefixed
  BullMQ and rate-limit keys appeared in Redis and those keys were removed,
  leaving DB 14 empty.
- This confirms the currently covered API authorization paths locally. It does
  not close every role/resource combination or the browser authorization,
  route-state, manual accessibility, exact-candidate hosted-CI, or production
  history gates. Verdict remains `PARTIAL`.

## Multi-repo child enqueue retry (2026-10-31)

- The API/PostgreSQL/Redis regression injects one child enqueue failure during
  multi-repo fan-out, verifies the persisted failed child has no BullMQ job,
  then submits the identical request concurrently twice with the same request
  key. It asserts the same run and child IDs are returned, no third child is
  created, exactly one retry audit event is recorded, and BullMQ contains the
  expected deterministic job payload for the recovered child.
- The regression failed before the fix because the retry returned the child in
  `FAILED` with no job. The implementation now allows only the persisted
  `QUEUE_ENQUEUE_FAILED` condition to transition back to `QUEUED`; a guarded
  PostgreSQL `updateMany` and idempotent audit key make concurrent retries safe.
  Other failure codes remain terminal.
- The focused use-case suite passed 26/26. The multi-repo idempotency and
  impact-analysis enqueue recovery E2Es passed 2/2 suites and 11/11 tests on a
  disposable PostgreSQL database and Redis DB 14. Backend typecheck and
  focused ESLint passed. The scratch database was dropped and DB 14 returned
  to empty after removing test-prefixed keys.
- This is local evidence on the dirty worktree; no hosted CI run or production
  queue history covers this change. The broader Product Integrity release
  verdict remains `PARTIAL`.

## Embedding provenance and retrieval revalidation (2026-10-31)

- Re-ran `pnpm verify:migration-upgrade` with the repository-pinned Node 22
  against disposable PostgreSQL databases. The full upgrade verifier passed,
  including the invalid historical `EmbeddingChunk` commit/snapshot mismatch:
  migration preflight rejected it, preserved the original row/content, and
  left no new provenance constraints or parent identity indexes behind. The
  verifier reported no failure and removed its scratch databases.
- Ran a transaction-scoped `READ ONLY` catalog audit against the guarded local
  `DATABASE_URL_TEST` target `localhost:5432/ba_helper_test`. It contained 58
  applied migration records, 3 rolled-back attempts, and 0 incomplete
  attempts. The business tables audited were empty, including
  `EmbeddingChunk`; therefore this does not establish production history or
  model distribution. All 5 embedding provenance constraints were validated,
  all 8 embedding indexes were valid/ready, and the empty table had no
  detectable scope violations or duplicate identities.
- Focused API/PostgreSQL/Redis embedding E2E passed 3/3 suites and 15/15 tests;
  focused embedding/retrieval unit tests passed 7/7 suites and 57/57 tests;
  retrieval contract tests passed 2/2; backend typecheck passed. Coverage
  includes model mismatch rejection, same-snapshot reuse, old chunker rebuild,
  redacted input/hash persistence, project/snapshot/model-scoped vector search,
  prior-snapshot copy, and persisted provenance constraints.
- PostgreSQL remained empty after the E2E run and no upgrade scratch database
  remained. Redis used the isolated test URL; key-count cleanup was not
  independently measured in this pass. Hosted CI on a clean candidate,
  production historical counts, and the broader release gates remain open.
  Verdict remains `PARTIAL`.

## E2E queue cleanup and broad-suite revalidation (2026-10-31)

- The new queue-prefix cleanup regression first failed as expected: a real
  BullMQ job remained after its API test app closed. The harness now removes
  only the four BA_Helper queue names under that app's unique E2E prefix. The
  regression passed 1/1 and confirmed a job under a different prefix survives.
- Re-ran `pnpm verify:migration-upgrade` using the PostgreSQL scratch-upgrade
  harness selected for this iteration. It passed, including invalid historical
  embedding commit/snapshot provenance rejection, preservation of the row, and
  absence of partially applied constraints/indexes after failure.
- The clean, sequential full `pnpm test:e2e` run reported 41/43 suites and
  272/286 tests passing. `worker-process-recovery.e2e-spec.ts` failed because a
  worker did not emit `WORKER_READY` within 60 seconds. In the same full run,
  `code-comprehension.e2e-spec.ts` exceeded its default 30-second setup hook;
  its subsequent cleanup also attempted to use an uninitialized Prisma client.
  Jest printed that it retained an asynchronous handle after its summary; the
  completed Jest PID was stopped, and no test process remains.
- Isolated regressions passed after the harness changes: queue cleanup 1/1,
  worker process recovery 2/2, and code-comprehension 13/13. The code-
  comprehension suite now allows 90 seconds for setup and guards cleanup when
  setup did not create the app/client. Worker startup failures now include a
  short filtered diagnostic excerpt with credential URLs redacted. The worker
  timeout seen in the full run did not recur in the isolated run; treat it as
  load-sensitive and unresolved pending another full-suite pass.
- Workspace `pnpm typecheck` passed. `pnpm lint` completed with 0 errors and 44
  existing `consistent-type-imports` warnings across backend/API files. No
  production database was used, and this iteration made no schema changes.
  Hosted CI on the current dirty candidate, Redis-wide residual key counts,
  and remaining Product Integrity release gates are still open. Verdict
  remains `PARTIAL`.
