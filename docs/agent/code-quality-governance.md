# Code Quality Governance

## Purpose

Clean code in this project means protecting:

```text
business boundaries
state transitions
evidence provenance
API contracts
async job safety
reviewable output
```

This document covers cross-cutting code rules. File size and module splitting
rules remain in [code-organization.md](code-organization.md). Domain
correctness remains in the use-case, state, data, and testing documents.

## Non-Negotiable Boundaries

```text
Controller        validates transport input and invokes a use case.
Use case          orchestrates one application behavior.
Domain policy     enforces invariant or transition.
Repository        persists records for its owning module.
Mapper            produces API DTOs from application results.
Adapter           owns external SDK/library integration.
Queue processor   invokes a use case and reports job execution only.
```

Forbidden dependency shapes:

```text
controller -> Prisma
controller -> provider SDK
worker processor -> Prisma plus domain orchestration
AI provider -> Prisma/domain writes
document generator -> raw unvalidated LLM response
frontend -> Prisma type or database relation shape
```

Application flow should be explicit:

```text
transport/processor -> use case -> domain policy/module API -> repository -> Prisma
use case -> adapter interface -> infrastructure SDK implementation
application result -> mapper -> contract DTO -> consumer
```

## Module Write Ownership

Only the owning module writes its aggregate records through its repository or
application API:

```text
artifact module       writes CodeArtifact
graph module          writes DependencyEdge
evidence module       writes Evidence
insight module        writes BaInsight and InsightEvidence
traceability module   writes TraceabilityLink and TraceabilityEvidence
document module       writes GeneratedDocument
event-log module      writes DomainEvent
```

A cross-module use case coordinates these public application operations. It
must not bypass ownership by issuing arbitrary Prisma writes for every table.
When one use case must commit multiple module writes atomically, it uses a
transaction/unit-of-work boundary with transaction-aware module repositories
or ports; atomicity is not an excuse to collapse ownership into a God
repository/service.

State transition policies remain the only entry point for lifecycle mutation.
Do not update lifecycle status directly from controllers, processors, report
generators, adapters, or general repositories.

## Type And Contract Ownership

Use different truth boundaries deliberately:

```text
Prisma enums/models       persisted database representation, backend-internal
packages/contracts        public API request/response schemas and shared wire enums
frontend                   imports generated/shared contract types only
AI structured schemas      validation input/output for provider adapter, mapped into domain types
```

Rules:

```text
- Do not expose or import Prisma models as API/FE contracts.
- Do not retype API enums as handwritten frontend string unions.
- Do not assume Prisma enum changes automatically update public contracts.
- When a persisted enum affects API output, update Prisma, contracts, mappers,
  capability logic, and tests together.
- AI schemas must map explicitly to domain/application commands; provider
  output is never a persistence model.
```

## External Integrations

Keep SDK usage within infrastructure adapters:

```text
OpenAI/other LLM SDK  -> ai/infrastructure/*provider.ts
Git clone/source IO   -> repository or scanner infrastructure adapter
Prisma client         -> module repositories/infrastructure persistence
BullMQ/Redis          -> queue infrastructure and processors
Pino/OpenTelemetry    -> observability infrastructure
```

Use cases depend on interfaces and validated application results, not vendor
payloads. Do not allow SDK response objects to leak into contracts or domain
records without mapping.

## Async And Worker Safety

This project performs clone, parse, database, queue, and LLM work
asynchronously. Silent promise loss is a correctness bug.

Rules:

```text
- Await or intentionally return every promise in application and processor code.
- Do not fire-and-forget persistence, event logging, finalization, or state transition work.
- Background work must be represented as a queued job, not an untracked promise.
- Processors acknowledge success only after their use case and required
  persisted state/event writes complete.
- Retriable handlers use request/idempotency keys and do not duplicate output.
- Long external operations do not execute inside database transactions.
```

When ESLint exists, `@typescript-eslint/no-floating-promises` is an error, not
a warning.

## Error Handling And Observability

Use stable domain/application error codes and typed errors, not generic
`Error("Failed")` for expected failure modes.

Required initial error families include:

```text
InputValidationError
UnsupportedFrameworkError
SnapshotNotFoundError
TargetSnapshotMismatchError
PartialSnapshotAcknowledgementRequiredError
InvalidStateTransitionError
AnalysisStaleError
MissingEvidenceForEvidencedInsightError
AiOutputValidationError
IdempotencyKeyConflictError
```

API adapters map typed errors to the stable codes defined in
[api-contracts.md](api-contracts.md). Workers persist/log a safe failure code
and transition their job through policy; they do not expose raw stack traces
as report content.

Structured logs for jobs/analyses should contain identifiers when available:

```text
event
errorCode
jobId
projectId
repositoryId
sourceTargetId
snapshotId
requirementRevisionId
analysisId
stage
commitSha
analyzerVersion
```

Do not log:

```text
raw source snippets
raw requirement text by default
tokens, credentials, secrets, or unredacted LLM input/output payloads
provider prompts/responses containing sensitive content
```

## Naming And Refactor Triggers

Name code after the capability or command it owns:

```text
RunImpactAnalysisUseCase
FinalizeImpactAnalysisUseCase
TransitionImpactAnalysisStatePolicy
BuildDependencyGraphUseCase
RetrieveImpactEvidenceService
ValidateAiInsightOutputService
ImpactAnalysisMapper
```

Avoid vague owners:

```text
AnalysisService
DataService
ManagerService
CommonService
HelperService
ProcessorService
```

Mandatory design review/refactor triggers:

```text
file exceeds documented threshold
function exceeds documented threshold
service needs more than 5 injected dependencies
use case gains more than 7 meaningful orchestration steps
business logic appears in a controller or queue processor
business rule appears inside a persistence repository
same domain rule is repeated in 3 locations
SDK usage appears outside its adapter boundary
new direct Prisma write bypasses module ownership or state policy
```

## Automated Guardrails By Stage

Documentation sets intent; executable checks enforce it once code exists.

### Scaffold Stage

Add when the TypeScript workspace is created:

```text
TypeScript strict mode
Prettier
ESLint
pnpm typecheck
pnpm lint
pnpm test
```

Required lint directions:

```js
{
  rules: {
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    'import/no-cycle': 'error',
  },
}
```

Retain the file/function/complexity guardrails specified in
[code-organization.md](code-organization.md).

### Core Backend Stage

CI must run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm prisma:generate
```

The schema/generate command must be configured so CI fails on invalid Prisma
schema or unexpected generated-client failure; migrations are verified when
database migrations exist.

Required tests:

```text
invalid state transition is rejected
EVIDENCED insight without direct evidence is rejected
worker retry and command retry do not duplicate persisted output
API responses validate against contract schema
invalid AI output and invented evidence references are rejected
rejected insights do not enter approved Markdown conclusions
review/finalization cannot race past a newer target observation
processor success waits for required state/event persistence
typed error mapping returns stable API codes without leaking unsafe detail
```

Diagram-from-`graphJson` tests become mandatory only when diagram generation
enters scope; it is deferred for the current MVP milestone.

### Larger Module Stage

Only after module volume warrants it, add:

```text
architecture/import-boundary tests
dependency graph checks
dead code checks
coverage thresholds for critical policies/use cases
```

Do not install governance tooling before there is code for it to protect.
