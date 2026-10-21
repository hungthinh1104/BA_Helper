# Scalar API reference verification — October 21

Scope: document the existing API accurately and make the Scalar reference work
from the running API without a CDN. No new domain endpoints or schema migrations.
Evidence is from the current dirty working tree based on
`0ac83a7b5f585232ba276e15b3f0787954113584`, not hosted CI on a reviewed commit.

## Delivered

- `/api/docs` and `/api/docs/`: Scalar reference.
- `/api/openapi.json`: generated OpenAPI 3.0 document, current-origin server.
- `/api/docs/scalar.js`: exact installed standalone bundle, served locally.
- All 104 controller operations: descriptions, tags, Zod-backed JSON request and
  success schemas, request examples where provided, path/query parameters,
  HTTP status overrides, error envelopes, auth and permission notes.
- Markdown/PDF downloads have their actual content types and attachment header.
- Public login, development-only login, optional workspace authentication and
  protected routes retain their actual authorization semantics.
- Shared schemas now describe existing acknowledgement responses, report-job
  input, review-note lists and failed queue retry output. Runtime validation,
  database state and domain policies are unchanged.
- User instructions explain immutable revisions/snapshots, idempotency keys,
  async jobs, freshness/review gates and the limits of static test references.

Schemas come from shared contracts; Prisma representations are not public docs.
Nest supplies registered routes, public/account-role metadata and HTTP overrides.
Generation rejects missing, duplicate or orphan catalogue entries. Tests inspect
controller body/query declarations and actual parsed request schema identities.
OpenAPI cannot encode every custom Zod refinement or state policy; the reference
states that limit and documents relevant cross-field rules.

Scalar 1.75.1 is pinned and served as an asset. External fonts, telemetry, auth persistence
and the third-party request proxy are disabled. Scalar's Vue application is not
imported into the API process. The Zod converter is pinned to 7.3.4, the publisher's
documented compatibility version for the existing Zod 3 contracts. It is isolated
behind the docs schema adapter; this task does not migrate all contracts to Zod 4.

## Failures found and corrected

- The initial reference lacked meaningful body/response schemas and auth metadata.
- Development login had a stale 200 decorator although Nest returns 201.
- Express hides paths under `.pnpm` by default, causing the local Scalar bundle
  to return 404. Only the fixed installed asset route permits that internal path;
  no arbitrary static directory is exposed.
- Scalar's HTML serializer is ESM. The existing bounded Jest transform includes
  that serializer and its JSON helpers. Swagger Parser validation uses native
  Node 22 in a subprocess with JSON on stdin and external ref resolution disabled.
- The documentation converter does not understand ZodCatch. The docs adapter
  unwraps only the audit actor enum fallback while deriving all fields and enum
  values from the existing contract; API parsing is unchanged.

## Executed checks

| Check | Result |
| --- | --- |
| Targeted API docs E2E | 3 passed; valid OpenAPI, actual statuses/auth/query/downloads, local asset delivery |
| Docs input coverage + transport contracts + Jest transform policy | 14 passed |
| Frozen install + Prisma generation | PASS; Prisma 7.10.1 |
| Production advisory gate | PASS; one existing low KaTeX advisory, no moderate/high/critical findings |
| Peer dependencies | No issues |
| Full root suite | 210 suites, 1,171 tests and one snapshot passed |
| Full API E2E suite | 19 suites, 106 tests passed |
| Full browser suite | Five scenarios passed, including the real worker/report path and Scalar |
| Scalar browser console/network | Passed with no page/console errors and no external requests |
| Typecheck / lint | Backend and web passed; lint has existing type-import warnings and zero errors |
| Production image | PASS: Scalar page, OpenAPI (104 operations) and local JS bundle served from the compiled image |
| Complete production drill | 12 checks passed; one live real-provider analysis path explicitly skipped |

The production drill rebuilt API, worker and web, applied all 31 migrations,
verified auth/health, restarted API/worker and restored a logical backup with
pgvector and its seeded audit record intact. Evidence:
`artifacts/release/production-release-drill.json` (`PASS_WITH_SKIPS`).
Real-provider scan/analysis/export was not executed by that drill; fake-provider
quality and real-worker browser checks are separate evidence.

The final Scalar-only browser rerun also passed after the UI settings were
finalized: no external requests, console errors, page errors or external AI chat.
The API is left running locally at `http://localhost:3001/api/docs`; the live
OpenAPI endpoint returned 104 operations after the final workflow clarification.

Usage and maintenance commands are in [API reference instructions](../api/README.md).
Current API/browser suites enforce these checks in the existing CI pipeline.

Primary integration references checked:
[Scalar NestJS](https://scalar.com/products/api-references/integrations/nestjs),
[Nest OpenAPI](https://docs.nestjs.com/v11/openapi/introduction),
[Zod converter compatibility](https://github.com/asteasolutions/zod-to-openapi).
