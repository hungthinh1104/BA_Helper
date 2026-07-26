# Smoke Checklist

Use this checklist before a demo, handoff, or release candidate tag.

## Services

- `docker compose up -d postgres redis`
- API process is up
- worker process is up
- web process is up

## Health and bootstrap

- `GET /api/v1/system/ready` returns dependency up/down status (and `GET /api/v1/system/live` returns `ok`)
- `GET /api/v1/workspace/current` succeeds
- `/login` loads
- password login succeeds for a provisioned user
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
- run detail shows backend-authored merged report status, capabilities, and blocker reasons
- merged draft loads when all child latest decisions are `ACCEPTED`
- merged finalize succeeds
- approved merged report loads
- approved merged report shows backend-authored current/stale state and export/review capabilities
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
- `pnpm demo:multi-repo-golden-path`
- `pnpm --dir apps/api smoke:public-github:real-llm` (explicit manual run)
- `pnpm --dir apps/api smoke:public-github:real-path` (explicit manual run)

For local release-candidate verification with Docker available, run:

```bash
pnpm verify:stability
```

Run full Jest, golden-path demos, and public smoke commands separately when
they share the same database/schema. They reset and seed test data and can
produce false failures if run concurrently.

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
