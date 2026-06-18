# Public GitHub Smoke Demo

## Purpose

This smoke run proves the real public-repository lifecycle:

```text
workspace bootstrap
-> connect public GitHub repo
-> queue scan
-> wait for published snapshot
-> create requirement revision
-> run impact analysis
-> review at least one insight
-> finalize analysis
-> fetch approved Markdown report
```

It is an operator/demo command, not a CI gate.

CI stays on fake providers. Real Gemini smoke is explicit and manual.

## Pinned Demo Scenario

```text
Repository: https://github.com/ndmen/booking
Ref:        main
Requirement: Allow users to cancel paid bookings and receive refund.
```

This repo is public, NestJS-based, small enough for current ingestion limits,
and closer to the MVP booking domain than a generic starter.

## Required Services

The smoke script assumes these are already running:

```text
API
Worker
PostgreSQL
Redis
```

Required environment:

```env
AI_PROVIDER=google
GEMINI_API_KEY=<your-gemini-key>
AI_MAX_TOKENS=8192
EMBEDDING_DEFAULT_PROFILE=fake-1536
EMBEDDING_INDEX_PROFILE=fake-1536
EMBEDDING_QUERY_PROFILE=fake-1536
EMBEDDING_PROVIDER=fake
GOOGLE_EMBEDDING_MODEL=gemini-embedding-001
DATABASE_URL=postgresql://ba_helper:ba_helper@localhost:5432/ba_helper
REDIS_URL=redis://localhost:6379
ENABLE_DEV_LOGIN=true
SMOKE_ALLOW_DEV_LOGIN_FALLBACK=false
```

## Command

From repo root:

```bash
docker compose up -d --build migrate api worker
pnpm smoke:public-github
```

Or directly:

```bash
pnpm --dir apps/api dev
pnpm --dir apps/worker dev
pnpm --dir apps/api smoke:public-github
```

For the real LLM assertion path, use:

```bash
pnpm --dir apps/api smoke:public-github:real-llm
```

For the full real path with Google embeddings:

```bash
AI_PROVIDER=google EMBEDDING_DEFAULT_PROFILE=google-gemini-001-1536 EMBEDDING_INDEX_PROFILE=google-gemini-001-1536 EMBEDDING_QUERY_PROFILE=google-gemini-001-1536 EMBEDDING_PROVIDER=google pnpm --dir apps/api smoke:public-github:real-path
```

## Success Markers

The script prints machine-readable JSON with:

```text
status = ok
workspace mode
repository id
scan job id
snapshot id
commit sha
coverage status
analysis id
insight count
approved report id
temp workspace cleanup result
```

The most recent successful local runtime output is captured in:

```text
docs/runbooks/public-github-smoke-last-known-good.json
```

Transient smoke outputs and failures are written to:

```text
docs/runbooks/diagnostics/
```

Minimum acceptable behavior:

```text
GET /api/v1/system/health succeeds with:
  database=up
  redis=up
  queue=up
  pgvector=up
GET /api/v1/workspace/current succeeds
scan reaches COMPLETED
snapshot coverage is READY or PARTIAL
no blocker-level security diagnostics exist
analysis reaches WAITING_FOR_REVIEW or COMPLETED
at least one insight exists
finalization succeeds
approved report is returned
```

## Expected Failure Classes

Typical failure causes:

```text
API health down
auth/bootstrap failure
unsupported workspace mode
public repo drifted away from supported NestJS shape
scan job stays QUEUED too long -> WORKER_NOT_PROCESSING
scan timed out or failed before publishing snapshotId
embedding/vector readiness failure
analysis job stays QUEUED too long -> WORKER_NOT_PROCESSING
analysis AI parse/schema failure
report finalization/fetch failed
temp workspace cleanup leak detected
```

For real embedding runs, a repeated `429 Too Many Requests` / quota response
should now surface as `EMBEDDING_RATE_LIMITED` after bounded retries. Query
embedding reuse is query-only and keyed by embedding profile/config plus hashed
text; it does not change artifact indexing semantics.

## Diagnostics Triage

If the smoke run fails:

1. Check `GET /api/v1/system/health`.
   A status of `degraded` means the API process is alive but one or more
   dependencies are unavailable.
2. Check `GET /api/v1/workspace/current`.
3. Inspect repository detail UI for scan diagnostics.
4. Inspect scan job error code and snapshot diagnostics.
5. Confirm worker is running and consuming jobs.

If the public repo becomes unsupported or drifts too far from the MVP
assumptions, pin a new small public NestJS repository and update the smoke
manifest, not the core product contracts.

## How to Demo the Review Queue

After running `REAL_PATH_SMOKE=true tsx src/smoke-e2e.ts`, you can test the **Review Queue** UI workflow:

1. Open the UI using the direct `analysisUrl` provided in the smoke test JSON output.
2. Select the **Review Queue** tab.
3. Observe the deterministic priority ordering: High-Risk QA Gaps, Unknown rules, and then Insights grouped by confidence (Strong, Moderate, Low).
4. Verify that the "Finalize Analysis" button (and the success banner above the tabs) explicitly disables finalization while `blockingRemaining > 0`.
5. Use the **Skip for now** action on an item to observe local queue navigation without changing the backend state.
6. Use **Confirm** and **Reject** on blocking items.
7. Observe that when all blocking items are cleared (`blockingRemaining === 0`), the "Cannot finalize" banner changes to a green success banner, unlocking the "Finalize Analysis" button.
