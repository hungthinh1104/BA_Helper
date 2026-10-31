-- Keep the actionable diagnostic outside the transaction: Prisma may report a
-- later "current transaction is aborted" message for errors inside a SQL file.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ImpactAnalysis" AS analysis
    JOIN "MultiRepoAnalysisRun" AS run
      ON run."id" = analysis."multiRepoRunId"
    WHERE analysis."projectId" <> run."projectId"
       OR analysis."requirementId" <> run."requirementId"
       OR analysis."requirementRevisionId" <> run."requirementRevisionId"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce multi-repo child lineage: existing analysis rows point to a run with a different project, requirement, or revision.';
  END IF;
END $$;

-- Serialize writers after the preflight. Adding the validated composite FK
-- while holding these locks rechecks all rows and rejects any mismatch that
-- was committed between the preflight and lock acquisition.
BEGIN;

LOCK TABLE "ImpactAnalysis", "MultiRepoAnalysisRun"
  IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE "MultiRepoAnalysisRun"
  ADD CONSTRAINT "MultiRepoAnalysisRun_id_projectId_requirementId_requirementRevisionId_key"
    UNIQUE ("id", "projectId", "requirementId", "requirementRevisionId");

ALTER TABLE "ImpactAnalysis"
  DROP CONSTRAINT "ImpactAnalysis_multiRepoRunId_fkey",
  ADD CONSTRAINT "ImpactAnalysis_multiRepoRunId_projectId_requirementId_requirementRevisionId_fkey"
    FOREIGN KEY ("multiRepoRunId", "projectId", "requirementId", "requirementRevisionId")
    REFERENCES "MultiRepoAnalysisRun" ("id", "projectId", "requirementId", "requirementRevisionId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
