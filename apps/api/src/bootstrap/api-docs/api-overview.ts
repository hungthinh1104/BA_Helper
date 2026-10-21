export const apiOverview = `
## Requirement-to-code impact analysis

Requirement change → impacted code → source evidence → unknowns, risks and QA
scenarios → human review → immutable, approved report.

The MVP targets Booking / Payment / Refund in NestJS repository snapshots.
Domain hints and AI suggestions are not source evidence. Missing support stays
unknown or becomes a clarification question.

## Start here

1. Sign in with POST /api/v1/auth/login. Copy accessToken into Scalar's
   Bearer authentication field. Development login is separately gated by runtime policy.
2. List/select your project under Workspace & projects. Protected resources require
   authentication and project membership. Out-of-scope resources return 404;
   an insufficient role within your project returns 403.
3. Connect a public repository and create a scan job. Poll its status; use the
   returned result.snapshotId and result.sourceTargetId when available.
4. Create a requirement revision and inspect its readiness before starting an
   impact analysis. Explicitly acknowledge a PARTIAL snapshot when applicable.
5. Review persisted evidence, impacts and unknowns. Use backend capabilities
   such as canReview and canFinalize; progress alone does not authorize actions.
6. Finalize explicitly. Finalization automatically persists a reviewed report
   snapshot and document job, then attempts to enqueue rendering. Poll the
   final-reviewed-report view and export when backend capabilities allow it.
   Use the document-jobs endpoint to reuse or retry an eligible job if needed.
   Historical content may be completed and stale at once.

## Request and response conventions

- IDs are opaque strings unless a request schema specifies UUID validation.
- Dates are JSON strings; enums, nullable fields, defaults and bounds come from
  shared Zod contracts. Additional domain checks and cross-field refinements are
  enforced by the API even when OpenAPI cannot express them.
- Invalid request bodies and queries return HTTP 400 with a generic message;
  rejected values and detailed Zod issues are not echoed in the response.
- Reuse the same requestKey for a retry of the same scan/analysis command.
  A deliberate rerun uses a new key. Reusing a key with different input is rejected.
- POST normally returns **201**. Normal login and saving a review note return
  **200**. Queue creation acknowledges submission, not successful completion.
- Paginated lists expose limit and offset only where documented. Not every
  list is paginated; do not infer a total count or cursor from items.
- Application errors have code, message and optional details.
  HTTP/framework errors use statusCode, message and optional error.
  Treat stable application codes as machine-readable; do not parse message text.
- Rate-limited actions may return **429**; an unavailable distributed limiter
  may return **503**. A response's x-request-id correlates server logs.
- Static QA traces show source references. They do **not** prove test execution,
  pass/fail, assertion coverage, or runtime behavior. Paths may include mocks.

## Use this reference

Requests go directly to the current API origin; no third-party proxy is used.
Authentication tokens are not persisted by this reference. The downloadable
OpenAPI document is available at /api/openapi.json.
`;
