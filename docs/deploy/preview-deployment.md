# BA Helper: Public Preview Deployment

This guide outlines the current safe preview boundary for portfolio/demo
purposes. BA Helper is not ready for an unauthenticated public production
deployment. Until a real hosted auth flow exists, use a private preview only.

## Architecture Shape
For a private preview, we recommend splitting the monolith cleanly:
- **Frontend (UI):** Vercel (static web deployment)
- **Backend (API):** Render, Railway, Fly.io, or VPS
- **Database:** Managed Postgres or Docker container if on VPS
- **Worker/Redis:** Optional (do not deploy unless background jobs are needed for live scanning, which is not recommended for a preview demo).

## Security Guardrails
Since BA Helper analyzes code and can consume expensive LLM tokens, deploying a
fully functioning version publicly is dangerous.

The preview deployment is secured via these hard boundaries:

1. **Do not expose the API publicly with dev-login enabled.** If the API is
   reachable from the internet, put it behind provider-level private networking,
   VPN, IP allowlisting, or equivalent access control.
2. **Frontend Basic Auth Guard:** The Vercel deployment can be protected by HTTP
   Basic Auth, but this does not protect a separately hosted public API.
3. **Backend Boot Guard:** Production/staging rejects `ENABLE_DEV_LOGIN=true`,
   and public preview mode rejects real LLM credentials.
4. **Current release mode:** use a private/internal demo environment, not a
   public SaaS deployment.

## Environment Variables Configuration

### Backend (`apps/api/.env`)
For a private controlled demo with dev-login, keep the API private and use a
development-mode backend. This is not a production SaaS configuration:

```env
NODE_ENV=development
PUBLIC_PREVIEW_MODE=false
AI_PROVIDER=fake
WORKSPACE_MODE=dev-single-user
ENABLE_DEV_LOGIN=true
DATABASE_URL=postgres://your_managed_db_url...
CORS_ALLOWED_ORIGINS=https://your-vercel-deployment.vercel.app
```

Do not use the old invalid combination below. The backend intentionally rejects
it:

```env
NODE_ENV=production
PUBLIC_PREVIEW_MODE=true
AI_PROVIDER=fake
ENABLE_DEV_LOGIN=true
```

For a production-like deployment, `ENABLE_DEV_LOGIN` must be disabled and a real
hosted auth flow is required before users can enter the workspace.

### Frontend (`apps/web/.env.local`)
Set these explicitly in your Vercel project settings:
```env
NEXT_PUBLIC_API_URL=https://your-render-backend-url.onrender.com
INTERNAL_API_URL=https://your-render-backend-url.onrender.com
NEXTAUTH_SECRET=your-random-secret
PREVIEW_AUTH_ENABLED=true
PREVIEW_USERNAME=demo
PREVIEW_PASSWORD=your_secure_password
```

## Seeding the Data
Once the database and API are deployed, you must seed the demo data.
From your local machine (or CI pipeline), run the seed script against the remote database:

```bash
DATABASE_URL=postgres://your_managed_db_url... pnpm --dir apps/api exec prisma migrate deploy
DATABASE_URL=postgres://your_managed_db_url... pnpm db:seed:demo
```

This populates the required `Booking Cancellation` project. In the private demo
mode above, an operator behind the private access boundary can use dev-login to
enter the deterministic scenario.

## Proceed to Smoke Test
After deployment and seeding, follow the [Preview Smoke Test](./preview-smoke-test.md) to ensure everything is functioning correctly.
