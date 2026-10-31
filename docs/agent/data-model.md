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

Requirement list reads return each requirement's latest immutable revision
and revision count. The supporting indexes are ordered for project listing
(`projectId`, newest `createdAt`, stable `id`) and latest-revision lookup
(`requirementId`, newest `createdAt`, stable `id`); list queries should not
load every historical revision just to select the newest one.

Requirement creation accepts a client-generated UUID `requestKey`, unique
within its project, and stores a hash of the normalized request payload. A
retry with the same key and payload returns the existing requirement; reuse
with a different payload returns `REQUEST_KEY_MISMATCH`. The requirement,
initial revision, and both creation events commit atomically.

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
ImpactAnalysis    owns one requirement revision evaluation against one snapshot and its repository target
BaInsight         owns BA-facing claims, unknowns, questions, ACs, QA scenarios
TraceabilityLink  owns requirement-to-artifact impact relation for an analysis
Generated*        owns outputs tied to the analysis commit
DocumentJob       owns asynchronous process state for building final documents
DomainEvent       owns audit/debug history
```

Jest declaration metadata remains in `CodeArtifact.metadata.testCase`. Its
optional `parameterized` flag identifies a source callback with unexpanded
data rows. This additive JSON field needs no Prisma column or migration;
shared contracts validate it before persistence and projection. Historical
metadata and saved-report payloads without the flag remain unchanged.

`DependencyEdge.confidence` and `metadata` are nullable for historical rows.
New TypeScript graph metadata follows the shared dependency provenance schema:
static source-reference kind, resolver, repository-relative line locations
(maximum 20 plus omitted count), and the source artifact's same-snapshot
`Evidence.provenanceKey`. Metadata contains no raw source excerpts. The existing
unique(snapshotId, fromArtifactId, toArtifactId, type) constraint deduplicates
relationships; repeated call sites are aggregated into their provenance.

Every dependency edge endpoint must belong to the edge's `snapshotId`. Scanner
ingestion resolves both endpoint IDs from that snapshot's persisted artifact
set. Graph projections must also filter by the edge snapshot and both endpoint
artifact snapshots, so malformed or legacy cross-snapshot rows cannot enter
graph, comprehension, retrieval, QA, workspace, diff, multi-repo review, or
reviewed-report output. PostgreSQL now enforces this at write time through
composite foreign keys from `(fromArtifactId, snapshotId)` and
`(toArtifactId, snapshotId)` to `CodeArtifact(id, snapshotId)`. The migration
fails without rewriting data if historical edges violate the invariant.

`ReviewedReportSnapshot.testTraceSnapshot` is nullable JSON with the versioned
`reportTestTraceSnapshotSchema` payload: `{ version: 1, coverage }`. It freezes
the static QA projection, immutable repository snapshot/commit/analyzer
identity, case metadata, semantic paths, evidence IDs, search limits and
limitations at snapshot creation. Rejected impact rows are excluded; remaining
rows retain their static-reference classifications. Source excerpts are not
duplicated in this payload. The existing finalization transaction persists it
with the review snapshot and document job. Document retries only read this
field and never recompute test traces from live analysis relations.

Existing report snapshots retain null. No backfill is performed. Their stored
Markdown stays readable without invented case paths. Capturing a new snapshot
is an explicit existing review/finalization action and uses its existing audit
event. The worker validates saved analysis/snapshot/commit/analyzer identity
before rendering a test trace section.

## Required Relations

```text
RepositoryTarget   -> Repository, targetKey/ref type, latest observed commit
RepositorySnapshot -> Repository, commitSha, analyzerVersion, published coverage status
RepositoryProfile  -> RepositorySnapshot, domain/language/framework/architecture and bounded roots
ScanJob            -> Repository + requested ref, optional same-repository RepositoryTarget, and eventual same-repository published snapshot
CodeArtifact       -> RepositorySnapshot
DependencyEdge     -> RepositorySnapshot + fromArtifact + toArtifact
Evidence           -> source origin: snapshot/artifact and/or requirement revision
RequirementRevision -> Requirement and immutable submitted title/raw/normalized text
ImpactAnalysis     -> Requirement + RequirementRevision + Repository + RepositorySnapshot + selected RepositoryTarget with matching project/repository lineage
BaInsight          -> ImpactAnalysis
ClarificationItem  -> ImpactAnalysis + BaInsight from the same analysis
ReviewClarificationRequest -> AnalysisReviewDecision from the same analysis
InsightEvidence    -> BaInsight + Evidence
TraceabilityLink   -> ImpactAnalysis + CodeArtifact
TraceabilityEvidence -> TraceabilityLink + Evidence
TraceabilityReviewDecision -> ImpactAnalysis + TraceabilityLink in the same analysis
ReviewNote         -> ImpactAnalysis + Insight or TraceabilityLink in the same analysis
GeneratedDocument -> ImpactAnalysis + ReviewedReportSnapshot
ReviewedReportSnapshot.approvedDocument -> GeneratedDocument from the same ImpactAnalysis
DocumentJob        -> ImpactAnalysis + ReviewedReportSnapshot + GeneratedDocument (optional)
MultiRepoAnalysisRun -> Project + RequirementRevision owned by that Project
ImpactAnalysis      -> optional MultiRepoAnalysisRun with matching project,
                       requirement, and immutable revision lineage
EmbeddingChunk     -> Repository + RepositorySnapshot + optional CodeArtifact with matching identity
```

When an `ImpactAnalysis` belongs to a `MultiRepoAnalysisRun`, PostgreSQL binds
the run ID together with the analysis project, requirement, and requirement
revision. Deleting a run with child analyses is restricted so persisted lineage
cannot be silently detached.

`ClarificationItem.impactAnalysisId` and its source insight must identify the
same analysis. PostgreSQL enforces this with a composite foreign key to
`BaInsight(id, impactAnalysisId)`. The migration refuses mismatched historical
clarifications without rewriting or deleting them.

`ReviewClarificationRequest.analysisId` and its review decision must also
identify the same analysis. PostgreSQL enforces this with a composite foreign
key to `AnalysisReviewDecision(id, analysisId)`. Its migration refuses
mismatched historical requests without rewriting or deleting them.

Each `DependencyEdge` endpoint must belong to the edge's `snapshotId`.
PostgreSQL enforces both `(fromArtifactId, snapshotId)` and
`(toArtifactId, snapshotId)` against `CodeArtifact(id, snapshotId)`. Graph reads
also scope the edge and both endpoint relations to one snapshot.

An optional `ScanJob.sourceTargetId` and `ScanJob.snapshotId` must each belong
to the job's `repositoryId`. PostgreSQL enforces these pairs with composite
foreign keys. The migration refuses historical cross-repository links without
clearing or rewriting them. Deleting a referenced target or snapshot is
restricted so the scan job retains its recorded provenance.

`TraceabilityLink` stores the analysis snapshot and its linked `CodeArtifact`
must belong to that same `RepositorySnapshot`. PostgreSQL enforces both
`(impactAnalysisId, snapshotId)` and `(artifactId, snapshotId)` with composite
foreign keys. The migration backfills the analysis snapshot for valid legacy
links and fails without rewriting data if an existing link points to an
artifact from another snapshot. Read projections remain scoped to the analysis
snapshot as defense in depth.

A requirement can be analyzed repeatedly across revisions and snapshots.

`ImpactAnalysis.repositoryId` is backfilled from its immutable snapshot and is
enforced against both the snapshot and selected source target with composite
foreign keys. The migration fails before changing schema if legacy analysis
rows pair a snapshot and target from different repositories; it does not
rewrite or delete those rows. Deleting a referenced snapshot or target is
restricted so analysis provenance remains intact.

`ImpactAnalysis.projectId` and `requirementId` are backfilled from its
repository and immutable requirement revision. Composite foreign keys require
that its repository belongs to the same project as the requirement and that
the revision belongs to that requirement. The migration refuses historical
cross-project analyses before schema changes and preserves those rows for
explicit repair.

A `TraceabilityReviewDecision` must reference the same `ImpactAnalysis` as its
`TraceabilityLink`. PostgreSQL enforces the pair with a composite foreign key
on `(traceabilityLinkId, analysisId)`.

A `ReviewNote` must reference exactly one review target, and that `Insight` or
`TraceabilityLink` must belong to the note's `ImpactAnalysis`. PostgreSQL
enforces target cardinality with a check constraint and ownership with
composite foreign keys.

An `EmbeddingChunk` must match its repository project, the repository and
commit of its snapshot, and the snapshot of its optional artifact. PostgreSQL
enforces these pairs with composite foreign keys. The MVP also requires
`tenantId = projectId` through a check constraint. When tenant identity changes
to `organizationId`, replace that check as part of the tenant migration.

An `Evidence` row linked to a `CodeArtifact` must also name a snapshot, and the
artifact and evidence snapshot must match. PostgreSQL enforces the pair with a
composite foreign key and a check constraint; the check is required because a
composite foreign key with PostgreSQL's default `MATCH SIMPLE` accepts a NULL
snapshot component.

For an analysis explicitly accepted from a `PARTIAL` snapshot, persist its
known limitation:

```text
acceptedPartialCoverage: boolean
coverageWarning: string or structured metadata
```

This warning is not UI-only; it must remain available to generated outputs.

Domain-pack selection is also persisted on `ImpactAnalysis` as first-class
provenance, not only in JSON metadata:

```text
requestedDomainPackId
resolvedDomainPackId
resolvedDomainPackVersion
resolvedDomainPackStatus: STABLE | PARTIAL | EXPERIMENTAL | FALLBACK
domainPackSelectedBy: EXPLICIT | REPOSITORY_PROFILE | FALLBACK
domainPackResolvedAt
domainPackManifestDigest?
domainPackRegistryVersion?
```

The worker must read these persisted resolved fields on retry. Queue payloads
and frontend labels are not source of truth for domain-pack selection. Legacy
metadata may be used only as a compatibility fallback for older rows.

`MultiRepoAnalysisRun` stores the same resolved selection fields for explicit
run-level selection. In v1, child analyses receive the run-level selection and
cannot override it. Merged-report provenance prefers explicit run-level fields
and falls back to homogeneous child analysis provenance for legacy runs.

The run also stores a nullable `requestPayloadHash` over the immutable command
inputs (requirement revision, sorted repository IDs, partial-snapshot consent,
and canonical explicit domain-pack selection) and a nullable `requestPlan` with
the selected repository, source-target, and snapshot IDs. A same-key concurrent
create that loses the unique-key race reloads the winning run and proceeds only
when the hash matches. Retries use the saved plan, so a newer branch observation
cannot silently mix another snapshot into a partially created run. `NULL` values
are reserved for pre-migration runs; those retain the legacy child-set and
domain-pack comparison and legacy planning behavior.

Each `MultiRepoAnalysisRun` persists the owning `requirementId` alongside its
project and revision IDs. Composite foreign keys require that the revision
belongs to that requirement and that the requirement belongs to the run's
project. The migration backfills valid legacy runs and fails before changing
the schema if historical project/revision lineage is inconsistent; it never
reassigns or deletes such rows.

An `ImpactAnalysis` attached to a multi-repo run must carry the same project,
requirement, and immutable requirement revision as that run. A composite
foreign key enforces the full identity; the migration preserves matching
legacy children and refuses mismatched history before replacing the old
run-ID-only foreign key. Deleting a run with attached analyses is restricted
so the child provenance cannot be silently detached.

`domainPackManifestDigest` and `domainPackRegistryVersion` are nullable until
the canonical manifest source is fully versioned. Do not synthesize fake digest
values; absence means the manifest digest was not captured for that record.

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

Embedding enqueue for a published snapshot must use a deterministic queue key
derived from `snapshotId`. Retrying the same scan/snapshot must not create
multiple independent vector-index jobs for identical extraction output.

Embedding reuse identity is the configured/persisted model name returned by
the provider; `providerName` identifies the vendor and must not be used as the
model key. Indexing, retry checks, cross-snapshot copies, and reuse diagnostics
must use the same model identity. Vector search must filter by the model that
produced its query vector in addition to tenant, project, repository, and
snapshot scope. Equal vector dimensions alone do not make different models'
vectors comparable.

Retrieval returns run-level `strategy` and `vectorStatus` diagnostics. A result
with no compatible model chunks, a provider-model mismatch, a vector failure,
or a snapshot that is not vector-ready must be recorded as
`strategy: lexical_fallback` with the corresponding `vectorStatus`; it must not
be recorded as a successful hybrid vector run. These values are persisted in
the completed analysis `metadata.retrieval` alongside the vector signal count.

Within one snapshot, an existing embedding chunk is an idempotency hit only
when its `stableChunkId`, redacted-content `contentHash`, and `chunkerVersion`
match the chunk built by the current worker. A missing or older chunker version
must be regenerated, even when the stable ID and content hash match. The
persisted model is already scoped by the snapshot cache lookup.

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
CODE/TEST/STATIC_ANALYSIS evidence must identify its snapshot and may identify an artifact. PostgreSQL rejects a missing snapshot for these source types.
REQUIREMENT_INPUT evidence must identify its immutable RequirementRevision.
COVERAGE evidence must identify the snapshot whose gaps it describes. PostgreSQL rejects a missing requirement revision or coverage snapshot.
When both `artifactId` and `snapshotId` are present, the artifact must belong to that snapshot. PostgreSQL enforces this pair through a composite foreign key. When repository evidence is read for an analysis, its snapshot and any referenced requirement revision must match that analysis. Requirement-only evidence with no snapshot is scoped to the exact immutable revision.
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
TEST_FILE
TEST_CASE
UNKNOWN
```

`CodeArtifact.metadata` is nullable JSON. For `JEST_TEST_CASE`, it contains
validated `{ testCase: { framework: 'jest', suitePath, title, modifier,
declaredModifier, parentFileArtifactKey } }`. Labels are secret-redacted before
persistence; parent identity must match the case's source file. AST offsets
are transient. File containers (`TEST`, `SPRING_TEST`) normalize to `TEST_FILE`;
only extracted Jest cases normalize to `TEST_CASE` on new scans. Existing rows
keep their historical kind and absent metadata; rescan with `analyzer@0.5.0`
to obtain case identities. The existing snapshot/artifactKey constraint keeps
case persistence idempotent.

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
ReviewedReportSnapshot (id, analysisId) for generated-document scope
GeneratedDocument   (reviewedReportSnapshotId, type, status) for snapshot-bound reports
GeneratedDocument   partial (impactAnalysisId, type, status) where reviewedReportSnapshotId IS NULL
DocumentJob         (snapshotId, documentType)
DomainEvent         (idempotencyKey) for retryable command/job events
```

Composite foreign-key targets also require these unique reference keys:

```text
Repository         (id, projectId)
RepositorySnapshot (id, repositoryId, commitSha)
CodeArtifact       (id, snapshotId)
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

## Report Evidence Quality Semantics

Evidence quality is a report/read-model classification, not a persisted Prisma
enum in the current MVP. It must be computed from persisted evidence, artifact
links, machine certainty/basis, and review state.

Current report-only labels:

```text
STRONG_SOURCE_EVIDENCE   persisted CODE/TEST/STATIC_ANALYSIS evidence with artifact, source path, line range, and specific excerpt
WEAK_SOURCE_EVIDENCE     persisted source evidence exists, but locator or excerpt specificity is weak
INFERRED_FROM_STRUCTURE  impact is inferred from artifact structure, link basis, or contextual metadata
DOMAIN_HINT_ONLY         domain pack terminology/template/hint exists without persisted source evidence
MISSING_EVIDENCE         no persisted source evidence supports the item
CONFLICTING_EVIDENCE     machine certainty is CONFLICTING or contradiction is explicitly represented
REVIEW_REQUIRED          critical/unreviewed item still requires human review
```

Rules:

```text
Domain pack hints never upgrade quality to STRONG_SOURCE_EVIDENCE.
EVIDENCED certainty alone is insufficient; report quality must inspect linked Evidence.
Code/source excerpts remain raw source text after redaction and are not translated.
Legacy reports may contain older quality labels; readers should tolerate them
while new reports emit the labels above.
```

## Report Review Coverage Semantics

Review coverage is a report/read-model summary and is also consumed by the
single-repo approval gate for critical unresolved evidence issues.

Current coverage summarizes:

```text
insights.reviewed / insights.total
traceabilityLinks.reviewed / traceabilityLinks.total
accepted, rejected, needsReview, needsMoreEvidence, unreviewed decisions
strong, weak, missing, conflicting, and reviewRequired evidence-quality counts
```

`needsClarification` is a display/read-model aggregate of:

```text
needsReview + needsMoreEvidence + unreviewed
```

Rules:

```text
Coverage is derived from persisted review status/decisions and report evidence quality.
Coverage does not call the LLM, scanner, retrieval, or domain-pack registry.
Coverage may be shown in final/reviewed report UI and Markdown reports.
The approval gate does not call the LLM, scanner, retrieval, or domain-pack registry.
Non-critical unreviewed items may still use explicit acknowledgement.
Critical blockers are backend-authored and use stable reason codes.
Current critical items are `CLAIM` insights, `CONFLICTING` insights, and
`AFFECTED` traceability links with `EVIDENCED` basis. `UNKNOWN` outputs remain
reviewable gaps and are not automatically critical claims.
```

Current critical approval blocker codes:

```text
CONFLICTING_EVIDENCE_UNREVIEWED
CRITICAL_MISSING_EVIDENCE
REVIEW_REQUIRED_ITEMS
HIGH_RISK_INSIGHT_UNREVIEWED
```

## Generated Output Semantics

`ReviewedReportSnapshot` freezes review decisions, evidence quality, QA trace,
and review clarification state. `clarificationsSnapshot` stores each
clarification's identity, question, answer, status, and creation time as they
were when the snapshot was made. Report workers render that frozen state and
must not substitute later live answers. Clarification creation and answer
mutations lock the parent analysis row so they serialize with snapshot creation.
Legacy snapshots without this field reconstruct clarification state from the
persisted creation/answer/cancellation timestamps at the snapshot time.

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
- `DocumentJob.analysisId` must identify the same analysis as its snapshot;
  PostgreSQL enforces this with a composite foreign key on
  `(snapshotId, analysisId)`.
- If a job links a `GeneratedDocument`, it must belong to the same analysis;
  PostgreSQL enforces the paired nullable document ID and analysis ID with a
  composite foreign key plus a check against `DocumentJob.analysisId`.
- Deleting a linked `GeneratedDocument` clears both optional job identity
  fields, preserving the existing `ON DELETE SET NULL` behavior.
- A final report job cannot be created if review completion gate fails.
- A final report job cannot be created if source repository snapshot is stale.
- For one ReviewedReportSnapshot + DocumentType, there is at most one DocumentJob.
- Re-enqueue returns existing job unless explicit retry is requested.
- FAILED job never mutates ReviewedReportSnapshot.
- COMPLETED job points to immutable GeneratedDocument.
- Completion is conditionally claimed inside the publication transaction. A
  concurrent delivery that observes another worker's completed result returns
  that persisted document without rewriting it.
```

Each generated approved report is scoped to one `ReviewedReportSnapshot`.
Retries for that snapshot reuse its document; a later snapshot creates a new
document so earlier Markdown and localization artifacts remain unchanged. The
existing document content is immutable for that snapshot; a retry does not
replace it with a newly rendered body. The snapshot's Markdown is copied from
the persisted document content. The generated document's snapshot identity is
paired with its analysis ID. The reverse `approvedDocumentId` link also pairs
the document ID with the snapshot analysis ID through a composite foreign key.
Legacy snapshot links are backfilled only with their existing analysis ID;
shared documents remain readable when all linked snapshots belong to that
analysis. Migration preflight fails without rewriting data if a historical
link crosses analyses.

Legacy generated documents that cannot be assigned unambiguously to one
reviewed snapshot retain a null `reviewedReportSnapshotId`. Their partial
unique index on `(impactAnalysisId, type, status)` preserves the historical
idempotency key for those rows. Snapshot-bound documents use the composite
snapshot identity; the ordinary nullable composite index alone does not protect
the null-snapshot legacy rows in PostgreSQL.

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
## Local Account Lifecycle

`User.passwordHash` stores the scrypt credential hash.
`User.credentialsVersion` starts at `1` and is copied into issued JWTs.
Password reset and account disable increment this value so existing sessions
are rejected on their next authenticated request. `User.disabledAt` is nullable;
a non-null value prevents both password login and JWT validation.
