-- Refuse historical analyses whose requirement and repository belong to different projects.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ImpactAnalysis" AS analysis
    JOIN "RepositorySnapshot" AS snapshot
      ON snapshot."id" = analysis."snapshotId"
    JOIN "Repository" AS repository
      ON repository."id" = snapshot."repositoryId"
    JOIN "RequirementRevision" AS revision
      ON revision."id" = analysis."requirementRevisionId"
    JOIN "Requirement" AS requirement
      ON requirement."id" = revision."requirementId"
    WHERE repository."projectId" IS DISTINCT FROM requirement."projectId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce ImpactAnalysis project provenance: a historical requirement and repository belong to different projects';
  END IF;
END
$$;

BEGIN;

LOCK TABLE "ImpactAnalysis", "Repository", "Requirement", "RequirementRevision"
  IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "ImpactAnalysis"
  ADD COLUMN "requirementId" TEXT,
  ADD COLUMN "projectId" TEXT;

UPDATE "ImpactAnalysis" AS analysis
SET "requirementId" = revision."requirementId",
    "projectId" = repository."projectId"
FROM "RepositorySnapshot" AS snapshot,
     "Repository" AS repository,
     "RequirementRevision" AS revision
WHERE snapshot."id" = analysis."snapshotId"
  AND repository."id" = snapshot."repositoryId"
  AND revision."id" = analysis."requirementRevisionId";

ALTER TABLE "ImpactAnalysis"
  ALTER COLUMN "requirementId" SET NOT NULL,
  ALTER COLUMN "projectId" SET NOT NULL,
  DROP CONSTRAINT "ImpactAnalysis_requirementRevisionId_fkey",
  ADD CONSTRAINT "ImpactAnalysis_repositoryId_projectId_fkey"
    FOREIGN KEY ("repositoryId", "projectId")
    REFERENCES "Repository"("id", "projectId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ImpactAnalysis_requirementId_projectId_fkey"
    FOREIGN KEY ("requirementId", "projectId")
    REFERENCES "Requirement"("id", "projectId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ImpactAnalysis_requirementRevisionId_requirementId_fkey"
    FOREIGN KEY ("requirementRevisionId", "requirementId")
    REFERENCES "RequirementRevision"("id", "requirementId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
