-- Bind each impact link to the snapshot shared by its analysis and artifact.
-- Refuse historical cross-snapshot links before changing the schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TraceabilityLink" AS link
    LEFT JOIN "ImpactAnalysis" AS analysis
      ON analysis."id" = link."impactAnalysisId"
    LEFT JOIN "CodeArtifact" AS artifact
      ON artifact."id" = link."artifactId"
    WHERE analysis."snapshotId" IS DISTINCT FROM artifact."snapshotId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce TraceabilityLink snapshot provenance: historical links connect an analysis and artifact from different snapshots';
  END IF;
END
$$;

BEGIN;

CREATE UNIQUE INDEX "ImpactAnalysis_id_snapshotId_key"
  ON "ImpactAnalysis"("id", "snapshotId");

ALTER TABLE "TraceabilityLink"
  ADD COLUMN "snapshotId" TEXT;

UPDATE "TraceabilityLink" AS link
SET "snapshotId" = analysis."snapshotId"
FROM "ImpactAnalysis" AS analysis
WHERE analysis."id" = link."impactAnalysisId";

ALTER TABLE "TraceabilityLink"
  ALTER COLUMN "snapshotId" SET NOT NULL,
  DROP CONSTRAINT "TraceabilityLink_impactAnalysisId_fkey",
  DROP CONSTRAINT "TraceabilityLink_artifactId_fkey",
  ADD CONSTRAINT "TraceabilityLink_impactAnalysisId_snapshotId_fkey"
    FOREIGN KEY ("impactAnalysisId", "snapshotId")
    REFERENCES "ImpactAnalysis"("id", "snapshotId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "TraceabilityLink_artifactId_snapshotId_fkey"
    FOREIGN KEY ("artifactId", "snapshotId")
    REFERENCES "CodeArtifact"("id", "snapshotId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "TraceabilityLink_snapshotId_idx" ON "TraceabilityLink"("snapshotId");

COMMIT;
