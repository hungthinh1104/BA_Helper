-- Freeze report-job and generated-document writes while validating and replacing
-- the legacy ID-only relation. A maintenance-window rollout is required.
-- Keep the first diagnostic outside an explicit transaction so Prisma can
-- report the actionable historical-data error instead of a later aborted-tx error.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "document_job" AS job
    JOIN "GeneratedDocument" AS document
      ON document."id" = job."generated_document_id"
    WHERE document."impactAnalysisId" IS DISTINCT FROM job."analysis_id"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce DocumentJob generated document analysis scope: an existing job references a document from another analysis';
  END IF;
END
$$;

BEGIN;

LOCK TABLE "document_job", "GeneratedDocument"
  IN SHARE ROW EXCLUSIVE MODE;

-- Recheck after acquiring the write lock to catch a mismatch committed after
-- the diagnostic preflight and before this migration obtained its lock.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "document_job" AS job
    JOIN "GeneratedDocument" AS document
      ON document."id" = job."generated_document_id"
    WHERE document."impactAnalysisId" IS DISTINCT FROM job."analysis_id"
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce DocumentJob generated document analysis scope: an existing job references a document from another analysis';
  END IF;
END
$$;

ALTER TABLE "document_job"
  ADD COLUMN "generated_document_analysis_id" TEXT;

UPDATE "document_job" AS job
SET "generated_document_analysis_id" = document."impactAnalysisId"
FROM "GeneratedDocument" AS document
WHERE document."id" = job."generated_document_id";

ALTER TABLE "document_job"
  DROP CONSTRAINT "document_job_generated_document_id_fkey",
  ADD CONSTRAINT "document_job_generated_document_analysis_scope_check"
    CHECK (
      ("generated_document_id" IS NULL) = ("generated_document_analysis_id" IS NULL)
      AND (
        "generated_document_analysis_id" IS NULL
        OR "generated_document_analysis_id" = "analysis_id"
      )
    ),
  ADD CONSTRAINT "document_job_generated_document_analysis_scope_fkey"
    FOREIGN KEY ("generated_document_id", "generated_document_analysis_id")
    REFERENCES "GeneratedDocument"("id", "impactAnalysisId")
    ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
