# Controlled Beta Operator Runbook

## Supported path

The only `STABLE` product path is a public GitHub repository containing
TypeScript/NestJS. Private repositories, GitHub App installation, hosted
multi-tenancy, billing, and non-NestJS scanners are not supported beta paths.

## Deploy

1. Copy `.env.production.example` to `.env.production` and replace every
   placeholder with a secret or deployment-specific origin.
2. Provision PostgreSQL with pgvector and Redis. Verify both are reachable from
   API and worker.
3. Run:

   ```bash
   docker compose --env-file .env.production \
     -f docker-compose.yml \
     -f docker-compose.production.yml \
     up -d --build
   ```

4. Confirm the migrate service exits successfully.
5. Confirm `/api/v1/system/health` reports database, pgvector, Redis, and queues
   as `up`.
6. Provision the first local-password account through the authenticated
   operator bootstrap process. Never enable dev-login in production.

## Seed/demo path

The demo seed is local-only:

```bash
pnpm db:seed:demo
```

Do not run demo seeding against controlled-beta production data.

## Account operations

An authenticated global `ADMIN` can provision, reset, or disable accounts:

```text
POST /api/v1/auth/accounts
POST /api/v1/auth/accounts/:userId/reset-password
POST /api/v1/auth/accounts/:userId/disable
```

Reset and disable revoke existing JWTs. Login and account events are persisted
without password values.

## Failed job recovery

Each queue retries three times with exponential backoff. Exhausted jobs remain
in BullMQ's failed set. After fixing the external cause, an `ADMIN` retries one
failed job through:

```text
POST /api/v1/system/queues/:queueName/failed/:jobId/retry
```

Allowed queues are `scan-job`, `embedding`, `impact-analysis`, and
`document-job`. Application idempotency constraints remain the source of truth
for duplicate delivery.
