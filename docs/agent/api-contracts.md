# API Contracts

## Contract Boundary

Use REST resources and shared Zod contracts:

```text
Prisma model -> application result -> API mapper -> Zod DTO -> consumer
```

Never expose Prisma relation shapes directly to the frontend or CLI consumer.
Keep contracts in `packages/contracts` after workspace scaffolding exists.

## MVP Resources

```http
POST /api/v1/auth/dev-login
GET  /api/v1/auth/me

GET  /api/v1/projects
POST /api/v1/projects
GET  /api/v1/projects/:projectId/members
POST /api/v1/projects/:projectId/members
PATCH /api/v1/projects/:projectId/members/:userId
DELETE /api/v1/projects/:projectId/members/:userId
GET  /api/v1/workspace/current
POST /api/v1/workspace/select-project
GET  /api/v1/system/health

GET  /api/v1/projects/:projectId/repositories
GET  /api/v1/projects/:projectId/repositories/:repositoryId
POST /api/v1/projects/:projectId/repositories
POST /api/v1/repositories/:repositoryId/scan-jobs
GET  /api/v1/scan-jobs/:scanJobId
GET  /api/v1/snapshots/:snapshotId/artifacts
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

GET  /api/v1/impact-analyses/:analysisId/documents
GET  /api/v1/impact-analyses/:analysisId/approved-report
GET  /api/v1/impact-analyses/:analysisId/approved-report/export.md
GET  /api/v1/impact-analyses/:analysisId/approved-report/export.pdf
```

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

Project membership management uses existing users only:

```json
{
  "email": "reviewer@ba-helper.local",
  "role": "REVIEWER"
}
```

The web app signs in through `/login` using dev-login (email + role, no
password). App routes are middleware-gated, and backend RBAC remains the
authoritative permission source. Disabled controls in the frontend are UX only.

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
`GET /api/v1/projects/:projectId/multi-repo-runs` lists those runs for the
current project with derived child status counts. Run detail also returns
derived readiness and latest review-decision state per child analysis. This is
a batch/run tracking foundation. `GET /api/v1/multi-repo-runs/:runId/merged-report-draft`
returns a read-only merged Markdown draft only when every child analysis has a
latest review decision of `ACCEPTED`. The merged draft is not persisted and
does not create a `GeneratedDocument`.

`POST /api/v1/multi-repo-runs/:runId/merged-report/finalize` persists an
approved merged Markdown snapshot for the run. `GET /api/v1/multi-repo-runs/:runId/merged-report`
returns that persisted snapshot plus provenance and stale status. The approved
merged report is stale when child review decisions or child analysis snapshot
provenance change after approval. `GET /api/v1/multi-repo-runs/:runId/merged-report/export.md`
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
3. Backend unavailable                   -> /api/v1/system/health fails
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
```

Validation failures do not create downstream job/analysis records unless a use
case explicitly stores a rejected requirement revision for clarification.

## Change Discipline

Any API response change updates:

```text
shared Zod contract
API mapper
API/integration tests
consumer usage after frontend exists
this document when behavior changes
```
