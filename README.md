# BA Helper

Project-facing name: `requirement-impact-analyzer`.
Requirement-to-code impact analyzer for the booking/payment/refund MVP.

## Current state

- Backend, worker, and web app are implemented.
- Auth/RBAC exists with dev-login, JWT/NextAuth, route gating, and roles:
  `ADMIN`, `REVIEWER`, `VIEWER`.
- Project membership, selected-project switching, and OWNER-managed member
  administration are implemented.
- Multi-repo workflow is implemented through fan-out, run tracking, readiness,
  merged draft, approved merged report, export, and merged report review
  decisions.
- The approved Markdown report snapshot is the persisted source of truth.
- PDF is rendered on demand from the approved Markdown snapshot.
- Stale approved reports are readable but not exportable.
- Private repos, OAuth/GitHub App, merged clarification loop, DOCX, Jira, and
  Confluence remain out of scope.

## Quick start

```bash
docker compose up -d postgres redis

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

PORT=3001 ENABLE_DEV_LOGIN=true WORKSPACE_MODE=dev-single-user \
  AI_PROVIDER=fake EMBEDDING_PROVIDER=fake pnpm --dir apps/api dev

WORKSPACE_MODE=dev-single-user AI_PROVIDER=fake EMBEDDING_PROVIDER=fake \
  pnpm --dir apps/worker dev

NEXT_PUBLIC_API_URL=http://localhost:3001 NEXTAUTH_SECRET=replace-with-a-long-random-secret-32-chars-min \
  pnpm --dir apps/web dev
```

Open `http://localhost:3000/login` to sign in with dev-login.

## Demo path

- [docs/demo/walkthrough.md](docs/demo/walkthrough.md)
- [docs/deployment/smoke-checklist.md](docs/deployment/smoke-checklist.md)

## Docs

- [docs/agent/CONTEXT_INDEX.md](docs/agent/CONTEXT_INDEX.md)
- [docs/agent/architecture.md](docs/agent/architecture.md)
- [docs/agent/use-cases.md](docs/agent/use-cases.md)
- [docs/agent/api-contracts.md](docs/agent/api-contracts.md)
- [docs/agent/auth-permissions.md](docs/agent/auth-permissions.md)
