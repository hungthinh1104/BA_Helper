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
POST /api/v1/projects

GET  /api/v1/projects/:projectId/repositories
GET  /api/v1/repositories/:repositoryId
POST /api/v1/projects/:projectId/repositories
POST /api/v1/repositories/:repositoryId/scan-jobs
GET  /api/v1/scan-jobs/:scanJobId
GET  /api/v1/snapshots/:snapshotId/artifacts
GET  /api/v1/snapshots/:snapshotId/graph

GET  /api/v1/projects/:projectId/requirements
GET  /api/v1/requirements/:requirementId
POST /api/v1/projects/:projectId/requirements
POST /api/v1/requirements/:requirementId/revisions
POST /api/v1/requirement-revisions/:revisionId/qualify
POST /api/v1/requirement-revisions/:revisionId/impact-analyses

GET  /api/v1/projects/:projectId/impact-analyses
GET  /api/v1/impact-analyses/:analysisId
GET  /api/v1/impact-analyses/:analysisId/insights
GET  /api/v1/impact-analyses/:analysisId/evidence
POST /api/v1/impact-analyses/:analysisId/finalize

POST /api/v1/insights/:insightId/confirm
POST /api/v1/insights/:insightId/reject
POST /api/v1/traceability-links/:linkId/confirm
POST /api/v1/traceability-links/:linkId/reject

GET  /api/v1/impact-analyses/:analysisId/documents
GET  /api/v1/impact-analyses/:analysisId/approved-report
```

Deferred until after the Markdown report/review completion gate:

```http
GET /api/v1/impact-analyses/:analysisId/diagrams
```

## Input Boundary Contracts

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

In the MVP, `canExport` refers to exporting/downloading the approved Markdown
impact report with its provenance metadata. PDF, DOCX, Jira, and Confluence
exports remain out of scope.

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
