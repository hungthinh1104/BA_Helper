# ADR 0009: Deploy Workspace Bootstrap Boundary

## Status

Accepted

> Superseding note: dev-login, middleware-gated web routes, and ADMIN/REVIEWER/VIEWER RBAC now exist. This ADR remains a historical record for the deploy-safe workspace bootstrap boundary; project membership and private repository auth are still future work.

## Context

The MVP web client must bootstrap a project-scoped workspace before repository,
requirement, scan, and analysis screens can operate. The original development
path used a frontend-created default project and permissive API defaults, which
was acceptable for local iteration but too implicit for separate web/API
deployment.

At this stage the product still does **not** implement auth, sessions, or
project membership. However, the FE/BE connection path must be deploy-safe and
must prepare a clean boundary for future auth.

## Decision

1. The deployed MVP continues to use `WORKSPACE_MODE=dev-single-user` as the
   only live workspace mode.
2. The frontend bootstraps only through backend-owned contracts:
   `GET /api/v1/workspace/current` and `GET /api/v1/system/ready`.
3. Workspace resolution is routed through a resolver abstraction so later auth
   can introduce new modes without rewriting the web bootstrap flow.
4. Separate web/API deployment is the supported topology:
   - web uses `NEXT_PUBLIC_API_URL`
   - API uses explicit `CORS_ALLOWED_ORIGINS`
   - production-like deploys fail fast when CORS allowlists are not configured
5. Operator visibility is limited to topbar + settings. This phase does not add
   a dedicated diagnostics dashboard.

## Consequences

- The deploy path is explicit and debuggable without pretending auth exists.
- The frontend no longer invents workspace identity.
- Future auth work can plug into the resolver/config boundary instead of
  replacing ad hoc bootstrap logic spread across screens.
- The system remains single-workspace in production until a later auth phase
  introduces user/session-backed workspace resolution.
