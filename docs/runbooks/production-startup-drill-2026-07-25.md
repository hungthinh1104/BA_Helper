# Production Startup Drill — 2026-07-25

> **Superseded by the executable drill.** `scripts/run-release-drill.ts`
> (`pnpm verify:release-drill`) now performs this startup verification and emits
> machine-readable evidence to `artifacts/release/production-release-drill.json`,
> which is the authoritative source for the `production-startup` readiness check.
> This document is retained as a human-readable narrative of the 2026-07-25 run.

## Scope

Verify that the controlled-beta production artifacts build and start from the
repository's documented Docker path. This drill used the existing local
PostgreSQL and Redis services and isolated verification ports.

## Result

Status: **PASS**

- `apps/api/Dockerfile` built `ba-helper-api:phase3-verify`.
- `apps/worker/Dockerfile` built `ba-helper-worker:phase3-verify`.
- `apps/web/Dockerfile` built `ba-helper-web:phase3-verify`.
- API started with `NODE_ENV=production`, dev login disabled, and real-provider
  adapter selection. Placeholder provider credentials were used only to verify
  boot; the drill made no external provider request.
- Worker stayed running with the production configuration.
- Web started on port `3100`; `GET /login` returned HTTP 200.
- `GET /api/v1/system/health` returned `status=ok`; database, pgvector, queue,
  and Redis all reported `up`.

The production boot guard correctly rejected the default
`redis://localhost:6379` value before the successful run. The successful drill
used an explicit Redis database URL and confirms that weak defaults fail closed.

## Cleanup

The three explicitly named verification containers were removed after the
checks. Existing development API, worker, PostgreSQL, and Redis containers were
left running and unchanged.

