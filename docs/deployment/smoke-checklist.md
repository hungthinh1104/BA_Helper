# Smoke Checklist

Use this checklist before a demo, handoff, or release candidate tag.

## Services

- `docker compose up -d postgres redis`
- API process is up
- worker process is up
- web process is up

## Health and bootstrap

- `GET /api/v1/system/health` returns `ok` or expected degraded details
- `GET /api/v1/workspace/current` succeeds
- `/login` loads
- dev-login succeeds
- protected app routes redirect correctly when signed out

## Runtime wiring

- API uses the expected `PORT`
- web points to the correct `NEXT_PUBLIC_API_URL`
- CORS works for the web origin
- Prisma migrations are applied
- Redis/BullMQ queue connectivity is healthy

## Single-repo path

- repository creation succeeds
- scan job reaches `COMPLETED` or expected `PARTIAL`
- requirement creation succeeds
- impact analysis reaches reviewable/completed state
- approved report is readable
- Markdown/PDF export works for non-stale approved report

## Multi-repo path

- multi-repo create succeeds
- run detail loads
- run list loads
- merged draft loads when all child latest decisions are `ACCEPTED`
- merged finalize succeeds
- approved merged report loads
- merged Markdown export works when non-stale
- merged PDF export works when non-stale
- merged report review decision create/list/latest works

## Stale behavior

- stale approved single-analysis report remains readable
- stale approved single-analysis report export is blocked
- stale approved merged report remains readable
- stale approved merged report export is blocked
- stale approved merged report review submission is blocked

## Permission spot checks

- outsider project access returns `404`
- same-project insufficient role returns `403` where policy requires it
- viewer cannot submit merged report review decisions

## Test hygiene

- `pnpm typecheck`
- `pnpm run test:analyzer`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e`
- `pnpm demo:golden-path`
- `pnpm --dir apps/api smoke:public-github:real-llm` (explicit manual run)
- `pnpm --dir apps/api smoke:public-github:real-path` (explicit manual run)

## Public demo story

- TypeScript/NestJS is the primary demo stack
- multi-language adapters are framed as bounded capability proof
- `STABLE`, `PARTIAL`, and `EXPERIMENTAL` scanner maturity is explained
- unsupported patterns are shown as diagnostics, `UNKNOWN`, or `RISK`
- report finalization is described as a human review action

## Known baseline note

- If Jest still reports an open-handle warning, run:

```bash
pnpm exec jest --config jest.config.ts --runInBand --detectOpenHandles
pnpm exec jest --config jest.e2e.config.ts --runInBand --detectOpenHandles
```

The current low-risk known cause was the PDF export timeout timer; verify this
does not regress.
