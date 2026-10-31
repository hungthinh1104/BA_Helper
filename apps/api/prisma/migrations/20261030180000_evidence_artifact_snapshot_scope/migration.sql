-- Keep snapshot-derived Evidence attached to an artifact from the same snapshot.
-- Historical mismatches need an explicit provenance repair decision.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Evidence" AS evidence
    LEFT JOIN "CodeArtifact" AS artifact
      ON artifact."id" = evidence."artifactId"
    WHERE evidence."artifactId" IS NOT NULL
      AND (
        evidence."snapshotId" IS NULL
        OR artifact."snapshotId" IS DISTINCT FROM evidence."snapshotId"
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enforce Evidence artifact snapshot provenance: historical evidence has missing or mismatched snapshot/artifact identity';
  END IF;
END
$$;

ALTER TABLE "Evidence"
  DROP CONSTRAINT "Evidence_artifactId_fkey",
  ADD CONSTRAINT "Evidence_artifact_requires_snapshot_check"
    CHECK ("artifactId" IS NULL OR "snapshotId" IS NOT NULL),
  ADD CONSTRAINT "Evidence_artifactId_snapshotId_fkey"
    FOREIGN KEY ("artifactId", "snapshotId")
    REFERENCES "CodeArtifact"("id", "snapshotId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
