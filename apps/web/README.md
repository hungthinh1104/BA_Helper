# BA Helper Web

Next.js frontend for the BA Helper MVP.

## Current behavior

- `/login` is the sign-in route.
- App routes are middleware-gated.
- Dev-login uses email + role, not a password.
- Backend RBAC is authoritative; disabled controls in the UI are UX only.

## Local setup

```bash
pnpm install

cp apps/web/.env.example apps/web/.env.local

NEXT_PUBLIC_API_URL=http://localhost:3002 \
NEXTAUTH_SECRET=dev-super-secret-key-nextauth \
pnpm --dir apps/web dev
```

The API should be running on `http://localhost:3002` with `ENABLE_DEV_LOGIN=true`.

## Related docs

- [docs/agent/auth-permissions.md](../../docs/agent/auth-permissions.md)
- [docs/agent/api-contracts.md](../../docs/agent/api-contracts.md)
