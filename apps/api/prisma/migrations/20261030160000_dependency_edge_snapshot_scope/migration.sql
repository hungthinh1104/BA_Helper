-- Prevent dependency edges from connecting artifacts outside their snapshot.
-- Preserve existing rows and stop safely if historical data needs review.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "DependencyEdge" AS edge
    LEFT JOIN "CodeArtifact" AS source
      ON source."id" = edge."fromArtifactId"
    LEFT JOIN "CodeArtifact" AS target
      ON target."id" = edge."toArtifactId"
    WHERE source."id" IS NULL
      OR target."id" IS NULL
      OR source."snapshotId" IS DISTINCT FROM edge."snapshotId"
      OR target."snapshotId" IS DISTINCT FROM edge."snapshotId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce DependencyEdge snapshot provenance: an endpoint belongs to another snapshot';
  END IF;
END
$$;

ALTER TABLE "DependencyEdge"
  DROP CONSTRAINT "DependencyEdge_fromArtifactId_fkey",
  DROP CONSTRAINT "DependencyEdge_toArtifactId_fkey",
  ADD CONSTRAINT "DependencyEdge_fromArtifactId_snapshotId_fkey"
    FOREIGN KEY ("fromArtifactId", "snapshotId")
    REFERENCES "CodeArtifact"("id", "snapshotId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "DependencyEdge_toArtifactId_snapshotId_fkey"
    FOREIGN KEY ("toArtifactId", "snapshotId")
    REFERENCES "CodeArtifact"("id", "snapshotId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
