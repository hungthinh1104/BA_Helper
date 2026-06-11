# BA Helper

Requirement-to-code impact analyzer for the booking/payment/refund MVP.

## Current state

- Backend, worker, and web app are implemented.
- Auth/RBAC exists with dev-login, JWT/NextAuth, route gating, and roles:
  `ADMIN`, `REVIEWER`, `VIEWER`.
- The approved Markdown report snapshot is the persisted source of truth.
- PDF is rendered on demand from the approved Markdown snapshot.
- Stale approved reports are readable but not exportable.
- Private repos, OAuth/GitHub App, membership, multi-repo, DOCX, Jira, and
  Confluence remain out of scope.

## Quick start

```bash
docker compose up -d postgres redis

PORT=3002 ENABLE_DEV_LOGIN=true WORKSPACE_MODE=dev-single-user \
  AI_PROVIDER=fake EMBEDDING_PROVIDER=fake pnpm --dir apps/api dev

WORKSPACE_MODE=dev-single-user AI_PROVIDER=fake EMBEDDING_PROVIDER=fake \
  pnpm --dir apps/worker dev

NEXT_PUBLIC_API_URL=http://localhost:3002 NEXTAUTH_SECRET=dev-super-secret-key-nextauth \
  pnpm --dir apps/web dev
```

Open `http://localhost:3000/login` to sign in with dev-login.

## Docs

- [docs/agent/architecture.md](docs/agent/architecture.md)
- [docs/agent/use-cases.md](docs/agent/use-cases.md)
- [docs/agent/api-contracts.md](docs/agent/api-contracts.md)
- [docs/agent/auth-permissions.md](docs/agent/auth-permissions.md)
