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
ProjectMember / ProjectRole project scoping
public repository scan only
```

Still future work:

```text
team / organization scoping
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
- selected project is backend-owned and persisted on the user
```

## Project Membership Model

Current project-scoped roles:

```text
OWNER       project/member/repository administration
MAINTAINER  repository and scan operations
ANALYST     requirements and impact analyses
REVIEWER    insight and traceability decisions
VIEWER      read-only access
```

Permissions are backend enforced and project scoped through
`ProjectPermissionService`. A frontend-hidden button is not authorization.

Current project selection and membership management:

```text
- workspace/current resolves the selected project for the actor
- GET /api/v1/projects lists only projects where the actor has membership
- POST /api/v1/workspace/select-project switches current project if the actor is a member
- OWNER manages project members by exact existing-user email
```

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

Current project-scoped enforcement baseline:

```text
OWNER:
- all project-owned permissions

MAINTAINER:
- project read
- repository manage
- scan run
- report export

ANALYST:
- project read
- requirement create
- base analysis create
- derived analysis create
- analysis finalize
- report export

REVIEWER:
- project read
- review write
- clarification write
- derived analysis create
- report export

VIEWER:
- project read
- report export only
```

Scope behavior:

```text
resource outside actor membership scope -> 404
resource in actor project but insufficient role -> 403
```

Public endpoints must be explicit:

```text
- GET /api/v1/system/health
- GET /api/v1/workspace/current
- POST /api/v1/auth/login
- POST /api/v1/auth/dev-login only when ENABLE_DEV_LOGIN=true
```

Controlled-beta account operations are backend-only `ADMIN` actions:

```text
POST /api/v1/auth/accounts
POST /api/v1/auth/accounts/:userId/reset-password
POST /api/v1/auth/accounts/:userId/disable
```

Provisioning requires an explicit initial password. Password reset and disable
increment `User.credentialsVersion`, invalidating previously issued JWTs.
Disabled accounts fail login with the same generic invalid-credentials response
as unknown accounts and wrong passwords. Administrators cannot disable their
own account through the API.

`POST /api/v1/auth/login` is the normal web sign-in path. It accepts email and
password, verifies the persisted password hash, and returns a JWT user session.
Login failures use a generic invalid-credentials response to avoid account
enumeration. Login and dev-login are throttled through the shared Redis-backed
rate limiter, so horizontally scaled API processes enforce one counter.
Password hashes are stored with Node `crypto.scrypt` using
OWASP-minimum scrypt parameters because the local package manager blocks native
Argon2 build scripts in this repo environment.

`POST /api/v1/auth/dev-login` is for local development and private controlled
demos only. It is explicitly rate-limited by the backend public-beta limiter
even though it is a public endpoint. Do not expose a hosted API publicly with
dev-login enabled.

Required auth-related env for the current MVP web experience:

```text
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
PROJECT_MEMBER_UPSERTED
AUTH_LOGIN_SUCCEEDED
AUTH_LOGIN_FAILED
ACCOUNT_PROVISIONED
ACCOUNT_PASSWORD_RESET
ACCOUNT_DISABLED
```

Events record actor identity/type, project or analysis context, timestamp, and
appropriate payload metadata without storing secrets.

`DOCUMENT_EXPORTED` is treated as authenticated read/download plus audit, not a
privileged mutation. `VIEWER` may export an approved non-stale report. Export
remains blocked when the report is stale, missing, or otherwise not exportable.

Web app routes are middleware-gated. The sign-in route is `/login`, and normal
login uses email + password. Dev-login remains a local/test fallback only.
Backend RBAC is authoritative; frontend disabled controls are UX only.
