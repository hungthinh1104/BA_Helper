# Coding Agent Instructions

## Mission

This repository builds a **Requirement-to-Code Impact Analyzer for Technical BA**.

The MVP is deliberately narrow:

```text
Domain: Booking / Payment / Refund
Input: NestJS repository snapshot + analysis-ready change request revision
Output: affected code artifacts, evidence-backed impacts, unknowns,
        BA questions, acceptance criteria, and QA scenarios
```

First vertical slice:

```text
Allow users to cancel paid bookings and receive refund.
```

Do not broaden the product into general code documentation, full BA automation,
multi-language analysis, or a code-smell dashboard unless explicitly requested.

## Fast Path

For backend task:
Read: architecture.md, data-model.md, state-machine.md, testing-strategy.md

For AI/retrieval task:
Read: ai-rules.md, analyzer-rules.md, input-quality.md

For UI task:
Read: ui-tech-stack.md, ui-design.md, css-ownership.md

For Prisma/state/API changes:
Update docs + contracts + tests before completion.

## Current Delivery Order

Work backend and database first. Do not build frontend screens before the API
contracts and backend behavior needed by those screens exist.

```text
1. Agent rules and project docs
2. Workspace/contracts/database scaffold
3. State policies and database constraints
4. Booking fixture, input gates, and expected outputs
5. Scanner and dependency graph
6. Requirement retrieval and impact analysis
7. Review and Markdown impact-report APIs
8. Frontend workspace
```

## Instruction Loading And Workflow

This file is the repository-level instruction source. The workspace is
currently documentation-only and may not yet have a Git root. Until Git is
initialized, start Codex from the `BA_helper` root so this file is discovered;
after initialization, nested package rules may be introduced close to code.

Before making a change:

```text
1. Identify the affected capability and MVP use case.
2. Read the matching document under docs/agent.
3. Inspect existing tests/fixture expectations when code exists.
4. Add or update behavior tests before implementation where behavior changes.
```

When task scope is clear, do not ask for confirmation.
Make the smallest safe change, run relevant checks, and report what changed.
Ask only when a missing decision can cause irreversible schema/API/design drift.

Before reporting completion, follow
[done-checklist.md](docs/agent/done-checklist.md).

## Architecture

Use a TypeScript modular monolith with separate API and worker processes:

```text
apps/web       Next.js UI, added after backend contracts are stable
apps/api       NestJS HTTP API
apps/worker    NestJS BullMQ processors
packages/contracts  Shared Zod API contracts and enums
packages/analyzer   TypeScript/NestJS extraction utilities
packages/shared     Small cross-package utilities only
```

Backend modules are business capabilities:

```text
repository, scanner, artifact, graph, evidence, requirement,
impact-analysis, insight, traceability, document, diagram,
review, event-log, ai, queue, prisma
```

`ai`, `queue`, and `prisma` are supporting infrastructure. The domain center is
evidence-based change impact analysis.

Read [architecture.md](docs/agent/architecture.md) before adding modules or
changing boundaries. Read [use-cases.md](docs/agent/use-cases.md) before
changing user-visible workflow or acceptance criteria.

Read [code-organization.md](docs/agent/code-organization.md) before introducing
new files, expanding services/use cases, or changing lint complexity rules.
Read [code-quality-governance.md](docs/agent/code-quality-governance.md) before
changing dependency direction, adapters/SDK usage, persistence ownership,
errors/logging, TypeScript/lint/CI configuration, or async worker behavior.

## Non-Negotiable Invariants

1. PostgreSQL is the source of persisted truth; backend policies control state changes.
2. AI is not a source of truth and must not write to the database directly.
3. An `EVIDENCED` insight must link to at least one persisted `Evidence` record.
   Certainty naming:
   - EVIDENCED = current MVP name for evidence-backed claim.
   - Long-term target naming should be CONFIRMED / INFERRED / UNKNOWN / CONFLICTING.
   - UI must not invent additional certainty labels.
4. Missing support becomes `UNKNOWN`, `CONFLICTING`, or a stakeholder question, never an invented business rule.
5. Every analysis and generated artifact is tied to a repository snapshot and
   its `commitSha`; moving-ref freshness is computed through its selected
   repository target, not stored as mutable snapshot identity.
6. Frontend code must render backend state and capabilities; it must not derive business state from progress or local guesses.
7. Prisma models are internal and must not be returned directly as API responses.
8. Queue processors invoke application use cases; they must not contain business logic.
9. Retryable jobs must be idempotent and protected by database constraints.
10. Document generation, and later diagram generation, consumes persisted graph/insight data, not free-form model output alone.
11. Every selected prompt payload sent to a real-provider LLM, including
    requirement text and evidence extracted from public repositories, must be
    secret-redacted before transmission.
12. State, schema, contract, or AI output changes require corresponding tests and documentation updates.
13. Lifecycle status and staleness are independent: completed historical output stays completed and may also be stale.
14. Finalization is an explicit user action; machine output alone never finalizes an analysis.
15. Accepted raw input is preserved, but invalid, unsupported, or detected
    secret-bearing requirement input is rejected or marked as needing
    clarification before analysis; detected secret literals are not persisted
    in evidence excerpts.
16. An analysis references immutable input versions: a repository snapshot/index identity and a requirement revision.
17. Do not create or expand God services; keep business source files and functions focused and bounded.
18. `ScanJob` owns in-progress/failure state; publish a `RepositorySnapshot` only
    when usable immutable extraction output exists (`READY` or `PARTIAL`).
19. User-visible requirement title/text used in analysis output comes from the
    immutable `RequirementRevision`, not a mutable requirement container.
20. Review/finalization must not commit as current when a concurrent
    `RepositoryTarget` observation has already made the analysis stale.
21. External SDK use stays in infrastructure adapters; application/domain code
    depends on interfaces and mapped results.
22. Async application/worker code must not drop promises; lifecycle, event, or
    persistence writes are awaited or represented as explicit queued work.

RAG Isolation Rules:
- Every vector query must filter by tenantId, projectId, repositoryId, and snapshotId.
- MVP tenantId = projectId.
- Future tenantId = organizationId.
- Embedding chunks must be commit/snapshot scoped.
- No global vector search is allowed.

## State And Data Rules

Use Prisma enums for state. Separate lifecycle status from processing stage and
from derived freshness/staleness.
All state transitions go through domain policy functions and create an audit
event where the change is meaningful.

Read [state-machine.md](docs/agent/state-machine.md) and
[data-model.md](docs/agent/data-model.md) before changing Prisma schema or
worker flow.

Read [input-quality.md](docs/agent/input-quality.md) before accepting repository
or requirement input, changing validation, or adding analyzer adapters.

Required idempotency constraints include:

```text
RepositorySnapshot  unique(repositoryId, commitSha, analyzerVersion)
RepositoryTarget    unique(repositoryId, targetKey)
ScanJob             unique(repositoryId, requestKey) for retried create commands
CodeArtifact        unique(snapshotId, artifactKey)
DependencyEdge      unique(snapshotId, fromArtifactId, toArtifactId, type)
ImpactAnalysis      unique(requirementRevisionId, snapshotId, sourceTargetId, requestKey)
TraceabilityLink    unique(impactAnalysisId, artifactId, linkType)
Evidence            unique(provenanceKey)
BaInsight           unique(impactAnalysisId, insightKey)
InsightEvidence     unique(insightId, evidenceId)
TraceabilityEvidence unique(traceabilityLinkId, evidenceId)
GeneratedDocument   unique(impactAnalysisId, type, status)
DomainEvent         unique(idempotencyKey) where command/job retry requires it
```

Retrying one submitted scan/analysis request with the same request key must
return or reuse the same execution. An explicit rerun uses a new request key.

## API And Contract Rules

Create shared Zod contracts in `packages/contracts`. API implementations map
database records to response DTOs. Do not make frontend code depend on Prisma
types or database relation shapes.

Prisma types are backend persistence representations. Public API/FE wire types
belong to `packages/contracts`; do not duplicate API enums by hand in the
frontend or treat Prisma types as wire contracts.

Data fetching rules:
- Pages/components must not call fetch directly.
- Use hooks under hooks/api (via TanStack Query).
- Use queryKeys factory.
- API client owns base URL, error mapping, auth token injection.
- All API responses must use @ba-helper/contracts types.
- Mutations must invalidate affected list/detail query keys.
- Mock data may exist only behind hook-level adapters, not imported by page components.

Responses for jobs and analyses must expose explicit state and backend-computed
capabilities such as `canReview`, `canFinalize`, `canExport`, `canRerun`, and `canCancel`.

Read [api-contracts.md](docs/agent/api-contracts.md) before adding endpoints.

## Analyzer And AI Rules

MVP parsing targets TypeScript NestJS repositories using `ts-morph`.
Use fixtures to drive extracted routes, services, entities, tests, and edges.
Do not introduce multi-language parsing until the TypeScript vertical slice is
proved.

Read [analyzer-rules.md](docs/agent/analyzer-rules.md) before implementing or
changing scanner, extraction, framework detection, graph extraction, or
coverage behavior.

The LLM receives selected evidence only, through a provider adapter, and its
structured response is schema-validated before application code persists any
result. Start with a fake provider in automated tests.

Fake Provider Rules:
- FakeLlmProvider and FakeEmbeddingProvider are allowed only in tests/dev.
- Production must fail fast if AI_PROVIDER=fake or EMBEDDING_PROVIDER=fake.
- No silent fallback to fake provider outside test mode.

Read [ai-rules.md](docs/agent/ai-rules.md).

## Code Size And Complexity Rules

```text
- Keep handwritten business source files under 250 lines where practical.
- Files over 300 lines require a split or explicit justification.
- Handwritten business source files over 500 lines are not allowed.
- Functions should normally remain under 60 lines; over 80 requires review.
- Avoid more than 3 nested levels and more than 5 injected dependencies.
- Circular module dependencies are forbidden.
```

Exceptions such as Prisma schema/migrations, generated files, intentional
fixtures, and static expected data are documented in
[code-organization.md](docs/agent/code-organization.md).

## Testing Rules

Development is use-case-first and fixture-based:

```text
acceptance criteria -> fixture repo -> expected output -> tests -> code
```

The first fixture represents a booking cancellation/refund flow with deliberate
keyword noise. Tests must cover artifact extraction, graph edges, evidence
retrieval precision, unknown/conflict generation, state transition rejection,
partial snapshot policy, staleness projection, idempotent retry, finalization,
and insight review.

Read [testing-strategy.md](docs/agent/testing-strategy.md) before implementing
the engine.

## Auth Boundary

The MVP may run in dev/single-user mode while the backend engine is built.
When user-facing auth is introduced, every project-scoped endpoint must enforce
backend permission checks and auditable changes. Public repo support comes
before private repo integration.

Read [auth-permissions.md](docs/agent/auth-permissions.md) before adding auth.

## UI Rules

- Marketing and workspace must support both light and dark.
- Default theme = system.
- Landing visual direction remains Letters-inspired.
- Workspace visual direction remains Linear-inspired.
- Do not scope dark mode to inner containers; theme class must live on `<html>`.
- Use Next.js route groups:
  - (marketing) = Landing pages
  - (app) = Application workspace
- Use shadcn/ui as primitives only.
- Do not use shadcn dashboard templates as product architecture.
- Product-specific components live under components/workspace.
- Generic primitives live under components/ui.
- Do not edit globals.css directly except imports.
- Put design tokens in tokens.css.
- Put landing-specific styles in landing.css.
- Put workspace-specific styles in workspace.css.
- Do not create one-off colors; use CSS variables.
- App workspace must support evidence review, not just dashboard cards.
- Mobile workspace should prioritize review task, not full graph.

Read [ui-tech-stack.md](docs/agent/ui-tech-stack.md) before building UI components.
**Golden Rule:** If it is generic UI behavior → use shadcn. If it is BA impact/evidence/review workflow → custom.

## Scope Control

Do not modify generated files, dependency lockfiles without a dependency
change, unrelated modules, or frontend code during backend-only work.
During the backend/DB-first phase, do not build frontend behavior unless it is
explicitly requested.

Add nested `AGENTS.md` files only after corresponding application/package
directories exist and have specialized, stable rules worth loading
automatically.

## Verification

The repository is initially documentation-only. Once workspace scripts exist,
run the relevant checks before finishing a code change:

```bash
pnpm typecheck
pnpm test
pnpm lint
```

When applicable:

```text
Prisma change       generate client, add migration, update contracts/tests
API contract change update Zod contract, mapper, consumer tests
State change        update enum, policy, capabilities, tests, state docs
AI schema change    update validation and fake-provider/golden tests
Analyzer change     update fixture expected output and analyzer/retrieval tests
```
