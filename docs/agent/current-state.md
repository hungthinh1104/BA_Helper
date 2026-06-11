# Current State

## Implemented MVP workflow

Repository scan -> requirement creation -> impact analysis -> review
decisions -> clarification loop -> derived analysis -> impact diff ->
lineage timeline -> approved report -> Markdown/PDF export.

Multi-repo fan-out foundation exists for backend batch creation: one ready
requirement revision can spawn multiple normal per-repository analyses inside
the same project. Multi-repo batches now persist a parent run, expose run
detail, expose derived child review/readiness state, and are discoverable
through a project-scoped run list. Merged cross-repo report workflow now
exists as a narrow approved-artifact + decision surface:
- an on-demand merged Markdown draft exists for runs where every child analysis
  has latest review decision `ACCEPTED`
- an approved merged Markdown snapshot can now be finalized and read later
- approved merged reports now have append-only merged review decisions
  (`ACCEPTED`, `REJECTED`, `NEEDS_MORE_CLARIFICATION`)
- approved merged reports can be exported as Markdown/PDF only when non-stale
- approved merged reports become stale when child review decisions or child
  analysis provenance changes after approval

## Auth and RBAC

- Dev-login exists.
- `/login` is the web sign-in route.
- Dev-login uses email + role, no password.
- Web routes are middleware-gated.
- Roles: `ADMIN`, `REVIEWER`, `VIEWER`.
- `ProjectMember` and `ProjectRole` exist.
- `ProjectPermissionService` is authoritative for project-owned resources.
- `workspace/current` returns backend-owned current project selection plus `membershipRole`.
- `GET /api/v1/projects` returns only projects where the actor has membership.
- `POST /api/v1/workspace/select-project` persists the selected project on the user.
- OWNER-only membership management exists under `/api/v1/projects/:projectId/members`.
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
- The same stale-read / export-block policy now applies to approved merged
  multi-repo reports.

## Public backend endpoints

- `GET /api/v1/system/health`
- `GET /api/v1/workspace/current`
- `POST /api/v1/auth/dev-login` only when `ENABLE_DEV_LOGIN=true`

## Out of scope

- private repos
- OAuth / GitHub App
- merged cross-repo clarification loop / run regeneration workflow
- organizations / teams / invites
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

Demo/handoff runbooks:

- `docs/demo/walkthrough.md`
- `docs/deployment/smoke-checklist.md`
