# State Machine

## Rules

- Store state as Prisma enums, not arbitrary strings.
- Lifecycle `status` and processing `stage` are different fields.
- Only policy functions may transition lifecycle status.
- Meaningful transitions write a `DomainEvent`.
- Freshness is not lifecycle state. An output may be `COMPLETED` and also have
  `isStale=true` when a newer target commit is known.

## Scan Job

```text
Status: QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED

Stage:
WAITING
CLONING_REPO
RESOLVING_SOURCE_REF
DETECTING_PROJECT
FILTERING_FILES
EXTRACTING_ARTIFACTS
BUILDING_GRAPH
GENERATING_SUMMARIES
DONE
```

Allowed lifecycle transitions:

```text
QUEUED    -> RUNNING | CANCELLED | FAILED
RUNNING   -> COMPLETED | FAILED | CANCELLED
COMPLETED -> none
FAILED    -> none (rerun creates a new execution)
CANCELLED -> none
```

`ScanJob` represents all processing and failure state. It publishes a
`RepositorySnapshot` only after usable extracted output exists for one
immutable `(commitSha, analyzerVersion)` identity. A failed or cancelled job
does not publish a failed/in-progress snapshot.

A successful safe source resolution records or updates a `RepositoryTarget`
observation for the requested branch, tag, or pinned commit, even if later
analysis of that code fails. Target observation and extracted snapshot
identity are separate because distinct refs may resolve to one commit.

Embedding enqueue/indexing is downstream of snapshot publication. Once the
snapshot, artifacts, edges, evidence, diagnostics, target linkage, and scan job
completion commit successfully, an embedding enqueue failure must not turn the
completed extraction into a failed scan. Keep the scan job `COMPLETED`, keep the
published snapshot readable for lexical retrieval, and mark
`RepositorySnapshot.indexStatus=VECTOR_FAILED` so vector readiness is clearly a
separate indexing failure.

## Repository Snapshot Coverage Classification

```text
SnapshotCoverageStatus / coverageStatus: READY, PARTIAL
```

Snapshots are published immutable outputs, not lifecycle workflows. `PARTIAL`
is usable only when coverage and skipped supported inputs are exposed to
consumers.

Snapshot eligibility for analysis:

```text
READY    analysis accepted normally
PARTIAL  analysis rejected unless the caller explicitly accepts partial coverage
```

For `PARTIAL`, an accepted analysis persists and returns a coverage warning.
An analysis/output freshness projection is computed from its snapshot and
selected target:

```text
for moving branch/tag refs:
  isStale = selected RepositoryTarget.latestObservedCommitSha
            != snapshot.commitSha

for an explicitly requested full commit SHA:
  isStale = false in the MVP because the selected source is intentionally pinned
```

A later successful source-resolution refresh of the selected moving target
updates its known observed commit. Reads and finalization use that persisted observation; the
MVP does not claim that it continuously tracks an unobserved remote head.

Analyzer freshness may also be exposed separately when a newer analyzer is
available:

```text
isAnalyzerOutdated = current analyzerVersion != snapshot.analyzerVersion
```

Neither freshness flag mutates historical lifecycle state.
`isAnalyzerOutdated` is informational in the MVP and does not by itself block
review/finalization; the exact analyzer version remains visible in output
provenance. Repository-source staleness (`isStale`) is the blocking condition.

## Requirement Revision

Requirement revision content is immutable; its readiness workflow is:

```text
DRAFT, READY_FOR_ANALYSIS, NEEDS_CLARIFICATION, ARCHIVED
```

```text
DRAFT               -> READY_FOR_ANALYSIS | NEEDS_CLARIFICATION | ARCHIVED
NEEDS_CLARIFICATION -> ARCHIVED (superseded or explicitly retired)
READY_FOR_ANALYSIS  -> ARCHIVED (replacement becomes ready or explicitly retired)
ARCHIVED            -> none
```

Only `READY_FOR_ANALYSIS` revisions may create an `ImpactAnalysis`.
When a replacement revision becomes `READY_FOR_ANALYSIS`, it supersedes and
archives the previous active ready revision for new-analysis purposes.
Creating a `DRAFT` or `NEEDS_CLARIFICATION` replacement does not invalidate
the last ready revision. Existing analyses and reports referencing archived
revisions remain readable history.

## Impact Analysis

```text
Status:
QUEUED, RUNNING, WAITING_FOR_REVIEW, COMPLETED, FAILED, CANCELLED

Stage:
WAITING
RETRIEVING_EVIDENCE
EXPANDING_GRAPH
RUNNING_AI_REASONING
GENERATING_INSIGHTS
GENERATING_DOCUMENTS
DONE
```

Allowed lifecycle transitions:

```text
QUEUED             -> RUNNING | CANCELLED | FAILED
RUNNING            -> WAITING_FOR_REVIEW | FAILED | CANCELLED
WAITING_FOR_REVIEW -> COMPLETED
COMPLETED          -> none
FAILED             -> none
CANCELLED          -> none
```

`WAITING_FOR_REVIEW` means machine output exists. `COMPLETED` means the
user explicitly invoked finalization. Finalization may leave unreviewed
insights in the historical record, but those insights are labeled and excluded
from approved factual conclusions.

Cancellation stops queued or running work only. Once draft machine output
exists in `WAITING_FOR_REVIEW`, the user may review/finalize it or start a new
analysis run; cancellation must not ambiguously retire reviewable output.

If unreviewed insights remain, finalization requires explicit
`acknowledgeUnreviewed=true` from the caller.

Rerunning does not reopen or mutate a terminal analysis. It creates a new
`ImpactAnalysis` against the selected snapshot.

## Insight State

Keep machine certainty independent of human decision:

```text
Certainty:    EVIDENCED, INFERRED, UNKNOWN, CONFLICTING
ReviewStatus: NEEDS_REVIEW, CONFIRMED, REJECTED
```

Examples:

```text
certainty=EVIDENCED, reviewStatus=NEEDS_REVIEW
  Code evidence directly supports the statement; no human decision yet.

certainty=INFERRED, reviewStatus=CONFIRMED
  The system inferred the impact; a human accepted it.
```

Invariant:

```text
certainty=EVIDENCED requires at least one directly supporting Evidence relation.
certainty=INFERRED requires at least one contextual Evidence relation and reasoning.
certainty=UNKNOWN requires a reason and retrieval/search scope; evidence is optional.
certainty=CONFLICTING requires at least two conflicting Evidence relations.
```

Human review transitions:

```text
NEEDS_REVIEW -> CONFIRMED | REJECTED
CONFIRMED    -> REJECTED
REJECTED     -> CONFIRMED
```

Review status describes the current user decision and may be revised before a
new final output is generated. Reviews are accepted only while the analysis is
`WAITING_FOR_REVIEW`; after finalization, a new analysis run is required for
new reviewed output. A review event is written for every change.

If an analysis becomes known stale before finalization, new review/finalization
actions are blocked by default. The user requests a current scan and reruns
analysis against its snapshot; stale machine output remains readable as
history.

Review and finalization must guard against a concurrent target observation.
Inside the mutation transaction, use a row lock, serializable isolation, or an
optimistic comparison against the target observation version/timestamp. A
review/finalization operation must not commit as current after a newer observed
commit has won the race.

## Generated Outputs

Documents, and future diagrams, have review projection status:

```text
DRAFT     generated from machine results in WAITING_FOR_REVIEW
APPROVED  generated on explicit finalization from current review decisions
```

Staleness is exposed independently as `isStale`; do not replace `APPROVED`
with a stale lifecycle status.

Rules:

```text
DRAFT output labels every insight certainty and review status.
APPROVED output excludes rejected insights from conclusions.
APPROVED output does not present unreviewed insights as approved facts.
APPROVED output may include unreviewed items in an explicitly labeled appendix.
```

## Document Job

Asynchronous generation of APPROVED outputs runs through `DocumentJob`:

```text
Status: QUEUED, RUNNING, COMPLETED, FAILED
```

Allowed lifecycle transitions:

```text
QUEUED    -> RUNNING | FAILED
RUNNING   -> COMPLETED | FAILED
FAILED    -> QUEUED    // explicit retry only
COMPLETED -> none
```

A `DocumentJob` takes a single `ReviewedReportSnapshot` as its deterministic input.
`COMPLETED` is terminal.
`FAILED` can only return to `QUEUED` through explicit retry.
Retry reuses the same `DocumentJob` identity and increments `attemptCount`.
Retry must not create a second job for same `snapshotId` + `documentType`.

A FAILED job never mutates the `ReviewedReportSnapshot`. Re-enqueueing a job for the same snapshot and document type simply returns the existing job, unless explicitly requested as a retry.


## Traceability Link Review

Traceability links only exist for supported or inferred artifact impact:

```text
LinkBasis:    EVIDENCED, INFERRED
ReviewStatus: NEEDS_REVIEW, CONFIRMED, REJECTED
```

Unknown behavior produces an insight/question, not a placeholder link to an
artifact. Link reviews follow the same current `WAITING_FOR_REVIEW` restriction
as insight reviews.

## Backend Capabilities

The backend computes action availability from state and permissions. Typical
analysis capability policy:

```text
canReview           status == WAITING_FOR_REVIEW and isStale == false and user may review
canFinalize         status == WAITING_FOR_REVIEW and isStale == false and user may finalize
canExport           status == COMPLETED and isStale == false
canRerun            status in FAILED | CANCELLED | COMPLETED or isStale == true
canCancel           status in QUEUED | RUNNING
```

The frontend displays these flags and does not reproduce this policy.
