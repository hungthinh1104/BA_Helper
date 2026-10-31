-- A report job's analysis and frozen review snapshot form one lineage pair.
-- Existing mismatches cause this validated constraint to fail without rewriting rows.
ALTER TABLE "document_job"
DROP CONSTRAINT "document_job_snapshot_id_fkey";

ALTER TABLE "document_job"
ADD CONSTRAINT "document_job_snapshot_id_analysis_id_fkey"
FOREIGN KEY ("snapshot_id", "analysis_id")
REFERENCES "reviewed_report_snapshot"("id", "analysis_id")
ON DELETE CASCADE ON UPDATE CASCADE;
