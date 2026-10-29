# API Contracts

## Executable Scalar Reference

`GET /api/docs` renders Scalar; `GET /api/openapi.json` serves the same live
OpenAPI document. Route discovery and HTTP/auth metadata come from Nest.
Documentation under `apps/api/src/bootstrap/api-docs/` maps operations to shared
Zod request/response contracts. Additions must update the catalogue: generation
rejects undocumented or orphan operations, and tests compare controller inputs.
The locally served, pinned Scalar bundle needs no external CDN or request proxy.
See [API reference usage](../api/README.md) for authentication, workflow and checks.

Event-log response identity is explicit: `actorType` must be `SYSTEM` or `USER`.
The event-log service resolves legacy payloads to one of those values before
mapping the DTO. The shared response contract rejects missing or unsupported
values; consumers must not repair malformed identity by defaulting it to
`SYSTEM`.

Reviewed-report snapshot responses and final reviewed-report responses validate
the frozen evidence-quality item array, summary counters, and nullable
evaluation context against their shared schemas. A malformed persisted frozen
payload fails with `REPORT_PROVENANCE_MISMATCH`; report readers must not replace
malformed decision rows with an empty list or silently recalculate them from
live review state.
Existing acknowledgement shapes, report-job input, review-note lists and queue
retry responses now have shared schemas as well. This documentation work adds
no domain state or persisted fields and does not tighten endpoint validation.

Impact graph dependency edges may expose `confidence` in [0, 1] and `provenance`
validated by `dependencyEdgeProvenanceSchema`. Provenance describes a static
source relationship and identifies its resolver, source line locations and
same-snapshot evidence provenance key. It is absent for legacy edges without
provenance. Reversing `TESTS` for layout never reverses the evidence origin.
No execution, assertion coverage or test-result claim follows from this field.

Artifact list items and impact graph artifact nodes optionally expose validated
`testCase` metadata for `JEST_TEST_CASE`: `framework`, `suitePath`, `title`,
effective `modifier`, `declaredModifier`, and `parentFileArtifactKey`. The modifier
enum is `NORMAL | SKIP | TODO | ONLY`; it is not execution status. Invalid or
legacy metadata is absent. Raw database metadata is never returned.
`TEST_FILE` distinguishes file containers from real `TEST_CASE` artifacts on
new scans. Multi-repo artifact counts may include `TEST_FILE` separately;
existing case count fields retain historical snapshot semantics.

`testCase.parameterized?: boolean` explicitly identifies a parameterized source
callback. Current scans emit `true` for supported inline-array `it/test.each`
declarations and omit the field for ordinary cases. Titles retain placeholders;
one artifact represents one source callback regardless of data rows. No row
count or runtime result is inferred. The field is additive in artifact/graph,
QA and version-1 saved-report metadata. Missing historical flags remain absent.

`testCase.behaviorEvidence?: StaticTestBehaviorClaim[]` optionally exposes
bounded source-derived Jest declarations. Each claim has a `kind` (`SETUP_HOOK`,
`TEARDOWN_HOOK`, `INPUT`, `ACTION`, `ASSERTION`, `MOCK`, or `EXPECTED_OUTCOME`),
`evidenceKind: STATIC_DECLARATION`, redacted `sourceText`, an exact
repository-relative source location (UTF-16 offsets with exclusive end and
one-based line/column coordinates), and the snapshot `commitSha`. These claims
also carry `evidenceProvenanceKey`, linking them to the persisted redacted test
file evidence that contains their source locations. They do not establish runtime execution, pass/fail, or
assertion coverage. Claims with invalid source paths or commit context are
rejected at persistence; older test cases without this optional field remain
valid.

## Static Code-To-Test Projection

`GET /api/v1/impact-analyses/:analysisId/qa-coverage` reads persisted data for the
analysis snapshot, independently of display graph nodes, layout directions and
50-node/80-edge display limits. The existing analysis permission guard applies.
Only impacted code artifacts become rows; other snapshot artifacts may appear
as intermediate source-path steps. Rejected links remain visible as review
context, matching the analysis graph's existing selection semantics.

The existing wire statuses are retained for compatibility:

| Wire status | Meaning |
| --- | --- |
| `COVERED` | A supported active test source declaration directly references the artifact |
| `INDIRECT_ONLY` | Such a declaration reaches the artifact through static `CALLS` edges |
| `NO_TEST_FOUND` | No supported reference was found in the inspected paths |

These are static-reference classifications. They do not certify assertions,
execution, pass/fail or runtime coverage. Dependencies along a call path may be
mocked. `summary.covered` counts direct references; severity is a review priority
heuristic, not a measured defect probability. Every row includes a
`confidenceNote` describing this limit. Review queue diagnostics consume this
same projection and remain non-blocking for finalization.

Optional additive fields preserve older clients and test adapters:

- `traceContext`: static basis, immutable commit/analyzer identity, snapshot
  coverage, effective search limits and explicit limitation codes.
- `testArtifacts[].testCase`: validated Jest metadata.
- `testArtifacts[].trace`: one shortest semantic path per case, with ordered
  artifacts and `TESTS` then `CALLS` steps. Each step contains its persisted edge
  ID, source evidence ID and validated provenance; no source excerpt is returned.
- `tracesTruncated`: indicates that additional distinct cases were omitted.

Read limits are 1000 impacted artifacts, 5000 candidate edges, four `CALLS`
hops and three case paths per artifact. The reader probes for overflow and uses
a repeatable-read transaction. Summary counts apply to returned impacted rows.
`IMPACTED_ARTIFACT_LIMIT`, `EDGE_LIMIT`, `CALL_DEPTH_LIMIT`, `TRACE_SAMPLE_LIMIT`,
`SNAPSHOT_PARTIAL`, `LEGACY_TEST_IDENTITIES`, `SCANNER_LIMITATIONS` and
`UNSUPPORTED_SOURCE_RELATIONSHIP` expose incomplete inspection. In particular,
`NO_TEST_FOUND` never means that no tests exist in the repository.

### Trace Evidence And Saved Report Traces

`GET /api/v1/impact-analyses/:analysisId/qa-coverage/evidence/:evidenceId` requires
the existing analysis read permission. It returns `TestTraceEvidenceResponse`:
analysis ID, repository snapshot ID, commit SHA and the standard evidence DTO.
The evidence must belong to a returned static case path and match that step's
snapshot, source artifact, provenance key, source type/file and line range.
An arbitrary same-snapshot evidence ID is insufficient. Missing or unsupported
proof returns 404. This endpoint is a live review read; report views do not use
it to reconstruct saved output.

Reviewed snapshot and final reviewed report DTOs optionally expose nullable
`testTraceSnapshot`: `{ version: 1, coverage }`, validated by
`reportTestTraceSnapshotSchema`. A new payload requires commit/analyzer context,
case metadata and connected semantic paths with same-snapshot source evidence.
It is captured before the existing finalization commit and persisted with the
reviewed snapshot. Final report reads and the Markdown/PDF generation path use
that captured projection. They do not invoke the live QA projection. Historical
null values mean no saved test trace is available; no execution results or
retrospective paths may be inferred for them.

### Code-First Comprehension Projection

`GET /api/v1/snapshots/:snapshotId/artifacts/:artifactId/comprehension` is a
read-only, snapshot-scoped projection for a production artifact. It returns the
persisted source excerpt, bounded direct dependencies, reverse static call paths,
and related Jest declarations grouped as setup, inputs, invocations, assertions,
mocks, and expected outcomes. `behaviorAssociations` links an assertion to an
invocation only when the scanner persisted an exact AST subject reference;
ambiguous or unsupported subjects remain unresolved. Every returned source item
carries the selected commit SHA and either persisted evidence provenance or an
explicit limitation.

The projection is deliberately static: `snapshotContext.basis` is
`STATIC_SOURCE_REFERENCE` and `runtimeObservations` is always `NOT_IMPORTED`.
`CALL_PATH` and `DIRECT_REFERENCE` describe graph relationships only; they do not
claim that a test ran, passed, asserted coverage, or reached a branch. Conditions
and method signature/exception declarations are returned only when the selected
artifact carries scanner-produced AST metadata. Missing metadata produces the
bounded `CODE_EVIDENCE_UNAVAILABLE` limitation; the reader never reconstructs
control flow or runtime values from an excerpt.
Unsupported or incomplete metadata remains in `unresolved`/`limitations` rather
than being inferred. The reader enforces snapshot permissions and rejects test
artifacts as comprehension roots.
Repeated edge provenance failures are summarized with a count and up to three
edge IDs so they cannot crowd out a scan-bound limitation in the 50-item
response limit.
When no supported `TESTS` relationship exists, `limitations` includes
`NO_SUPPORTED_TEST_REFERENCE`; this keeps production evidence explorable without
making a no-coverage or no-tests claim. If test edges exist but no bounded path
reaches the selected artifact, the response reports
`RELATED_TEST_PATH_UNRESOLVED` instead.

The response is bounded to four reverse `CALLS` hops, 50 scenarios per page,
an offset of at most 500, and 80 relationships. Test pagination orders distinct
Jest case identities, validates their persisted source paths, and sets
`scenarioPagination.hasMore` only when another validated case is retrievable
at an allowed next offset. `SCENARIO_OFFSET_LIMIT` reports validated cases
beyond the last page clients can request.
The candidate search stops after 5,000 distinct source identities and reports
`SCENARIO_SOURCE_SCAN_LIMIT` if that bound prevents a complete answer. Direct
analyzer `USES` entity dependencies, persisted as `REFERENCES`, require matching
source provenance before display.
`truncated` and `COMPREHENSION_LIMIT` make paths omitted by a hard bound
visible. A retrievable page indicated by `scenarioPagination.hasMore` is not
truncation; scenarios beyond the last allowed offset or beyond the bounded
candidate scan are. Clients may request `scenarioLimit` and `scenarioOffset`;
the default page is 50 scenarios at offset 0.
The projection reads existing artifact, evidence, and dependency-edge records;
it does not run a second analyzer or persist a new graph. Completed projections
are cached in the API process by immutable snapshot ID, artifact ID, page, and
projection version with a bounded 64-entry FIFO; authorization and snapshot
validation still run before a cache hit is served. A new projection version
invalidates the process cache without a schema migration.

`GET /api/v1/snapshots/:snapshotId/artifacts` keeps its historical unfiltered
response for compatibility. Visual Test Trace uses the bounded discovery form:
`scope=production&limit=50&offset=<page start>` with optional `search` over
method names, artifact keys, and file paths. The navigator debounces search and
loads additional pages on request. It stops after offset 500 and shows a search
prompt if more artifacts exist beyond that browsing limit. Results are ordered
by artifact type, artifact key, then ID. The API returns only supported
production artifact types and optional `hasMore`, `limit`, `offset`, and
`limitReached` fields. `hasMore` means another page can be requested within
the offset 500 bound; `limitReached` means additional matching rows exist past
that bound. The API overfetches one row without loading the full snapshot.

## Contract Boundary

Use REST resources and shared Zod contracts:

```text
Prisma model -> application result -> API mapper -> Zod DTO -> consumer
```

Never expose Prisma relation shapes directly to the frontend or CLI consumer.
Keep contracts in `packages/contracts` after workspace scaffolding exists.

## MVP Resources

```http
POST /api/v1/auth/login
POST /api/v1/auth/dev-login
POST /api/v1/auth/accounts
POST /api/v1/auth/accounts/:userId/reset-password
POST /api/v1/auth/accounts/:userId/disable
GET  /api/v1/auth/me

GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/:projectId/members
POST /api/v1/projects/:projectId/members
PATCH /api/v1/projects/:projectId/members/:userId
DELETE /api/v1/projects/:projectId/members/:userId
GET  /api/v1/workspace/current
POST /api/v1/workspace/select-project
GET  /api/v1/system/live
GET  /api/v1/system/ready
GET  /api/v1/system/operations   (ADMIN)
GET  /api/v1/domain-packs

GET  /api/v1/projects/:projectId/repositories
GET  /api/v1/projects/:projectId/repositories/:repositoryId
POST /api/v1/projects/:projectId/repositories
POST /api/v1/repositories/:repositoryId/scan-jobs
GET  /api/v1/repositories/:repositoryId/scan-jobs/:scanJobId
GET  /api/v1/snapshots/:snapshotId/artifacts
GET  /api/v1/snapshots/:snapshotId/artifacts/:artifactId/comprehension
GET  /api/v1/snapshots/:snapshotId/graph

GET  /api/v1/projects/:projectId/requirements
GET  /api/v1/projects/:projectId/requirements/:requirementId
POST /api/v1/projects/:projectId/requirements
POST /api/v1/requirements/:requirementId/revisions
POST /api/v1/requirement-revisions/:revisionId/qualify
POST /api/v1/requirement-revisions/:revisionId/impact-analyses
POST /api/v1/projects/:projectId/multi-repo-analyses
GET  /api/v1/projects/:projectId/multi-repo-runs
GET  /api/v1/multi-repo-runs/:runId
GET  /api/v1/multi-repo-runs/:runId/merged-report-draft
POST /api/v1/multi-repo-runs/:runId/merged-report/finalize
GET  /api/v1/multi-repo-runs/:runId/merged-report
POST /api/v1/multi-repo-runs/:runId/merged-report/review-decisions
GET  /api/v1/multi-repo-runs/:runId/merged-report/review-decisions
GET  /api/v1/multi-repo-runs/:runId/merged-report/review-decisions/latest
GET  /api/v1/multi-repo-runs/:runId/merged-report/export.md
GET  /api/v1/multi-repo-runs/:runId/merged-report/export.pdf

GET  /api/v1/projects/:projectId/analyses
GET  /api/v1/impact-analyses/:analysisId
GET  /api/v1/impact-analyses/:analysisId/workspace
GET  /api/v1/impact-analyses/:analysisId/insights
GET  /api/v1/impact-analyses/:analysisId/evidence
POST /api/v1/impact-analyses/:analysisId/finalize

POST /api/v1/insights/:insightId/confirm
POST /api/v1/insights/:insightId/reject
POST /api/v1/traceability-links/:linkId/confirm
POST /api/v1/traceability-links/:linkId/reject
PUT  /api/v1/impact-analyses/:analysisId/review-items/:itemId/decision

GET  /api/v1/impact-analyses/:analysisId/documents
GET  /api/v1/impact-analyses/:analysisId/approved-report
GET  /api/v1/impact-analyses/:analysisId/approved-report/export.md
GET  /api/v1/impact-analyses/:analysisId/approved-report/export.pdf
GET  /api/v1/impact-analyses/:analysisId/final-reviewed-report?locale=en|vi
POST /api/v1/analyses/:analysisId/localization
GET  /api/v1/analyses/:analysisId/localization/:locale/status
```

`POST /api/v1/repositories/:repositoryId/scan-jobs` accepts `requestKey` and
optional `ref`. This request schema rejects unknown fields: a misspelled branch
field must fail validation instead of being stripped and silently scanning the
default ref.

Requirement creation requires a UUID `requestKey`. It is unique within the
project: retrying the same key and payload returns the original requirement
and first revision, while reusing the key with a different payload returns
HTTP 409 `REQUEST_KEY_MISMATCH`. The browser keeps the key for retries of the
same submission and clears it after a successful result or explicit reset.

The unified review-item decision endpoint also requires a UUID `requestKey`.
The browser reuses that key while retrying one failed command and rotates it
after success. Replaying a key after a newer decision does not restore the old
decision; the response reports the current persisted decision with
`idempotent=true`. Reusing the key for a different target, action, rationale,
or actor returns HTTP 409 `REQUEST_KEY_MISMATCH`. A new request that is already
in the requested state records one no-op command receipt; retries of that key
do not add further events.

Generating a localized report requires Global `ADMIN` or `REVIEWER` and the
project-scoped `report:export` permission. The operation is rate limited. The
placeholder provider is development/test-only; production localization remains
unavailable until a real translation provider is configured.

Domain pack registry responses are backend-authored:

```json
{
  "items": [
    {
      "id": "healthcare",
      "version": "0.1.0",
      "canonicalId": "healthcare@0.1.0",
      "displayName": "Healthcare Admin Workflows (PARTIAL)",
      "status": "PARTIAL",
      "description": "Partial domain pack for healthcare administrative workflows.",
      "supportedConcepts": [
        { "key": "appointment_scheduling", "label": "Appointment Scheduling" }
      ],
      "knownLimits": [
        "This pack supports administrative workflow impact analysis only."
      ],
      "requiresExplicitSelection": true,
      "aliases": ["healthcare", "healthcare@0.1.0"],
      "glossaryMetadata": [
        { "locale": "en", "status": "foundation", "version": "1.0.0", "termCount": 8 }
      ]
    }
  ]
}
```

Analysis create requests may include `domainPackId`. The frontend must send a
value returned by `GET /api/v1/domain-packs`; the backend resolves and persists
canonical metadata. Omitting `domainPackId` preserves repository-profile or
`general@0.0.0` fallback behavior.

Analysis workspace responses expose backend-authored domain capability metadata
when an analysis has applied a domain pack:

```json
{
  "overview": {
    "requirement": {
      "domainProfileId": "booking@repo-profile@0.1.0",
      "domainPack": {
        "id": "booking",
        "version": "0.1.0",
        "status": "STABLE",
        "selectedBy": "repository_profile"
      }
    }
  }
}
```

If no domain pack metadata has been applied yet, `domainPack` is `null`. The
frontend must not infer `status` from `domainProfileId`.

Approved single-repo and merged report responses include resolved domain-pack
provenance when available:

```json
{
  "provenance": {
    "domainPack": {
      "requestedDomainPackId": "healthcare",
      "domainPackId": "healthcare",
      "domainPackVersion": "0.1.0",
      "domainPackStatus": "PARTIAL",
      "selectedBy": "EXPLICIT",
      "resolvedAt": "2026-06-27T00:00:00.000Z",
      "manifestDigest": null,
      "registryVersion": null
    }
  }
}
```

This provenance is snapshot/report metadata only. Domain-pack glossary,
template, or retrieval hints still cannot satisfy an `EVIDENCED` claim without
persisted `Evidence`.

Deferred until after the Markdown report/review completion gate:

```http
GET /api/v1/impact-analyses/:analysisId/diagrams
```

## Input Boundary Contracts

Workspace resolution for the web client is backend-owned:

```json
{
  "projectId": "uuid",
  "name": "Default Project",
  "mode": "dev-single-user",
  "membershipRole": "OWNER"
}
```

In the MVP deploy path, the backend decides the current workspace in
`dev-single-user` mode and returns the selected project for the authenticated
actor. The frontend must not invent or hardcode `"default-project"` as a fake
project id or treat local storage as the source of truth.

Project switching uses:

```json
{
  "projectId": "uuid"
}
```

Project list response includes:

```json
{
  "items": [
    {
      "projectId": "uuid",
      "name": "Alpha Project",
      "membershipRole": "OWNER",
      "isSelected": true,
      "createdAt": "2026-06-08T00:00:00.000Z"
    }
  ]
}
```

Project membership management can attach existing users or create a password
user when an initial password is supplied:

```json
{
  "email": "reviewer@ba-helper.local",
  "name": "Reviewer",
  "initialPassword": "change-this-password",
  "role": "REVIEWER"
}
```

The web app signs in through `/login` using email + password. Role selection is
not part of production login; role and project capability state come from
backend-owned user and project membership records. Dev-login remains a
local/test-only fallback.

Runtime health for deploy/debug visibility uses:

```json
{
  "status": "ok",
  "serverTime": "2026-06-02T12:00:00.000Z",
  "apiVersion": "0.1.0",
  "workspaceMode": "dev-single-user"
}
```

For separate web/API deployment:

```text
WEB:
- NEXT_PUBLIC_API_URL

API:
- PORT
- WORKSPACE_MODE
- CORS_ALLOWED_ORIGINS
```

Artifact read responses include both the raw extracted type and the additive
normalized kind:

```json
{
  "id": "uuid",
  "artifactKey": "api:booking.controller.cancel",
  "name": "BookingController.cancel",
  "artifactType": "API_ROUTE",
  "universalKind": "API_ENDPOINT",
  "filePath": "src/booking/booking.controller.ts",
  "startLine": 10,
  "endLine": 22,
  "language": null
}
```

`artifactType` remains adapter-specific in 20B. `universalKind` is additive
and is the bridge toward later multi-framework adapters.

Impact diff artifact rows also include `universalKind` beside `artifactType`
so derived-analysis comparisons can display normalized artifact categories
without dropping raw extractor provenance.

Production-like API deploys must configure an explicit comma-separated
`CORS_ALLOWED_ORIGINS` allowlist. The web client requires an explicit
`NEXT_PUBLIC_API_URL` in production and must not rely on localhost fallback.

Repository creation accepts a normalized public GitHub source only:

```json
{
  "url": "https://github.com/example/booking-api"
}
```

Invalid hosts, embedded credentials/tokens, local paths, and unsupported
private sources are rejected before repository persistence or scan creation.
Syntactically unsafe refs are rejected before a `ScanJob` is created. A
syntactically safe ref that resolves ambiguously on the remote fails the
queued job with `AMBIGUOUS_REPOSITORY_REF` and publishes no new target
observation or snapshot.

Scan job creation includes a client-generated retry key:

```json
{
  "ref": "main",
  "requestKey": "uuid"
}
```

Replaying the same accepted `requestKey` for the same repository returns or
reuses the original scan execution. An intentional rescan uses a new key.
Successful safe source resolution creates or updates a `RepositoryTarget`
observation for this ref even if subsequent extraction fails. Usable
extraction publishes/reuses the commit-specific snapshot.

Repository list/detail responses expose latest published snapshot profile when
available:

```json
{
  "id": "uuid",
  "canonicalUrl": "https://github.com/example/booking-api",
  "displayName": "booking-api",
  "framework": "NESTJS",
  "latestSnapshot": {
    "id": "uuid",
    "commitSha": "abc123",
    "analyzerVersion": "0.1.0",
    "coverageStatus": "READY",
    "indexStatus": "LEXICAL_READY",
    "profile": {
      "domain": "BOOKING",
      "language": "TYPESCRIPT",
      "framework": "NESTJS",
      "architectureStyle": "MODULAR_MONOLITH",
      "sourceRoots": ["src"],
      "testRoots": ["src"],
      "diagnostics": {
        "detectedMarkers": ["NESTJS", "booking"],
        "confidence": 0.9
      },
      "profileVersion": "repo-profile@0.1.0"
    }
  }
}
```

Rules:

```text
latestSnapshot.profile is present only when a READY/PARTIAL snapshot exists
unsupported scan failures expose latestScanJob diagnostics but no snapshot/profile
profile detection does not broaden analyzer extraction support
```

Requirement intake keeps title and raw input in an immutable qualified
revision:

```json
{
  "title": "Paid booking cancellation refund",
  "rawText": "Allow users to cancel paid bookings and receive refund.",
  "submitForReadinessCheck": true
}
```

The MVP rejects requirement input containing detected credential/token/private
key material before creating a revision; encrypted sensitive-input storage is
deferred.

Result:

```json
{
  "requirementId": "uuid",
  "revisionId": "uuid",
  "title": "Paid booking cancellation refund",
  "readinessStatus": "READY_FOR_ANALYSIS",
  "validationIssues": []
}
```

A revision in `NEEDS_CLARIFICATION` cannot be analyzed.
If a revision was stored as `DRAFT`,
`POST /requirement-revisions/:revisionId/qualify` runs readiness validation
without changing its immutable title/raw text and transitions it to
`READY_FOR_ANALYSIS` or `NEEDS_CLARIFICATION`.

Multi-repo fan-out creation uses the selected project plus a ready requirement
revision and a list of repository ids:

```json
{
  "requirementRevisionId": "uuid",
  "repositoryIds": ["uuid", "uuid"],
  "allowPartialSnapshot": false,
  "requestKey": "uuid"
}
```

The backend resolves the latest observed target plus matching latest snapshot
for each repository in the same project, then creates or reuses one normal
`ImpactAnalysis` per repository. The response includes a stable `runId`, and
`GET /api/v1/multi-repo-runs/:runId` returns the grouped child analyses.
The actor must have `analysis:create` permission for both the selected project
and submitted requirement revision. A revision or repository outside the
actor's project memberships returns 404 and creates no run or child analysis;
if the actor can access both projects but submits a mixed project context, the
request returns `INPUT_PROJECT_MISMATCH`.
`GET /api/v1/projects/:projectId/multi-repo-runs` lists those runs for the
current project with derived child status counts. Run detail also returns
derived readiness and latest review-decision state per child analysis. This is
a batch/run tracking foundation. `GET /api/v1/multi-repo-runs/:runId/merged-report-draft`
returns a read-only merged Markdown draft only when every child analysis has a
latest review decision of `ACCEPTED` and no child analysis is known stale.
The merged draft is not persisted and does not create a `GeneratedDocument`.

`POST /api/v1/multi-repo-runs/:runId/merged-report/finalize` persists an
approved merged Markdown snapshot for the run. Finalize is idempotent when
child provenance is unchanged, and it revalidates child status, latest review
decision, and selected snapshot provenance immediately before writing the
approved snapshot. If the child set changes during finalization, the mutation
returns `MULTI_REPO_RUN_NOT_READY` and writes no approved snapshot.
`GET /api/v1/multi-repo-runs/:runId/merged-report`
returns that persisted snapshot plus provenance and stale status. The approved
merged report is stale when child review decisions or child analysis snapshot
provenance change after approval. Invalid persisted merged-report provenance is
treated as stale and blocks review/export until the snapshot is refreshed.
`GET /api/v1/multi-repo-runs/:runId/merged-report/export.md`
and `GET /api/v1/multi-repo-runs/:runId/merged-report/export.pdf` export only
the persisted approved merged snapshot. Stale approved merged reports remain
readable but export is blocked with `MERGED_REPORT_EXPORT_BLOCKED_STALE`.
Merged report review decisions are append-only and operate on the approved,
non-stale merged snapshot only: `POST /api/v1/multi-repo-runs/:runId/merged-report/review-decisions`
records `ACCEPTED`, `REJECTED`, or `NEEDS_MORE_CLARIFICATION` plus an optional
note; `GET /api/v1/multi-repo-runs/:runId/merged-report/review-decisions` and
`GET /api/v1/multi-repo-runs/:runId/merged-report/review-decisions/latest`
return the review history and latest merged decision. This phase does not add
merged clarification loops or merged report editing.

Multi-repo run detail and approved merged-report responses include backend
computed `mergedReportStatus` and `capabilities`. These capabilities are
effective for the current actor: state readiness is combined with project
permissions on the backend. Frontend consumers render these booleans directly
and do not infer finalize, refresh, review, or export eligibility from progress,
role, or local child-analysis counts.

## Status Contract

A job response includes:

```json
{
  "id": "uuid",
  "status": "RUNNING",
  "stage": "EXTRACTING_ARTIFACTS",
  "progress": 45,
  "error": null,
  "result": {
    "sourceTargetId": null,
    "snapshotId": null,
    "snapshotCoverageStatus": null
  },
  "capabilities": {
    "canCancel": true,
    "canRerun": false
  },
  "createdAt": "ISO timestamp",
  "updatedAt": "ISO timestamp"
}
```

While a scan is queued/running or has failed before usable extraction,
`result.snapshotId` is null. On a completed scan it identifies the published
`READY` or `PARTIAL` snapshot and `sourceTargetId` used to request an
analysis. A failed job may still expose a non-null `sourceTargetId` if safe
source resolution observed the ref before later extraction failed.

An analysis response includes:

```json
{
  "id": "uuid",
  "sourceTarget": {
    "id": "uuid",
    "requestedRef": "main",
    "resolvedRefType": "BRANCH",
    "latestObservedCommitSha": "abc123"
  },
  "snapshot": {
    "id": "uuid",
    "repositoryId": "uuid",
    "commitSha": "abc123",
    "analyzerVersion": "nestjs-ts/0.1.0",
    "coverageStatus": "READY"
  },
  "freshness": {
    "isStale": false,
    "isAnalyzerOutdated": false,
    "basis": "LATEST_OBSERVED_SOURCE_TARGET"
  },
  "requirement": {
    "id": "uuid",
    "revisionId": "uuid",
    "revisionTitle": "Paid booking cancellation refund",
    "rawText": "Allow users to cancel paid bookings and receive refund."
  },
  "status": "WAITING_FOR_REVIEW",
  "stage": "DONE",
  "progress": 100,
  "coverageWarning": null,
  "capabilities": {
    "canReview": true,
    "canFinalize": true,
    "canExport": false,
    "canRerun": false,
    "canCancel": false
  }
}
```

`freshness.basis` is:

```text
LATEST_OBSERVED_SOURCE_TARGET  branch/tag target checked against its last safe resolution
PINNED_COMMIT                   explicit full-commit target; isStale is false in MVP
```

The backend computes `capabilities`. Consumers never infer them from progress
or duplicate transition logic. `freshness.isStale` belongs to the analysis
view against its selected target, not to immutable snapshot identity. If the
analysis becomes known stale while waiting for review, `canReview` and
`canFinalize` are false by default; the user reruns against a current snapshot.

`GET /api/v1/impact-analyses/:analysisId/workspace` returns the presentation
read model for the analysis workspace. The response validates against
`analysisWorkspaceResponseSchema` in `packages/contracts` and contains:

```text
overview
impactGroups
evidenceCards
risks
unknowns
qaScenarios
reviewQueue
reportStatus
driftStatus
```

Rules:

```text
All status fields are backend-derived.
progress === 100 does not imply review complete, report generated, or drift clean.
Cards preserve analysis, requirement revision, snapshot, artifact, evidence, insight, traceability, reviewed report snapshot, document job, and source target ids where applicable.
The endpoint is a read model projection; it does not mutate analysis behavior or replace lower-level resources.
```

## Deploy Troubleshooting

When separate web/API deployment fails, diagnose in this order:

```text
1. Wrong NEXT_PUBLIC_API_URL            -> frontend bootstrap shows API URL / unreachable error
2. Missing or invalid CORS allowlist    -> browser network error, API reachable outside browser
3. Backend unavailable                   -> /api/v1/system/ready fails
4. Unsupported WORKSPACE_MODE           -> typed WORKSPACE_MODE_UNSUPPORTED from /workspace/current
5. Contract mismatch                    -> frontend shows bootstrap contract mismatch error
```

Creating an impact analysis from a `PARTIAL` snapshot requires explicit caller
acknowledgement:

```json
{
  "snapshotId": "uuid",
  "sourceTargetId": "uuid",
  "allowPartialSnapshot": true,
  "requestKey": "uuid"
}
```

`snapshotId`, `sourceTargetId`, and the revision must belong to the same
project/repository context. Cross-project input is rejected before analysis
persistence. For a moving target, its latest observed commit must equal
`snapshot.commitSha` at analysis creation; otherwise use the latest scanned
snapshot or a pinned commit target.

Optional `derivedFromAnalysisId` and `sourceClarificationId` carry rerun and
converted-clarification lineage into the persisted analysis. The actor must be
able to read each supplied source in the selected project; a source outside
the actor's memberships returns 404 before writing an analysis, event, or job.
Derived submissions also require `analysis:create-derived`. The parent
analysis and converted clarification must match the new analysis project and
requirement revision. Reusing a `requestKey` with different lineage returns
`REQUEST_KEY_MISMATCH` rather than reusing the first command's analysis.

Before use-case execution, the API also verifies that the actor can read the
submitted snapshot. A snapshot outside the actor's project memberships returns
404, without creating an analysis, job, or event. If the actor belongs to both
projects but the revision and snapshot still form a mismatched context, the
request returns `INPUT_PROJECT_MISMATCH`.

Snapshot drift samples are deterministic projections, not complete artifact
lists. The response sorts each category by canonical `artifactKey`, limits the
combined sample to `sampleLimit` items, and sets `samplesTruncated` when the
summary contains more items than the projection. Consumers must use the
summary counts for totals and treat samples as representative navigation hints.

Only published `READY` or acknowledged `PARTIAL` snapshots may be passed to
this command. Scan failures expose no snapshot eligible for analysis.

Replaying an accepted impact-analysis command with the same `requestKey`
returns/reuses the original analysis. An explicit rerun uses a new key.

The response then contains a non-null `coverageWarning` which also appears in
draft and approved generated documents.

## Impact Output Shape

The report projection separates:

```text
affectedArtifacts
evidencedFacts
inferredImpacts
unknowns
stakeholderQuestions
acceptanceCriteria
qaScenarios
traceabilityLinks
reviewedConclusions
documents
```

`affectedArtifacts` must expose whether inclusion is `EVIDENCED` or
`INFERRED`, its review status, and its traceability/evidence references. A
keyword/retrieval candidate alone is not an affected artifact conclusion.

Each insight includes:

```text
id, category, statement, certainty, reviewStatus, confidence, evidence[]
```

Certainty and human review use distinct vocabularies:

```text
certainty:    EVIDENCED | INFERRED | UNKNOWN | CONFLICTING
reviewStatus: NEEDS_REVIEW | CONFIRMED | REJECTED
```

Each traceability link includes:

```text
id, artifactId, linkType, linkBasis, reviewStatus, confidence, evidence[]

linkBasis: EVIDENCED | INFERRED
```

`UNKNOWN` is not a traceability link basis; it is represented as an insight or
stakeholder question.

`confidence` on an insight or link is a retrieval/reasoning ranking aid, not a
claim certainty level or human approval. Aggregate analysis `riskLevel` and
`confidence` are deferred until a tested scoring policy is defined; the MVP
report uses categorized insights and reviewed conclusions instead.

Generated acceptance criteria and QA scenarios are proposed follow-up
artifacts. They must distinguish preconditions supported by evidence from
policy assumptions/unknowns; they are not statements that the current system
already implements those behaviors.

Document response projections include:

```text
status: DRAFT | APPROVED
commitSha
isStale
```

Finalization request:

```json
{
  "acknowledgeUnreviewed": true
}
```

The acknowledgement is required only when one or more insights still have
`reviewStatus=NEEDS_REVIEW`.

`POST /impact-analyses/:analysisId/finalize` transitions a
`WAITING_FOR_REVIEW` analysis to `COMPLETED`, records an event, and creates
approved output projections. It does not silently treat unreviewed insight
statements as approved facts. Finalization is rejected when `isStale=true` or
when the analysis is already terminal.

The approved Markdown snapshot is the persisted source of truth. `canExport`
refers to exporting/downloading that snapshot in Markdown or deterministic PDF
form. `GET /approved-report` returns JSON metadata + Markdown snapshot; the
`export.md` and `export.pdf` endpoints return file attachments. DOCX, Jira, and
Confluence exports remain out of scope.

These file attachments are the explicit non-JSON response exception to the
frontend Zod response-schema rule. The frontend must call `apiGetFile` with the
expected media type (`text/markdown` or `application/pdf`); it validates the
response `Content-Type` and `Content-Disposition` before creating a download.
The disposition must be an attachment with a safe basename and the extension
that matches the requested format. HTML, an unexpected media type, a missing or
unsafe filename, or a mismatched extension is a failed API response, never a
successful export. The API CORS configuration exposes `Content-Disposition`
to explicitly allowed web origins so the browser can validate the filename in
split web/API deployments.

Non-2xx JSON responses use `apiErrorResponseSchema`, which accepts the shared
`AppError` envelope, NestJS framework exceptions, and the legacy localization
error shape. The frontend validates the envelope before mapping it to
`ApiError`; malformed payloads fall back to a generic status-based error. A
401 or 403 is mapped to the corresponding stable client code and user-facing
message regardless of which supported server envelope produced it.

Before committing finalization, the backend must re-evaluate known freshness
for moving refs. If the latest persisted successful source-resolution
observation for the tracked ref already differs, finalization fails with
`ANALYSIS_STALE`. If a later ref resolution observes a different commit after
successful finalization, the approved historical output remains valid history
and is subsequently projected as stale. The MVP does not claim freshness
against remote changes it has not observed.

Finalization and review mutations must protect this freshness check against a
concurrent `RepositoryTarget` observation update using locking, serializable
isolation, or an optimistic observation-version condition. They must not
commit a current review/finalization after a newer observed commit has already
won the race.

## Error Contract

Use stable error codes rather than relying on message text:

```text
INVALID_PROJECT_NAME
INVALID_REPOSITORY_URL
UNSAFE_REPOSITORY_REF
SENSITIVE_REQUIREMENT_INPUT
AMBIGUOUS_REPOSITORY_REF
SOURCE_NOT_ACCESSIBLE
UNSUPPORTED_FRAMEWORK
SNAPSHOT_NOT_FOUND
PARTIAL_SNAPSHOT_ACK_REQUIRED
REQUIREMENT_NOT_READY
INPUT_PROJECT_MISMATCH
TARGET_SNAPSHOT_MISMATCH
IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_INPUT
ANALYSIS_STALE
UNREVIEWED_ACK_REQUIRED
INVALID_STATE_TRANSITION
TERMINAL_ANALYSIS
REPORT_PROVENANCE_MISMATCH
```

Final reviewed report reads, approved report reads, and report exports must not
combine a mutable generated document with review metadata or test traces from a
different reviewed snapshot. Report generation freezes its Markdown on the
reviewed snapshot; when a legacy document cannot be tied unambiguously to the
latest reviewed snapshot, the API returns `REPORT_PROVENANCE_MISMATCH` (HTTP
409) instead of serving mixed-generation content.
When a reviewed snapshot has no frozen Markdown and resolves its approved
document by ID, that document must belong to the same impact analysis and be an
approved impact report. A cross-analysis or wrong-type/status reference returns
`REPORT_PROVENANCE_MISMATCH`; the endpoint never serves that document's text.
The localization context reader enforces the same document-to-analysis identity
before generating or validating localized report artifacts.

Validation failures do not create downstream job/analysis records unless a use
case explicitly stores a rejected requirement revision for clarification.

If a request combines a parent resource ID with a project-owned child ID in
its body, the API checks the actor's permission for each referenced resource
before application-level association validation. A child outside the actor's
project memberships returns 404; a mismatched association within projects the
actor can access returns the corresponding domain error.

## Change Discipline

Impact graph nodes expose retrieval metadata only when it passes the shared
retrieval schema. A null historical DB value or unsupported JSON shape is
omitted from the optional field; it is never returned as null or replaced by
invented retrieval information. Contract checks include real persisted graph
rows, not only mocked JSON objects.

Any API response change updates:

```text
shared Zod contract
API mapper
API/integration tests
consumer usage after frontend exists
this document when behavior changes
```
