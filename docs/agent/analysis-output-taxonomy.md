# Analysis Output Taxonomy

## Purpose

Analysis output is organized as a decision workflow, not as a dump of raw
backend records. The taxonomy keeps the product centered on the core pipeline:

```text
requirement change
-> code snapshot
-> evidence-backed analysis
-> human review
-> immutable reviewed snapshot
-> snapshot-sourced report
-> drift / rerun / diff
```

Every output item should help a BA, developer, or QA reviewer answer one of the
questions below. If an item does not fit one group, it should not be added to
the analysis surface without a new explicit product decision.

## Fixed Output Groups

### 1. Requirement Understanding

Answers: what does the system understand the requested change to mean?

This group renders from `RequirementRevision` fields and snapshot-safe derived
summaries. Generated summaries must either be persisted with provenance or
clearly marked as presentation-only. It must render from the
`RequirementRevision`, not from a mutable requirement container.

### 2. Impacted Artifacts

Answers: which code artifacts are affected?

This group contains artifact cards, artifact groups, dependency depth, and
traceability links between the requirement and code artifacts. It must preserve
snapshot provenance: repository, snapshot id, commit SHA, analyzer version, and
profile version when available.

### 3. Evidence Map

Answers: why does the system believe an artifact, behavior, or risk is relevant?

This group contains persisted evidence excerpts, source location, retrieval
signals, and links from evidence to insights, traceability links, risks, and QA
scenarios.

Evidence excerpts are untrusted source data:

- Stored evidence may preserve source excerpts only if the project policy
  allows it.
- Any evidence shown to users, logs, diagnostics, or real-provider AI must pass
  through the redaction layer.

### 4. Risks And Unknowns

Answers: what is risky, unsupported, conflicting, or still unclear?

This group separates risks, unknowns, conflicts, and stakeholder questions.
Missing support must not be upgraded into a confident business rule. Unknowns
are useful when they identify missing policy, missing evidence, partial scan
coverage, or conflicting signals that require review.

Risk items may initially be projected from existing insight records, but the
projection rule must be explicit. If risks become a first-class persisted
output, the persistence model must introduce an explicit `RISK` type instead
of overloading `CLAIM`.

### 5. QA Scenarios

Answers: what should QA test because of this change?

This group contains scenario cards with testable given/when/then content,
regression target, and links back to at least one affected artifact, risk,
unknown, or evidence item. QA scenarios must be traceable to the analysis
surface; they are not standalone generated suggestions.

### 6. Review Decisions

Answers: what has a human accepted, rejected, or sent back for more evidence?

This group contains the review queue, decisions, reviewer notes, finalization
readiness, and report snapshot status. Review/finalization is an explicit user
action. Machine output alone never finalizes an analysis.

Reviewed traceability state must include link id, artifact identity, review
decision, decision basis, reviewer note if applicable, and evidence
references. Report generation must consume that reviewed state from the
snapshot payload instead of querying live traceability records.

## Presentation Order

The default workspace order is:

```text
Overview -> Impact Map -> Evidence -> Risks & QA -> Review & Report
```

Each view should answer one primary question. Advanced diagnostics and debug
signals should be available but collapsed by default.

## Out Of Scope

- General repository documentation.
- Code smell dashboards.
- New language or framework support without fixtures and evaluation cases.
- Multi-domain expansion before the booking pack and general fallback remain
  stable.
- UI-only derivation of business state from raw backend objects.
