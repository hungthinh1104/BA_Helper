-- Bind each multi-repo run to a requirement revision owned by the same project.
-- Preserve valid legacy rows and refuse ambiguous historical lineage.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "MultiRepoAnalysisRun" AS run
    LEFT JOIN "RequirementRevision" AS revision
      ON revision."id" = run."requirementRevisionId"
    LEFT JOIN "Requirement" AS requirement
      ON requirement."id" = revision."requirementId"
    WHERE requirement."projectId" IS DISTINCT FROM run."projectId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce multi-repo project/revision provenance: a historical run project differs from the project owning its requirement revision';
  END IF;
END
$$;

-- Lock writers after preflight. The validated foreign keys still reject any
-- invalid row committed between the preflight and this lock.
BEGIN;

LOCK TABLE "MultiRepoAnalysisRun", "RequirementRevision", "Requirement"
  IN SHARE ROW EXCLUSIVE MODE;

CREATE UNIQUE INDEX "Requirement_id_projectId_key"
  ON "Requirement"("id", "projectId");

CREATE UNIQUE INDEX "RequirementRevision_id_requirementId_key"
  ON "RequirementRevision"("id", "requirementId");

ALTER TABLE "MultiRepoAnalysisRun"
  ADD COLUMN "requirementId" TEXT;

UPDATE "MultiRepoAnalysisRun" AS run
SET "requirementId" = revision."requirementId"
FROM "RequirementRevision" AS revision
WHERE revision."id" = run."requirementRevisionId";

ALTER TABLE "MultiRepoAnalysisRun"
  ALTER COLUMN "requirementId" SET NOT NULL,
  DROP CONSTRAINT "MultiRepoAnalysisRun_requirementRevisionId_fkey",
  ADD CONSTRAINT "MultiRepoAnalysisRun_requirementId_projectId_fkey"
    FOREIGN KEY ("requirementId", "projectId")
    REFERENCES "Requirement"("id", "projectId")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "MultiRepoAnalysisRun_requirementRevisionId_requirementId_fkey"
    FOREIGN KEY ("requirementRevisionId", "requirementId")
    REFERENCES "RequirementRevision"("id", "requirementId")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
