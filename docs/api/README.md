# BA Helper API reference

Complete the root README's dependency and environment setup first. Start
PostgreSQL and Redis, apply migrations, then start the API:

```bash
pnpm infra:up
pnpm db:migrate
pnpm dev:api
```

With the default API port of 3001:

| Resource | URL |
| --- | --- |
| Interactive Scalar reference | http://localhost:3001/api/docs |
| Downloadable OpenAPI JSON | http://localhost:3001/api/openapi.json |
| Public liveness | http://localhost:3001/api/v1/system/live |
| Public dependency readiness | http://localhost:3001/api/v1/system/ready |

Use the configured API origin when PORT differs. The spec uses the current
origin, so requests work on local and deployed APIs without a hardcoded host.

## Authentication and workflow

Sign in with `POST /api/v1/auth/login`, then paste its `accessToken` into
Scalar's Bearer authentication field. Development login requires the existing
runtime policy; documentation does not enable it. Tokens are not persisted by
the reference, and requests use the API directly without a third-party proxy.

The introduction walks through project selection, public repository scanning,
requirement readiness, impact analysis, evidence review, explicit finalization,
saved report snapshots and Markdown/PDF exports. Async submission is distinct
from completion. Always follow backend state, freshness and capabilities.
Finalization automatically persists the reviewed snapshot and document job,
then attempts queue submission; poll report readiness. Creating another snapshot
and job is not a required follow-up to successful finalization.

Static QA traces describe source references, including their inspection limits.
They do not establish execution, assertions, pass/fail or runtime coverage.

## Accuracy and maintenance

All 104 current operations are documented. Nest discovers the registered HTTP
routes. The documentation catalogue supplies
human descriptions and binds each operation to shared Zod contracts. It does
not generate schemas from Prisma or erased TypeScript types. Path parameters,
actual HTTP status overrides, public routes and account-role metadata come from
controller registration. Query bounds/defaults describe the controller's Zod
or parsing/clamping behavior.

The generator rejects missing, duplicate and orphan catalogue operations.
Controller input tests detect missing bodies/queries and mismatched request
schemas. Cross-field refinements and state policies remain server checks;
OpenAPI cannot express every domain rule.

Invalid request bodies and queries return HTTP 400 with a generic message.
Rejected values and raw validation issue payloads are not echoed to clients;
the OpenAPI reference lists this response for each operation.

Scalar's pinned standalone bundle is served locally. Rendering does not require
a public CDN. External AI chat, telemetry and auth persistence are disabled.
Vue/server-side Scalar code is not imported into the API process.
The converter is pinned to the version documented for the existing Zod 3
contracts; a Zod 4 migration is a separate compatibility change.

For a route or contract change, update the matching file under
`apps/api/src/bootstrap/api-docs/`, shared contracts where needed, and tests.
Do not check in a manually edited OpenAPI JSON copy.

```bash
pnpm exec jest --config jest.config.ts --runInBand tests/release/api-documentation-coverage.spec.ts
pnpm exec jest --config jest.e2e.config.ts --runInBand apps/api/test/e2e/api-documentation.e2e-spec.ts
pnpm exec playwright test e2e/api-documentation.pw.ts --project=desktop
pnpm typecheck
pnpm lint
```

API E2E validates the generated document with Swagger Parser, concrete success
responses, auth, query limits, downloads and local asset delivery. The browser
scenario blocks external requests and checks rendering without page errors.
CI runs both through the existing API/browser suites.
