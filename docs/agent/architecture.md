# Architecture

## Product Boundary

The MVP solves one problem:

```text
Given an analysis-ready change request in a booking/payment system and a
supported repository snapshot, identify code impact with traceable evidence
and produce BA-ready follow-up artifacts.
```

The MVP does not attempt general repository documentation, automatic BRD/SRS
generation, enterprise compliance, or multi-language understanding.

## Target Stack

```text
API/worker      NestJS + TypeScript
Database        PostgreSQL + Prisma
Queue           Redis + BullMQ
Analyzer        simple-git + ts-morph, NestJS TypeScript MVP adapter
Contracts       Zod (packages/contracts — shared API wire types and enums)
Shared utils    packages/shared — small cross-package utilities only
AI              provider adapter with structured output
Documents       Markdown impact report
Diagrams        deferred; graph JSON source + Mermaid rendering later
Local infra     Docker Compose
```

## Domain Flow

```text
Repository
  -> RepositoryTarget for selected branch/tag/commit observation
  -> RepositorySnapshot at commitSha + analyzerVersion
     -> CodeArtifact + DependencyEdge + Evidence

Requirement
  -> immutable RequirementRevision (title + raw/normalized change text)
     -> ImpactAnalysis on one snapshot + source target
     -> TraceabilityLink + BaInsight
     -> GeneratedDocument
     -> Human review decisions
```

Lifecycle state and freshness are separate. A completed historical analysis is
not rewritten when a repository advances; its response is projected with
`isStale=true` when a later safe source resolution observes a newer target commit.
The MVP does not continuously monitor remote repository heads.

The first vertical slice uses this change request:

```text
Allow users to cancel paid bookings and receive refund.
```

Expected concepts include booking cancellation, payment refund, slot release,
notification, status transition, tests, and unresolved policy questions.

Input quality is part of domain correctness. Invalid repository URLs,
unsupported frameworks, and non-actionable change requests do not enter impact
analysis; see [input-quality.md](input-quality.md).

## Backend Boundaries

Use modules by capability, not by generic technical layer:

```text
repository        owns repositories, source targets/observations, and immutable snapshot identity
scanner           orchestrates repository scanning use cases
artifact          owns extracted code artifacts
graph             owns dependency edges and graph projections
evidence          owns evidence records and retrieval inputs
requirement       owns change requests and immutable analysis revisions
impact-analysis   orchestrates impact runs over snapshot + requirement
insight           owns BA insights and their evidence joins
traceability      owns requirement-to-artifact links
document          owns generated Markdown artifacts
diagram           later owns generated graph/diagram artifacts
review            owns human decisions
event-log         owns auditable domain events
domain-profile    static domain config (glossary, risk hints, QA templates, prompt context)
retrieval         hybrid evidence retrieval (lexical + vector + graph)
embedding         artifact embedding pipeline and vector chunk persistence
ai                adapts LLM providers only
queue             queues work only
prisma            persistence integration only
```

Avoid generic owners such as `AnalysisService`, `DataService`, or
`CommonService`. A service name must state its domain responsibility.
Source and module decomposition must follow
[code-organization.md](code-organization.md); a capability must not collapse
into a large orchestration/service file as features are added.
Cross-cutting dependency, adapter, error/logging, async and CI rules are in
[code-quality-governance.md](code-quality-governance.md).

## Dependency Direction

Permitted conceptual direction:

```text
repository -> scanner -> artifact -> graph -> evidence
requirement revision + evidence -> impact-analysis
impact-analysis -> insight / traceability / document / diagram / review
```

Rules:

- The worker calls an application use case; it does not implement analysis.
- The AI adapter returns validated structured output; it does not persist.
- Document code, and later diagram code, consumes persisted impact data.
- A module writes its own records; cross-module writes happen via its public
  application service or use case.
- Controllers do not call Prisma or external SDKs directly.
- External SDKs are contained in infrastructure adapters; business logic uses
  interfaces and mapped application results.
- Finalization is a user action that creates reviewed output projections; model
  generation alone never completes business review.

## Backend-First Delivery

Do not build the workspace UI as a substitute for engine correctness.
Backend proof comes from fixture-driven tests and JSON/Markdown output.
The frontend is added once persisted behavior and DTO contracts are stable.
