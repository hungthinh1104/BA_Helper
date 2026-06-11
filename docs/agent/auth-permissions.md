# Auth And Permissions

## Delivery Decision

The backend engine comes first. The MVP currently runs in documented
`dev-single-user` mode and now also has web auth gating with dev-login.

Auth must not be ignored permanently: requirements, reports, review decisions,
and future private repository data are sensitive.

## Roadmap Boundary

Current MVP auth boundary:

```text
dev-single-user workspace mode
dev-login web sign-in
ADMIN / REVIEWER / VIEWER backend-enforced RBAC
public repository scan only
```

Still future work:

```text
project membership and team-scoped access
private repos
GitHub App / OAuth
encrypted credential handling beyond the current MVP
```

## Deploy Bootstrap Boundary

Deployed MVP environments still run in `dev-single-user` mode. This is a
deployment/runtime boundary only, not a fake auth system:

```text
- backend owns workspace/current resolution
- frontend consumes workspace/current + system/health
- separate web/API deploy uses explicit NEXT_PUBLIC_API_URL + CORS allowlist
```

Auth-readiness in this phase means new workspace modes can be introduced behind
the resolver boundary later. Login/session/permissions are implemented now for
the web app.

Current web boundary:

```text
- /welcome and /login are public web routes
- /(app) routes require authentication at middleware level
- backend public bootstrap endpoints remain public for deploy/runtime checks
```

## Future Role Model

If the product later grows into team-scoped workspace membership:

```text
OWNER       project/member/repository administration
MAINTAINER  repository and scan operations
ANALYST     requirements and impact analyses
REVIEWER    insight and traceability decisions
VIEWER      read-only access
```

Permissions are backend enforced and project scoped. A frontend-hidden button
is not authorization.

## Current MVP RBAC Matrix

Current shipped roles:

```text
ADMIN
REVIEWER
VIEWER
```

Current enforcement baseline:

```text
ADMIN only:
- create projects
- connect repositories
- queue scan jobs
- create requirements / revisions / qualification
- start analyses
- finalize analyses
- convert clarification answers into requirement revisions

ADMIN and REVIEWER:
- review insights
- review traceability links
- submit review decisions
- create and answer review clarifications
- create derived analyses from review clarifications
- create, answer, dismiss analysis clarifications
- save review notes

VIEWER:
- read-only GET access
- no mutating endpoints
```

Public endpoints must be explicit:

```text
- GET /api/v1/system/health
- GET /api/v1/workspace/current
- POST /api/v1/auth/dev-login only when ENABLE_DEV_LOGIN=true
```

Required auth-related env for the current MVP web experience:

```text
ENABLE_DEV_LOGIN=true on the API to allow dev sign-in
NEXT_PUBLIC_API_URL pointing at the API origin
NEXTAUTH_SECRET configured for stable session signing
JWT_SECRET configured for API auth tokens
WORKSPACE_MODE=dev-single-user for the MVP runtime
```

## Audit Requirements

Persist domain events for security- or business-significant actions:

```text
PROJECT_CREATED
REPOSITORY_ADDED
SCAN_STARTED
SCAN_COMPLETED
SCAN_FAILED
REPOSITORY_TARGET_OBSERVED
REQUIREMENT_CREATED
ANALYSIS_STARTED
ANALYSIS_FAILED
INSIGHT_CONFIRMED
INSIGHT_REJECTED
TRACEABILITY_LINK_CONFIRMED
TRACEABILITY_LINK_REJECTED
ANALYSIS_FINALIZED
DOCUMENT_EXPORTED
```

Events record actor identity/type, project or analysis context, timestamp, and
appropriate payload metadata without storing secrets.

`DOCUMENT_EXPORTED` is treated as authenticated read/download plus audit, not a
privileged mutation. `VIEWER` may export an approved non-stale report. Export
remains blocked when the report is stale, missing, or otherwise not exportable.

Web app routes are middleware-gated. The sign-in route is `/login`, and dev
login uses email + role without a password. Backend RBAC is authoritative;
frontend disabled controls are UX only.
