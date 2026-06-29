# Demo Walkthrough

This walkthrough is the current demo-safe path for `BA_Helper`.

The recommended public demo story is the single-repo TypeScript/NestJS booking
flow. Multi-repo and multi-language screens are useful proof points, but they
should be framed as bounded capabilities rather than the main product story.

## Local setup

```bash
docker compose up -d postgres redis
pnpm install
pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api dev
pnpm --dir apps/worker dev
pnpm --dir apps/web dev
```

Required local env:

- `apps/api/.env`
- `apps/web/.env.local`

Use the checked-in examples:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Login

1. Open `http://localhost:3000/login`
2. Sign in with dev-login
3. Use `ADMIN` for the full demo path

## Project switching and membership

1. Open the topbar project switcher
2. Confirm the current project comes from backend workspace state
3. Open project settings and confirm member list is visible
4. If needed, add a reviewer/viewer by exact existing email

## Single-repo baseline

Use this as the primary 3-5 minute walkthrough:

1. Create or scan the TypeScript/NestJS booking fixture or equivalent public demo repository
2. Create a requirement revision:
   - "When a paid booking is cancelled, the system must refund the tenant, prevent double refunds, update booking/payment state, and notify relevant parties."
3. Create one impact analysis
4. Show impacted backend artifacts with evidence
5. Show unknowns/risks and QA scenarios
6. Review and finalize it
7. Open the approved traceability report
8. Explain drift/freshness as a snapshot safety check

## Scanner maturity explanation

- `STABLE`: strongest path; TypeScript/NestJS is the primary public demo stack
- `PARTIAL`: bounded extraction with explicit known limitations, currently Java/Spring Boot
- `EXPERIMENTAL`: deterministic pilot adapters for capability proof; do not present as production-grade language support

Unsupported patterns should appear as diagnostics, `UNKNOWN`, or `RISK`, not as fabricated impacted artifacts.

## Multi-repo happy path

Use this only after the single-repo baseline is understood.

1. Open `Impact Analyses`
2. Click `New Analysis`
3. Select one ready requirement revision
4. Select at least two repositories with ready snapshots
5. Submit the multi-repo run
6. In the success state, click `Open Run`
7. On run detail, confirm:
   - child analyses exist
   - readiness summary is visible
   - review state per child is visible
   - merged report status and blockers come from backend capabilities
8. Ensure each child analysis ends with latest review decision `ACCEPTED`
9. Open merged draft from the run
10. Finalize merged report
11. Open approved merged report
12. Export Markdown
13. Export PDF
14. Submit a merged report review decision
15. Confirm latest decision badge and history update

## Stale behavior

1. Change a child analysis review decision after merged report approval
2. Re-open approved merged report
3. Confirm:
   - stale warning is visible
   - report is still readable
   - export is blocked
   - merged report review submission is blocked until refresh/finalize
   - run detail shows backend blocker reason for stale child analysis state when applicable

## Viewer check

1. Sign in as `VIEWER`
2. Open the same project/run/report
3. Confirm:
   - read access works
   - export buttons follow backend capability rules
   - review submission stays unavailable in the UI

## Known limits to state during demo

- Pilot scanners are bounded static extractors, not full compiler-level semantic analyzers
- Unsupported route patterns and dependency boundaries require manual review
- Domain packs guide retrieval but do not create evidence
- LLM output is constrained by extracted evidence and review gates
- Multi-repo aggregates reviewed child analysis snapshots; it does not perform cross-repo dependency scanning
- Manual public demo uses Gemini real LLM when `AI_PROVIDER=google` and a Gemini API key are configured

## Deterministic demo commands

Run these separately because both reset and seed test data:

```bash
pnpm demo:golden-path
pnpm demo:multi-repo-golden-path
```
