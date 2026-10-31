-- Fail closed when historical analyses combine a snapshot and target from different repositories.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ImpactAnalysis" AS analysis
    JOIN "RepositorySnapshot" AS snapshot
      ON snapshot."id" = analysis."snapshotId"
    JOIN "RepositoryTarget" AS target
      ON target."id" = analysis."sourceTargetId"
    WHERE snapshot."repositoryId" IS DISTINCT FROM target."repositoryId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce ImpactAnalysis repository provenance: a historical source target belongs to another snapshot repository';
  END IF;
END
$$;

BEGIN;

LOCK TABLE "ImpactAnalysis", "RepositorySnapshot", "RepositoryTarget"
  IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "ImpactAnalysis"
  ADD COLUMN "repositoryId" TEXT;

UPDATE "ImpactAnalysis" AS analysis
SET "repositoryId" = snapshot."repositoryId"
FROM "RepositorySnapshot" AS snapshot
WHERE snapshot."id" = analysis."snapshotId";

ALTER TABLE "ImpactAnalysis"
  ALTER COLUMN "repositoryId" SET NOT NULL,
  DROP CONSTRAINT "ImpactAnalysis_snapshotId_fkey",
  DROP CONSTRAINT "ImpactAnalysis_sourceTargetId_fkey",
  ADD CONSTRAINT "ImpactAnalysis_snapshotId_repositoryId_fkey"
    FOREIGN KEY ("snapshotId", "repositoryId")
    REFERENCES "RepositorySnapshot"("id", "repositoryId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ImpactAnalysis_sourceTargetId_repositoryId_fkey"
    FOREIGN KEY ("sourceTargetId", "repositoryId")
    REFERENCES "RepositoryTarget"("id", "repositoryId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
