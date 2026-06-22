# BA Helper: Public Preview Deployment

This guide outlines how to securely deploy BA Helper for portfolio/demo purposes. We use an **Option A: Private Portfolio Demo** strategy.

## Architecture Shape
For a public preview, we recommend splitting the monolith cleanly:
- **Frontend (UI):** Vercel (static web deployment)
- **Backend (API):** Render, Railway, Fly.io, or VPS
- **Database:** Managed Postgres or Docker container if on VPS
- **Worker/Redis:** Optional (do not deploy unless background jobs are needed for live scanning, which is not recommended for a preview demo).

## Security Guardrails
Since BA Helper analyzes code and can consume expensive LLM tokens, deploying a fully functioning version publicly is dangerous.

The preview deployment is secured via two hard boundaries:
1. **Frontend Basic Auth Guard:** The entire Vercel deployment is protected by a HTTP Basic Auth middleware.
2. **Backend Boot Guard:** The API will crash on startup if `PUBLIC_PREVIEW_MODE=true` is set alongside real LLM credentials.

## Environment Variables Configuration

### Backend (`apps/api/.env`)
Set these explicitly in your Render/Railway dashboard:
```env
NODE_ENV=production
PUBLIC_PREVIEW_MODE=true
AI_PROVIDER=fake
WORKSPACE_MODE=dev-single-user
ENABLE_DEV_LOGIN=true
DATABASE_URL=postgres://your_managed_db_url...
CORS_ALLOWED_ORIGINS=https://your-vercel-deployment.vercel.app
```
**CRITICAL:** Ensure `GOOGLE_API_KEY`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` are **NOT** set. If they are, the backend will intentionally crash.

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

This populates the required `Booking Cancellation` project. When visitors enter the Basic Auth credentials and click the Dev Login bypass, they will immediately see the deterministic scenario.

## Proceed to Smoke Test
After deployment and seeding, follow the [Preview Smoke Test](./preview-smoke-test.md) to ensure everything is functioning correctly.
