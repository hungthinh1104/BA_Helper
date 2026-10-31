-- Preserve legacy snapshot/document links while enforcing their analysis scope.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "reviewed_report_snapshot" AS snapshot
    JOIN "GeneratedDocument" AS document
      ON document."id" = snapshot."approved_document_id"
    WHERE document."impactAnalysisId" IS DISTINCT FROM snapshot."analysis_id"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce reviewed report document analysis scope: a snapshot links to a document from another analysis';
  END IF;
END
$$;

ALTER TABLE "reviewed_report_snapshot"
ADD COLUMN "approved_document_analysis_id" TEXT;

UPDATE "reviewed_report_snapshot" AS snapshot
SET "approved_document_analysis_id" = snapshot."analysis_id"
FROM "GeneratedDocument" AS document
WHERE document."id" = snapshot."approved_document_id";

CREATE UNIQUE INDEX "GeneratedDocument_id_impactAnalysisId_key"
ON "GeneratedDocument"("id", "impactAnalysisId");

ALTER TABLE "reviewed_report_snapshot"
  DROP CONSTRAINT "reviewed_report_snapshot_approved_document_id_fkey",
  ADD CONSTRAINT "reviewed_report_snapshot_approved_document_analysis_scope_check"
    CHECK (
      ("approved_document_id" IS NULL) = ("approved_document_analysis_id" IS NULL)
      AND (
        "approved_document_analysis_id" IS NULL
        OR "approved_document_analysis_id" = "analysis_id"
      )
    ),
  ADD CONSTRAINT "reviewed_report_snapshot_approved_document_id_analysis_id_fkey"
    FOREIGN KEY ("approved_document_id", "approved_document_analysis_id")
    REFERENCES "GeneratedDocument"("id", "impactAnalysisId")
    ON DELETE SET NULL ON UPDATE CASCADE;
