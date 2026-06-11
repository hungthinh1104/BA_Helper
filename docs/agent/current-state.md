# Current State

## Implemented MVP workflow

Repository scan -> requirement creation -> impact analysis -> review
decisions -> clarification loop -> derived analysis -> impact diff ->
lineage timeline -> approved report -> Markdown/PDF export.

## Auth and RBAC

- Dev-login exists.
- `/login` is the web sign-in route.
- Dev-login uses email + role, no password.
- Web routes are middleware-gated.
- Roles: `ADMIN`, `REVIEWER`, `VIEWER`.
- `ProjectMember` and `ProjectRole` exist.
- `ProjectPermissionService` is authoritative for project-owned resources.
- `workspace/current` returns `membershipRole`.
- `dev-single-user` membership mapping:
  - `ADMIN -> OWNER`
  - `REVIEWER -> REVIEWER`
  - `VIEWER -> VIEWER`
- Outside project membership scope returns `404`.
- Same-project insufficient role returns `403`.
- Backend RBAC is authoritative.
- Frontend disabled controls are UX only.

## Report and export

- Approved Markdown snapshot is the persisted source of truth.
- PDF is rendered on demand from the approved Markdown snapshot.
- Stale approved reports are readable but not exportable.

## Public backend endpoints

- `GET /api/v1/system/health`
- `GET /api/v1/workspace/current`
- `POST /api/v1/auth/dev-login` only when `ENABLE_DEV_LOGIN=true`

## Out of scope

- private repos
- OAuth / GitHub App
- membership management UI
- project switching
- multi-repo analysis
- DOCX
- Jira
- Confluence

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```
