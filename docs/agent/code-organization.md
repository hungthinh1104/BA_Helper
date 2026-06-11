# Code Organization And Complexity Guardrails

## Purpose

This project is built for reliable evidence and state handling. Large mixed-
responsibility files make both human review and coding-agent edits unsafe.

Line counts are guardrails, not the definition of quality:

```text
one file = one clear responsibility
one module = one business capability
one use case = one orchestration flow
```

When a file grows because it owns more than one responsibility, split the
responsibility before adding more logic.

## Source File Guidance

Applies to handwritten application source files:

| File role | Typical target | Review trigger |
| --- | ---: | ---: |
| Controller | 100-180 lines | over 200 |
| Application use case | 80-180 lines | over 220 |
| Domain service or policy | 120-250 lines | over 300 |
| Persistence repository/mapper | 120-250 lines | over 300 |
| Contract/DTO file | 50-200 lines | over 250 |
| Constants/types file | 100-250 lines | over 300 |

General rules:

```text
- Keep handwritten business source files under 250 lines where practical.
- Any handwritten source file over 300 lines requires a split or an explicit
  local justification in the change description.
- Do not create or expand a handwritten business source file beyond 500 lines.
- If a touched file already exceeds a threshold, do not add unrelated
  responsibility; extract or isolate the new behavior.
```

## Explicit Exceptions

The line guidance is not a reason to fragment structured data artificially.
These files may exceed source limits when kept readable and narrowly purposed:

```text
- Prisma schema and migrations
- generated files
- fixture repository source intentionally modeling messy inputs
- expected JSON/Markdown test data
- static lookup/reference data
```

For a long Prisma schema, use stable sections:

```prisma
// =======================
// Project / Repository
// =======================

// =======================
// Snapshot / Artifact / Evidence
// =======================

// =======================
// Requirement / Analysis / Review
// =======================

// =======================
// Document / Audit
// =======================
```

## Function And Dependency Guidance

```text
- Functions should usually stay under 60 lines.
- A function over 80 lines requires refactoring or explicit justification.
- Keep nesting depth at 3 or less where practical.
- A function should perform orchestration, transformation, or persistence;
  do not combine all three in one method.
- A service should usually inject no more than 5 dependencies.
- If an orchestration use case requires more than 5 collaborators, assess
  whether the flow needs a focused domain service, facade, or split use case.
- Circular module dependencies are forbidden.
```

Dependency count is a design warning, not permission to hide dependencies in a
service locator or generic context object.

## Forbidden God Services

Do not create service classes that become the product boundary by accident.

Forbidden shapes:

```text
AnalysisService:
  scans repositories, calls LLM, persists insights, generates documents,
  applies review decisions, and changes lifecycle state.

RepositoryService:
  clones repositories, extracts code, builds graph, retrieves evidence,
  and produces impact reports.

AiService:
  calls a provider and writes domain rows directly.
```

Preferred responsibilities:

```text
use case       orchestrates one application behavior
domain policy  validates invariant or transition
repository     persists data for its module
adapter        communicates with an external system
mapper         converts application data to API DTO
processor      invokes a use case from a queue job
```

## Module Layout Pattern

Use a layered layout inside a capability once it has more than trivial code:

```text
modules/impact-analysis/
  api/
    impact-analysis.controller.ts
    dto/
  application/
    create-impact-analysis.usecase.ts
    run-impact-analysis.usecase.ts
    finalize-impact-analysis.usecase.ts
  domain/
    impact-analysis.policy.ts
    impact-analysis.capabilities.ts
    impact-analysis.types.ts
  infrastructure/
    impact-analysis.repository.ts
    impact-analysis.mapper.ts
  impact-analysis.module.ts
```

A small module may begin with fewer folders, but it must preserve the same
ownership boundaries as it grows.

## Contract Organization

Do not build one large `contracts.ts` file. Prefer resource-based files:

```text
packages/contracts/
  project.contract.ts
  repository.contract.ts
  repository-target.contract.ts
  scan-job.contract.ts
  artifact.contract.ts
  graph.contract.ts
  evidence.contract.ts
  requirement.contract.ts
  impact-analysis.contract.ts
  insight.contract.ts
  traceability.contract.ts
  document.contract.ts
  error.contract.ts
  index.ts
```

Each contract file should normally remain below 250 lines. Split request,
response, or shared enums only when a file exceeds one coherent resource.

## Test Organization

Split tests by behavior instead of accumulating a single very large spec:

```text
tests/
  fixtures/
    nestjs-booking-with-payment/
      repo/
      expected/
        artifacts.json
        edges.json
        impact-analysis.json
        unknowns.json
  impact-analysis/
    run-impact-analysis.spec.ts
    impact-analysis-state.spec.ts
    impact-analysis-unknowns.spec.ts
    impact-analysis-review.spec.ts
  scanner/
    nestjs-scanner.spec.ts
    scanner-input-gates.spec.ts
```

Test source may be longer than application source where tables of cases are
clear. A test file over 400 lines should normally split by use case or
invariant group.

## Planned Automated Guardrails

When ESLint is scaffolded, add soft complexity warnings first and make cycles
an error:

```js
{
  rules: {
    'max-lines': ['warn', {
      max: 300,
      skipBlankLines: true,
      skipComments: true,
    }],
    'max-lines-per-function': ['warn', {
      max: 80,
      skipBlankLines: true,
      skipComments: true,
    }],
    complexity: ['warn', 12],
    'max-depth': ['warn', 3],
    'max-params': ['warn', 4],
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-floating-promises': 'error',
    'import/no-cycle': 'error',
  },
}
```

Apply file overrides for generated output, Prisma/migrations, fixtures, and
static expected data. Do not weaken the business source guardrails globally to
silence valid warnings.

Cross-cutting adapter, persistence ownership, async, error/logging, and CI
rules are defined in
[code-quality-governance.md](code-quality-governance.md).

## Coding-Agent Editing Procedure

Before editing a large or central file:

```text
1. Name the responsibility being changed.
2. Check whether the existing file owns that responsibility.
3. If not, create a focused use case/policy/adapter/mapper rather than adding
   unrelated logic.
4. Keep state transition, persistence, and external integration boundaries
   separate.
5. Update behavior-focused tests for the changed responsibility.
6. If a threshold is exceeded intentionally, record why it is acceptable.
```
