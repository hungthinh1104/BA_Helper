# PostgreSQL Backup And Restore

## Backup

Create an encrypted, access-controlled logical backup:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > ba-helper.dump
```

Record the application commit and latest Prisma migration alongside the dump.
Redis and scanner workspaces are disposable execution state and are not backup
sources of product truth.

## Restore drill

1. Stop API and worker writers.
2. Create an empty PostgreSQL database with pgvector installed.
3. Restore with `pg_restore --clean --if-exists --no-owner --no-acl`.
4. Run `prisma migrate deploy`.
5. Start API, then worker.
6. Verify system health, one historical report, one evidence excerpt, and one
   project membership.
7. Retry only jobs whose persisted lifecycle state permits idempotent recovery.

Perform and record a restore drill before each controlled-beta release.
