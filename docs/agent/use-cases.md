# MVP Use Cases And Decisions

## Product Slice

The MVP proves one end-to-end workflow:

```text
Valid public NestJS TypeScript GitHub repository input
+ analysis-ready booking cancellation/refund change request revision
-> commit-specific scan
-> evidence-backed impact analysis
-> human review/finalization
-> reviewed Markdown impact-report output
```

Change request used for the first fixture:

```text
Allow users to cancel paid bookings and receive refund.
```

All intake uses the validation rules in [input-quality.md](input-quality.md).
Storing raw input does not make it eligible for analysis.

## Use Cases In Scope

### UC-01 Create Project

Create a container for repositories and requirements. In dev/single-user mode,
the caller is treated as project owner without implementing team auth yet.

Input and acceptance:

```text
name is trimmed, non-empty, and within configured length limit
blank/invalid name is rejected and no Project is created
successful creation records PROJECT_CREATED
```

### UC-02 Add Repository And Request Scan

Input:

```text
projectId, public GitHub repository URL, optional branch/ref for scan request,
requestKey
```

This logical use case uses two API commands: repository creation persists the
canonical URL; scan-job creation carries the optional ref and `requestKey`.

Preconditions and validation:

```text
project exists
repository URL passes the public GitHub allowlist and canonicalization rules
optional ref passes synchronous safe-syntax validation; remote resolution may
  still fail asynchronously as inaccessible or ambiguous
MVP does not accept private URLs, arbitrary git hosts, local paths, or tokens
```

Behavior:

```text
create Repository if needed
create/reuse RepositoryTarget and update its observation when the source ref resolves safely
create ScanJob in QUEUED status
return scanJobId without waiting for scan
```

The worker resolves the actual commit SHA after cloning/fetching. A
`RepositorySnapshot` is published only after that commit has usable extraction
output; failures remain on `ScanJob` and do not reserve a snapshot identity.
The requested `ref` is stored on the scan execution and
`RepositoryTarget`; it is not merged into repository URL identity or immutable
snapshot identity.

Failure behavior:

```text
invalid input      reject before Repository/ScanJob persistence
duplicate URL      reuse canonical Repository identity under the Project
clone failure      job becomes FAILED and records failure event
ambiguous remote ref job becomes FAILED with no new target observation/snapshot publication
same requestKey    retry returns/reuses the previously created scan execution
explicit rescan    caller provides a new requestKey
```

Acceptance:

```text
canonical repository URL is persisted
no command content is constructed from untrusted URL/ref input
job response has explicit status/stage/capabilities
completed job response exposes published snapshotId and sourceTargetId for analysis
failed post-resolution job may expose sourceTargetId but never a usable snapshotId
```

### UC-03 Complete Repository Snapshot

For a resolved commit, detect the supported framework, scan the repository,
persist artifact/edge/evidence records, coverage and skipped inputs, then
publish a snapshot result. Snapshot identity includes `analyzerVersion`.

Outcomes:

```text
READY   all required MVP extraction completed
PARTIAL useful extraction exists, but coverage limitations are recorded
```

Decision rules:

```text
NestJS TypeScript detected, supported files are enumerated, and all selected
  files are processed within limits -> READY, even if no impacted booking symbol exists
NestJS TypeScript detected but some selected files fail or are skipped due
  bounded limits -> PARTIAL
framework unsupported, source inaccessible, or no supported source can be
  enumerated/processed -> ScanJob FAILED and no snapshot is published
```

Acceptance:

```text
snapshot is tied to commitSha and analyzerVersion
successful source resolution updates the associated RepositoryTarget observation,
  even if later extraction fails
coverage/skipped inputs are persisted for READY and PARTIAL
idempotent retry does not duplicate snapshot artifacts or edges
unsupported Express/other repo does not masquerade as PARTIAL in MVP
a failed scan attempt can be retried for the same commit/version because it
  did not publish a failed immutable snapshot
```

### UC-04 Create And Qualify Change Request

Persist the submitted title and raw requirement text in an immutable revision.
For MVP, the supported type is `CHANGE_REQUEST`.

Input policy:

```text
accepted raw text is stored exactly after secret-input rejection
report-visible title is stored on the immutable revision
normalized text is derived for retrieval
readiness validation does not invent missing policy
```

Outcomes:

```text
READY_FOR_ANALYSIS  actionable change behavior and target concept exist
NEEDS_CLARIFICATION too vague to retrieve impact safely; issues/questions stored
DRAFT               stored work not submitted for readiness check
```

If a `DRAFT` revision is later submitted for readiness checking, qualification
updates only its readiness result; it does not change the immutable title or
raw text. Correcting title/text creates a new revision.

Acceptance examples:

```text
"Allow users to cancel paid bookings and receive refund."
  -> READY_FOR_ANALYSIS; refund percentage remains unknown for analysis.

"fix it"
  -> NEEDS_CLARIFICATION; no impact analysis can be created.

text containing a likely credential/token/private key
  -> rejected before RequirementRevision persistence in the MVP.
```

Editing a requirement title or text creates a new `RequirementRevision`; it
never changes the title/input referenced by an existing analysis or report.
When the replacement becomes `READY_FOR_ANALYSIS`, it archives the previous
active ready revision for new analyses. A draft or clarification-needed edit
does not retire the last ready revision.

### UC-05 Run Impact Analysis

Input:

```text
requirementRevisionId, snapshotId, sourceTargetId,
optional allowPartialSnapshot=false, requestKey
```

Eligibility:

```text
READY snapshot      accepted
PARTIAL snapshot    rejected unless allowPartialSnapshot=true
unknown/unpublished rejected
```

When a partial snapshot is explicitly accepted, the analysis and every report
projection must include a visible coverage warning.

Cross-input requirements:

```text
requirement revision is READY_FOR_ANALYSIS
requirement and snapshot belong to the same Project
source target belongs to the snapshot repository and currently observes the selected snapshot commit
snapshot uses the supported NestJS analyzer adapter
analysis stores snapshot, sourceTarget, requirementRevision, analyzerVersion,
and later AI provenance
```

Failure behavior:

```text
invalid/mismatched/unclear input -> reject with validation reason; create no analysis
eligible input -> create QUEUED ImpactAnalysis and process asynchronously
same requestKey for identical accepted command -> return/reuse existing analysis
intentional rerun -> use a new requestKey and create a new analysis
```

No-match behavior:

```text
A READY scan with no relevant cancellation/refund artifacts does not make
analysis fail. It produces no evidenced affected artifact and creates UNKNOWN
insights/questions describing the unsupported impact.
```

### UC-06 Review Insights

A user can confirm or reject generated insights and traceability links.
Review decisions do not rewrite machine certainty:

```text
certainty=INFERRED, reviewStatus=CONFIRMED
```

means a human accepted an inference; it does not turn the original inference
into directly evidenced behavior.

Reviews are permitted only for a current `WAITING_FOR_REVIEW` analysis.
Reviewing a stale or terminal analysis is rejected; historical decisions remain
readable. Repeating the current decision is idempotent and must not append a
duplicate review-change event.

### UC-07 Finalize Analysis

Finalization is an explicit action:

```http
POST /api/v1/impact-analyses/:analysisId/finalize
```

Rules:

```text
Only WAITING_FOR_REVIEW analyses may be finalized.
Stale analyses cannot be finalized as current output; rerun on a current snapshot.
Finalization does not require every insight to be reviewed.
If unreviewed insights remain, the caller must explicitly set
`acknowledgeUnreviewed=true`.
Rejected insights are excluded from approved conclusions.
Unreviewed insights remain labeled and are not presented as approved facts.
Finalization records a DomainEvent and creates an approved Markdown impact-report projection.
```

This keeps review practical while preventing machine output from silently
becoming approved output.

Finalization is not a retryable mutation: a second finalize request after the
analysis is `COMPLETED` returns its terminal-state conflict rather than creating
additional approved projections.

### UC-08 Read Approved Markdown Output

The pipeline generates a machine `DRAFT` impact report before finalization.
Finalization creates an `APPROVED` impact report projection based on the
current review decisions.

For the backend milestone, `IMPACT_REPORT` Markdown is required. Mermaid
diagram generation is deferred until the report/review flow passes its tests;
when implemented, it follows the same draft/approved/freshness rules.
MVP export means retrieving/downloading the approved Markdown report with
provenance metadata; richer document/export integrations remain out of scope.

Any output can later be returned with `isStale=true` when a later safe source
resolution has observed a different commit for the same moving ref; historical
content remains readable. The MVP freshness flag represents last observed
state, not continuous remote-head monitoring.

## Explicitly Out Of Scope

```text
private repository authentication
multi-user authorization enforcement beyond dev ownership
Express and multi-language parsing
general documentation/wiki generation
PDF/DOCX/export integrations
full workflow/BPMN modeling
```

## Rerun And History Semantics

Scans and analyses preserve history:

```text
Same resolved commit and analyzerVersion:
  a successful new scan execution may reuse the same published snapshot
  records idempotently.

Failed scan attempt:
  persists failure on ScanJob only; it does not block retry publication of a
  usable snapshot at the same commit and analyzerVersion.

Same commit with changed analyzerVersion:
  creates a separately identified extracted snapshot; it does not mutate
  evidence used by prior analyses.

New commit:
  creates a new RepositorySnapshot.

Rerun impact analysis:
  creates a new ImpactAnalysis; it does not overwrite a previous run.

Old output:
  keeps its original lifecycle status and is projected with isStale=true when
  its selected target has a newer observed commit.
```

Freshness is evaluated against a tracked moving ref:

```text
branch/ref scan:
  compare the snapshot commit SHA with the latest safely resolved commit for
  that ref after a later scan/refresh request, even if extraction then fails.

explicit full commit SHA scan:
  historical input is intentional; it is not stale merely because the branch moved.
```

## Minimum Acceptance Case Inventory

These cases are required before the backend milestone can be called complete:

| ID | Use case | Input/condition | Required outcome |
| --- | --- | --- | --- |
| UC01-A | Create project | valid trimmed name | project and audit event created |
| UC01-B | Create project | blank name | reject without persistence |
| UC02-A | Add repository/scan | canonicalizable public GitHub URL + branch | repository, target observation request, and queued scan job created |
| UC02-B | Add repository/scan | token/non-GitHub/local/syntactically unsafe ref | reject before scan job |
| UC02-C | Request scan | syntactically safe but remotely ambiguous branch/tag ref | failed job with `AMBIGUOUS_REPOSITORY_REF`; no new target observation/snapshot |
| UC03-A | Scan snapshot | supported fixture + successful extraction | READY snapshot with coverage and artifacts |
| UC03-B | Scan snapshot | NestJS fixture with bounded skipped input | COMPLETED job and PARTIAL snapshot with explicit coverage gaps |
| UC03-C | Scan snapshot | unsupported Express repo in MVP | FAILED job with `UNSUPPORTED_FRAMEWORK`; no snapshot |
| UC03-D | Scan snapshot | supported NestJS repo without matching booking symbol | READY; absence is evaluated during analysis |
| UC03-E | Scan retry | first attempt fails before publication, second succeeds at same commit/version | failed job preserved; later READY/PARTIAL snapshot may publish |
| UC04-A | Qualify request | cancellation/refund change text | immutable READY_FOR_ANALYSIS revision |
| UC04-B | Qualify request | `fix it` | NEEDS_CLARIFICATION revision and no analysis eligibility |
| UC04-C | Edit request | revised title/text qualifies READY | replacement becomes active; superseded ready revision cannot start new analysis; existing report identity/input unchanged |
| UC04-D | Qualify stored draft | DRAFT revision content unchanged | status changes to READY_FOR_ANALYSIS or NEEDS_CLARIFICATION without rewriting content |
| UC04-E | Edit request | revised title/text remains DRAFT or NEEDS_CLARIFICATION | previous ready revision stays eligible; new revision is not analyzable |
| UC04-F | Create request | likely secret in submitted text | reject before revision persistence |
| UC05-A | Analyze impact | ready revision + READY snapshot + matching source target | queued analysis with bound provenance |
| UC05-B | Analyze impact | PARTIAL without acknowledgement | reject with no analysis |
| UC05-C | Analyze impact | cross-project, non-ready, unpublished snapshot, or mismatched target input | reject with no analysis |
| UC05-D | Analyze impact | ready inputs but no related artifact found | machine output contains UNKNOWN, not fabricated impact |
| UC05-E | Analyze impact retry | identical accepted requestKey submitted twice | one analysis execution/result only |
| UC06-A | Review | current waiting analysis | changed decision and audit event persisted |
| UC06-B | Review | stale or completed analysis | reject without new decision |
| UC06-C | Review retry | submit already-current review decision again | no state change and no duplicate decision event |
| UC07-A | Finalize | reviewed/current waiting analysis | COMPLETED and approved impact report |
| UC07-B | Finalize | unreviewed items without acknowledgement | reject |
| UC07-C | Finalize | stale/terminal analysis | reject, no duplicate approved output |
| UC07-D | Finalize | current waiting analysis with unreviewed items and explicit acknowledgement | COMPLETED; unreviewed items remain labeled and are not approved facts |
| UC08-A | Read output | later safe ref resolution observes branch advanced after completion, even if extraction fails | readable historical output with `isStale=true`, export disabled |

## Operation Ordering Rule

For operations that depend on freshness or status, validate and persist in a
safe order:

```text
review/finalize:
  load analysis and linked snapshot
  load latest persisted successfully observed commit for its moving ref
  reject stale/terminal input
  lock or conditionally compare the target observation during mutation
  persist decision/finalization plus DomainEvent atomically only if its
    observation is still the checked version
```

If the remote branch advances without a later ref resolution, the MVP does not
yet know it changed. After a successful later observation, history is not
rolled back; subsequent reads surface staleness.
