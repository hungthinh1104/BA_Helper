# Data Model

## Core Records

The first backend milestone needs these concepts:

```text
Project (recommended grouping, even before full auth)
Repository
RepositoryTarget
RepositorySnapshot
RepositoryProfile
ScanJob
CodeArtifact
DependencyEdge
Evidence
Requirement
RequirementRevision
ImpactAnalysis
BaInsight
InsightEvidence
TraceabilityLink
TraceabilityEvidence
GeneratedDocument
DocumentJob
DomainEvent
```

Auth membership models can be introduced after the backend engine proves its
vertical slice, while preserving `Project` ownership boundaries.

## Ownership

```text
Repository        owns repo identity and snapshot references
RepositoryTarget  owns selected ref identity and latest successful source-resolution observation
RepositorySnapshot owns commit-and-analyzer-version-specific extracted artifacts
RepositoryProfile owns snapshot-scoped repository classification metadata
ScanJob           owns async processing state
CodeArtifact      owns extracted symbol/API/test identity
DependencyEdge    owns relationships between artifacts in one snapshot
Evidence          owns immutable support tied to a source origin and provenance
Requirement       owns the editable change request identity
RequirementRevision owns immutable title/raw/normalized input and readiness result
ImpactAnalysis    owns one requirement revision evaluation against one snapshot
BaInsight         owns BA-facing claims, unknowns, questions, ACs, QA scenarios
TraceabilityLink  owns requirement-to-artifact impact relation for an analysis
Generated*        owns outputs tied to the analysis commit
DocumentJob       owns asynchronous process state for building final documents
DomainEvent       owns audit/debug history
```

## Required Relations

```text
RepositoryTarget   -> Repository, targetKey/ref type, latest observed commit
RepositorySnapshot -> Repository, commitSha, analyzerVersion, published coverage status
RepositoryProfile  -> RepositorySnapshot, domain/language/framework/architecture and bounded roots
ScanJob            -> Repository + requested ref, optional resolved RepositoryTarget, and eventual published snapshot
CodeArtifact       -> RepositorySnapshot
DependencyEdge     -> RepositorySnapshot + fromArtifact + toArtifact
Evidence           -> source origin: snapshot/artifact and/or requirement revision
RequirementRevision -> Requirement and immutable submitted title/raw/normalized text
ImpactAnalysis     -> RequirementRevision + RepositorySnapshot + selected RepositoryTarget
BaInsight          -> ImpactAnalysis
InsightEvidence    -> BaInsight + Evidence
TraceabilityLink   -> ImpactAnalysis + CodeArtifact
TraceabilityEvidence -> TraceabilityLink + Evidence
GeneratedDocument -> ImpactAnalysis + commitSha
DocumentJob        -> ImpactAnalysis + ReviewedReportSnapshot + GeneratedDocument (optional)
```

`TraceabilityLink` must be scoped to `ImpactAnalysis`; its requirement revision
is determined by that analysis. A requirement can be analyzed repeatedly across
revisions and snapshots.

For an analysis explicitly accepted from a `PARTIAL` snapshot, persist its
known limitation:

```text
acceptedPartialCoverage: boolean
coverageWarning: string or structured metadata
```

This warning is not UI-only; it must remain available to generated outputs.

Repository target/scan provenance stores:

```text
requestedRef
resolvedRefType: BRANCH | TAG | COMMIT
resolvedCommitSha
```

`RepositorySnapshot` is commit-specific extraction and must not own a mutable
branch/tag identity. The same snapshot may be reused when distinct targets
resolve to the same commit. Use:

```text
RepositoryTarget
  targetKey            stable normalized ref identity
  requestedRef
  resolvedRefType      BRANCH | TAG | COMMIT
  latestObservedCommitSha
  lastObservedAt

ImpactAnalysis.sourceTargetId
  target against which freshness is evaluated
```

`targetKey` must distinguish a branch from a tag even when their short names
match. A syntactically valid unqualified input that resolves ambiguously fails
its scan before any target is persisted rather than being mapped arbitrarily.

For a moving target, successful safe source resolution updates its latest
observed commit even if subsequent framework detection or extraction fails.
Usable extraction may then publish/reuse a snapshot for that commit. This
ensures an older report can become known stale when the repository moved but
new code cannot yet be analyzed. `isStale` compares the analysis snapshot
against its selected target observation. It is not a promise of live
remote-head freshness. An explicit commit target is intentional historical
analysis unless the user requests comparison to another target.

## Snapshot Publication Semantics

`ScanJob` owns transient execution state and failure details. A
`RepositorySnapshot` is an immutable published extraction result, not an
in-progress job record.

```text
ScanJob:            QUEUED | RUNNING | COMPLETED | FAILED | CANCELLED
RepositorySnapshot.coverageStatus: READY | PARTIAL
```

Rules:

```text
invalid input or clone/resolve/framework/extraction failure -> no new snapshot
usable full extraction                               -> publish READY snapshot
usable bounded extraction with declared coverage gap -> publish PARTIAL snapshot
PARTIAL snapshot may be analyzed only with explicit acknowledgement
same commit + same analyzerVersion reuses identical published snapshot output
changed analyzer behavior or extraction/coverage policy affecting persisted
  output must use a changed analyzerVersion
```

This prevents a transient failed attempt from occupying the immutable
`(repositoryId, commitSha, analyzerVersion)` identity and blocking a successful
retry.

Repository profiling follows the same publication rule:

```text
published READY or PARTIAL snapshot -> may persist one RepositoryProfile
failed/unsupported scan             -> persists no RepositoryProfile
```

`RepositoryProfile` is attached to the immutable snapshot because framework,
roots, and coarse domain hints are commit-specific analyzer facts, not mutable
repository settings.

`analyzerVersion` is the versioned extraction contract, not only a parser
package version. It must cover adapter logic and configured limits/policies
that can change artifacts, edges, evidence, skipped inputs, or `READY` versus
`PARTIAL` classification. Runtime failure does not change the contract and
therefore publishes no snapshot under that identity.

## Evidence Origin Semantics

Evidence cannot always belong to a code artifact. For example, a clarification
gap may cite the submitted change request or scan coverage limitation.

Persist evidence with explicit origin:

```text
sourceType: CODE | TEST | STATIC_ANALYSIS | REQUIREMENT_INPUT | COVERAGE | HUMAN_NOTE
snapshotId?             present for repository-derived evidence
artifactId?             present for artifact-specific evidence
requirementRevisionId?  present for input-derived evidence
text/source locator/content hash/provenance metadata
```

Rules:

```text
CODE/TEST/STATIC_ANALYSIS evidence must identify its snapshot and may identify an artifact.
REQUIREMENT_INPUT evidence must identify its immutable RequirementRevision.
COVERAGE evidence must identify the snapshot whose gaps it describes.
Evidence linked to an EVIDENCED code-impact fact must come from the same snapshot as its ImpactAnalysis.
Evidence linked to a requirement interpretation must come from its referenced revision.
Persisted evidence text must not contain detected secret literals; redact the
excerpt before persistence while retaining source locator, content hash, and
redaction metadata needed for provenance.
```

`CodeArtifact` keeps both adapter-specific and normalized type:

```text
artifactType   raw framework-specific extracted type
universalKind  framework-neutral normalized kind
```

Current normalized kinds:

```text
API_ENDPOINT
DOMAIN_SERVICE
DATA_MODEL
TEST_CASE
UNKNOWN
```

## Requirement Revision Semantics

Do not analyze mutable text. Model requirement input as:

```text
Requirement
  editable identity and current revision pointer

RequirementRevision
  immutable title
  immutable accepted rawText (after MVP secret-input rejection)
  normalizedText
  readinessStatus: DRAFT | READY_FOR_ANALYSIS | NEEDS_CLARIFICATION | ARCHIVED
  validationIssues/questions when not ready
  createdAt
```

Rules:

```text
ImpactAnalysis references RequirementRevision, never only Requirement.
Revision content is immutable; readiness status may transition under its policy.
Editing text creates a new revision.
Editing a title used in reports creates a new revision.
Requirement input containing detected credentials/secrets is rejected before a
revision is created in the MVP; encrypted storage of such input is deferred.
When a replacement revision becomes READY_FOR_ANALYSIS, archive the
superseded active ready revision so new analyses cannot accidentally use
outdated requirement input. A draft or clarification-needed revision does not
retire the last ready revision.
Only READY_FOR_ANALYSIS revision may create ImpactAnalysis.
Previous reports keep the exact input revision used at generation time.
```

## Traceability Link Semantics

A link represents a candidate or reviewed impact relationship, not an unknown.

```text
linkBasis:    EVIDENCED | INFERRED
reviewStatus: NEEDS_REVIEW | CONFIRMED | REJECTED
```

Rules:

```text
EVIDENCED link requires directly supporting snapshot evidence.
INFERRED link requires contextual snapshot evidence plus reasoning.
UNKNOWN behavior is stored as a BaInsight/question, not a fake artifact link.
All link evidence must be compatible with the analysis snapshot/revision.
```

## Integrity Rules

Required uniqueness constraints:

```text
RepositoryTarget    (repositoryId, targetKey)
RepositorySnapshot  (repositoryId, commitSha, analyzerVersion)
RepositoryProfile   (snapshotId)
ScanJob             (repositoryId, requestKey) for retry-safe command creation
CodeArtifact        (snapshotId, artifactKey)
DependencyEdge      (snapshotId, fromArtifactId, toArtifactId, type)
ImpactAnalysis      (requirementRevisionId, snapshotId, sourceTargetId, requestKey)
TraceabilityLink    (impactAnalysisId, artifactId, linkType)
Evidence            (provenanceKey)
BaInsight           (impactAnalysisId, insightKey)
InsightEvidence     (insightId, evidenceId)
TraceabilityEvidence (traceabilityLinkId, evidenceId)
GeneratedDocument   (impactAnalysisId, type, status)
DocumentJob         (snapshotId, documentType)
DomainEvent         (idempotencyKey) for retryable command/job events
```

Worker DB writes use transactions for compact persisted result sets and
`upsert`/`createMany({ skipDuplicates: true })` where retries are expected.
Never keep cloning, parsing, or LLM calls inside database transactions.

Do not rely on composite uniqueness containing nullable symbol/line fields for
artifact idempotency. Use deterministic non-null keys:

```text
artifactKey   stable key derived from artifact type, normalized path, symbol/range identity
provenanceKey stable key derived from evidence source origin, source identity, and content hash
insightKey    stable key derived from normalized category/statement/source run identity
```

The exact hashing format belongs in shared persistence utilities and tests.
Retrying the same worker input must resolve to the same keys.

API creation requests for a scan job or impact analysis include a caller
generated `requestKey`. Replaying the same accepted request key returns/reuses
the original execution when its command payload matches; reusing the key with
different ref/input is rejected. An intentional rerun uses a new key. Review endpoints
do not append a new decision event when the requested decision is already the
current state. Finalization remains terminal and cannot create duplicate
approved output.

An accepted analysis must select a `sourceTargetId` whose repository matches
its snapshot. For a moving target, its latest observed commit must equal the
selected snapshot at analysis creation; otherwise the caller must scan/use the
current snapshot or select an explicit pinned commit target.

## Insight Evidence Semantics

Use separate values for machine certainty and human review:

```text
certainty:    EVIDENCED | INFERRED | UNKNOWN | CONFLICTING
reviewStatus: NEEDS_REVIEW | CONFIRMED | REJECTED
```

Persistence requirements:

```text
EVIDENCED    InsightEvidence count >= 1; linked evidence directly supports claim
INFERRED     InsightEvidence count >= 1; metadata records reasoning from context
UNKNOWN      metadata includes reason and retrievalScope; evidence may be empty
CONFLICTING  InsightEvidence count >= 2; metadata explains contradiction
```

Do not use the word `CONFIRMED` for machine certainty. It is reserved for a
human review decision.

## Generated Output Semantics

Persist output projection status independently from analysis freshness against
its selected source target:

```text
GeneratedArtifactStatus: DRAFT | APPROVED

DRAFT     generated from machine analysis before finalization
APPROVED  generated by explicit finalization from current review decisions
```

A `DocumentJob` is the asynchronous workflow/controller state used to build an `APPROVED` `GeneratedDocument`.

Rules for Document Jobs:

```text
- A DocumentJob may only reference a ReviewedReportSnapshot.
- A final report job cannot be created if review completion gate fails.
- A final report job cannot be created if source repository snapshot is stale.
- For one ReviewedReportSnapshot + DocumentType, there is at most one DocumentJob.
- Re-enqueue returns existing job unless explicit retry is requested.
- FAILED job never mutates ReviewedReportSnapshot.
- COMPLETED job points to immutable GeneratedDocument.
```

Recommended provenance fields include:

```text
commitSha
sourceTargetId/targetKey
requirementRevisionId
generatedFromStatus
finalizedAt
reviewCutoffAt
```

Do not mutate approved history just because the repository advances. API
projections return `isStale` based on analysis snapshot versus selected target
observation.

`GeneratedDiagram` is deferred until the Markdown impact-report and review
workflow pass their backend completion gate. When added, it must reuse these
same provenance and freshness rules.

## Version And Staleness

Persist enough provenance to reproduce or invalidate output:

```text
commitSha
analyzerVersion
requirementRevisionId
sourceTargetId/targetKey
modelProvider/modelVersion
promptVersion
contractVersion where output schema changes materially
generatedAt/reviewedAt
```

Lifecycle status is historical; freshness is separate. When a newer target
commit is known, responses for output based on the older snapshot return
`isStale=true` and exports are disabled by default. The persisted output
remains `DRAFT` or `APPROVED` for auditability.
