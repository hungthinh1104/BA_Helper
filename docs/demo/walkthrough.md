# Demo Walkthrough

This walkthrough is the current demo-safe path for `BA_Helper`.

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

1. Create or scan a repository
2. Create a requirement revision
3. Create one impact analysis
4. Review and finalize it
5. Open the approved report

## Multi-repo happy path

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

## Viewer check

1. Sign in as `VIEWER`
2. Open the same project/run/report
3. Confirm:
   - read access works
   - export buttons follow backend capability rules
   - review submission stays unavailable in the UI
