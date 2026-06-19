# DB Snapshot Readiness v0

Generated at: 2026-06-19T06:22:54.923Z

Status: DB_UNAVAILABLE

DATABASE_URL present: yes
DB inspected read-only: no
DB error summary: 
Invalid `prisma.project.count()` invocation in
/home/diphungthinh/Desktop/BA_helper_test/evaluation/src/db-snapshot-readiness.ts:397:22

  394 
  395 try {
  396   const [projectCount, repositoryCount, snapshots, chunkRows, artifactRows] = await Promise.all([
→ 397     prisma.project.count(


This is not a benchmark result.
No retrieval was executed.
No vector-baseline.v0.json was created.

## Summary

- Projects: 0
- Repositories: 0
- Snapshots: 0
- Vector-ready candidates: 0
- Lexical-only candidates: 0

## Candidates

- None

## Next Inputs Needed

- Create or publish a usable RepositorySnapshot locally, then rerun this probe.
- A ready candidate needs projectId, repositoryId, and snapshotId for future research commands.

## Next Commands

- No candidate snapshot is ready enough for a concrete next command yet.

## Warnings

- This probe does not run retrieval.
- This probe does not create vector-baseline.v0.json.
