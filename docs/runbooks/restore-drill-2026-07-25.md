# PostgreSQL Restore Drill — 2026-07-25

> **Superseded by the executable drill.** `scripts/run-release-drill.ts`
> (`pnpm verify:release-drill`) now performs this backup/restore verification and
> emits machine-readable evidence to
> `artifacts/release/production-release-drill.json` (the `backup-restore` check),
> which is the authoritative source for the `restore-drill` readiness check.
> This document is retained as a human-readable narrative of the 2026-07-25 run.

## Scope

Exercise the logical backup and restore path against a temporary database
without modifying the source database.

## Procedure

1. Created a custom-format dump with `pg_dump`.
2. Restored it with `pg_restore --no-owner --no-acl` into the explicitly named
   temporary database `ba_helper_restore_drill_20260725`.
3. Compared representative persisted product data and the pgvector extension.
4. Dropped the temporary database and removed the temporary dump.

## Result

Status: **PASS**

| Check | Source | Restored |
| --- | ---: | ---: |
| Users | 4 | 4 |
| Projects | 2 | 2 |
| Repository snapshots | 2 | 2 |
| Generated documents | 2 | 2 |
| pgvector extension | present | present |

The restored database preserved representative identity, project, immutable
snapshot, document, and vector infrastructure state. The source database was
not changed by the drill.

## Cleanup

The database `ba_helper_restore_drill_20260725` and
`/tmp/ba_helper_restore_drill_20260725.dump` were removed after verification.

