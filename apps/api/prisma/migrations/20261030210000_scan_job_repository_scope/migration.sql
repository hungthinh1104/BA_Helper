-- Reject ambiguous historical scan identity before changing any schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ScanJob" AS job
    LEFT JOIN "RepositoryTarget" AS target
      ON target."id" = job."sourceTargetId"
    WHERE job."sourceTargetId" IS NOT NULL
      AND target."repositoryId" IS DISTINCT FROM job."repositoryId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce ScanJob repository provenance: a historical source target belongs to another repository';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ScanJob" AS job
    LEFT JOIN "RepositorySnapshot" AS snapshot
      ON snapshot."id" = job."snapshotId"
    WHERE job."snapshotId" IS NOT NULL
      AND snapshot."repositoryId" IS DISTINCT FROM job."repositoryId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce ScanJob repository provenance: a historical snapshot belongs to another repository';
  END IF;
END
$$;

BEGIN;

LOCK TABLE "ScanJob", "RepositoryTarget", "RepositorySnapshot"
  IN SHARE ROW EXCLUSIVE MODE;

CREATE UNIQUE INDEX "RepositoryTarget_id_repositoryId_key"
  ON "RepositoryTarget"("id", "repositoryId");

CREATE UNIQUE INDEX "RepositorySnapshot_id_repositoryId_key"
  ON "RepositorySnapshot"("id", "repositoryId");

ALTER TABLE "ScanJob"
  DROP CONSTRAINT "ScanJob_sourceTargetId_fkey",
  DROP CONSTRAINT "ScanJob_snapshotId_fkey",
  ADD CONSTRAINT "ScanJob_sourceTargetId_repositoryId_fkey"
    FOREIGN KEY ("sourceTargetId", "repositoryId")
    REFERENCES "RepositoryTarget"("id", "repositoryId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ScanJob_snapshotId_repositoryId_fkey"
    FOREIGN KEY ("snapshotId", "repositoryId")
    REFERENCES "RepositorySnapshot"("id", "repositoryId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
