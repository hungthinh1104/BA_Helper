# ADR-0010: Application And Backend Runtime Boundary

## Status

Accepted.

## Context

Backend orchestration has been extracted from `apps/api`, but some use cases,
repositories, provider adapters, and Nest composition still share one
`backend-runtime` package. That intermediate state makes dependency ownership
unclear and allows API and worker executables to depend on a broad root export.

The next controlled-beta milestone needs one enforceable dependency direction,
one owner for every infrastructure implementation, and independently buildable
API and worker processes.

## Decision

The backend dependency direction is:

```text
contracts + shared + analyzer
              |
              v
         application
              |
              v
       backend-runtime
          /       \
         v         v
       API       worker
```

`application` owns use cases, domain policies, application data types, and
ports. It may depend on internal deterministic packages such as `contracts`,
`shared`, and `analyzer`. It must not import NestJS, Prisma, BullMQ, Redis, or
model-provider SDKs.

`backend-runtime` owns implementations of application ports and Nest
composition modules. Prisma repositories, BullMQ queues, Git/source I/O, and
AI/embedding SDK adapters have exactly one implementation owner here.
`backend-runtime` must not own business use cases.

`apps/api` owns HTTP transport, authentication guards, DTO mapping, and API
composition. `apps/worker` owns queue processors and worker composition.
Processors invoke application use cases and contain no business logic.

Consumers use declared package root or subpath exports. Imports from another
package's `src`, `dist`, or relative filesystem location are forbidden.

## Package Entry Points

Stable entry points are capability-oriented:

```text
@ba-helper/application
@ba-helper/application/embedding
@ba-helper/application/impact-analysis
@ba-helper/application/scanner
@ba-helper/application/document

@ba-helper/backend-runtime
@ba-helper/backend-runtime/ai
@ba-helper/backend-runtime/document
@ba-helper/backend-runtime/embedding
@ba-helper/backend-runtime/prisma
@ba-helper/backend-runtime/queue
@ba-helper/backend-runtime/scanner
```

The root exports remain a compatibility surface during this refactor. New
imports must use the narrowest stable capability entry point.

## Infrastructure Ownership

```text
Prisma client and repositories       backend-runtime
BullMQ queues                        backend-runtime
Git clone and scan source I/O        backend-runtime
LLM provider SDK adapters            backend-runtime
Embedding provider SDK adapters      backend-runtime
HTTP controllers and guards          apps/api
BullMQ processors                    apps/worker
```

API and worker package manifests declare only libraries imported by their own
source. Transitive adapter SDKs belong to `backend-runtime`.

## Enforcement

CI runs `pnpm verify:architecture-boundaries`. The check fails for:

- forbidden framework/SDK imports in `application`;
- worker imports from `apps/api`;
- cross-package deep imports;
- application/use-case implementations in `backend-runtime`;
- duplicated infrastructure implementation filenames across runtime and
  executables;
- forbidden package dependency direction.

TypeScript builds for `application`, `backend-runtime`, API, and worker are
also required.

## Consequences

- Moving a use case requires ports rather than importing a concrete repository.
- Runtime composition is more explicit, but API and worker no longer need
  duplicated infrastructure.
- Provider or persistence replacement is localized to one adapter owner.
- Temporary compatibility root exports are allowed, but no new broad imports
  should be introduced.
