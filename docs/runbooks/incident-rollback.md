# Incident And Rollback Runbook

## Triage

1. Capture deployment commit, request/job IDs, snapshot ID, analysis ID, and
   report ID. Never copy credentials, requirement bodies, prompts, or evidence
   excerpts into incident chat.
2. Check `/api/v1/system/ready`, API logs, worker logs, PostgreSQL, and Redis.
3. Stop new scan/analysis intake if persisted truth may be at risk.

## Recovery

- Transient provider/Redis failure: restore dependency, then retry the retained
  failed BullMQ job through the ADMIN recovery endpoint.
- Bad analyzer output: stop intake and roll back application images. Do not
  delete published snapshots; create a new analyzer version for corrected
  extraction.
- Bad database migration: stop writers and restore the pre-deploy backup.
  Never run destructive ad-hoc SQL against the only production copy.

## Application rollback

Deploy the previous saved image/commit using the same production compose path.
Database rollback is allowed only when the previous application is compatible
with the migrated schema; otherwise restore the pre-deploy backup. Verify
health, login, historical report access, and one idempotent job recovery before
reopening intake.
