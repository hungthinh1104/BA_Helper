-- Existing report rows remain unassociated because legacy snapshots may share
-- a mutable GeneratedDocument. New worker output is scoped to one snapshot.
ALTER TABLE "GeneratedDocument"
ADD COLUMN "reviewed_report_snapshot_id" TEXT;

CREATE UNIQUE INDEX "reviewed_report_snapshot_id_analysis_id_key"
ON "reviewed_report_snapshot"("id", "analysis_id");

CREATE UNIQUE INDEX "GeneratedDocument_reviewedReportSnapshotId_type_status_key"
ON "GeneratedDocument"("reviewed_report_snapshot_id", "type", "status");

-- Preserve the legacy writer identity for documents that cannot be safely
-- assigned to one reviewed snapshot. PostgreSQL treats NULL values as distinct
-- in the snapshot-scoped index above, so those legacy rows need their own key.
CREATE UNIQUE INDEX "GeneratedDocument_legacy_identity_key"
ON "GeneratedDocument"("impactAnalysisId", "type", "status")
WHERE "reviewed_report_snapshot_id" IS NULL;

ALTER TABLE "GeneratedDocument"
ADD CONSTRAINT "GeneratedDocument_reviewed_report_snapshot_id_impactAnalysisId_fkey"
FOREIGN KEY ("reviewed_report_snapshot_id", "impactAnalysisId")
REFERENCES "reviewed_report_snapshot"("id", "analysis_id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the legacy writer identity protected until the snapshot-scoped identity
-- and its analysis-scope foreign key are both in place.
DROP INDEX "GeneratedDocument_impactAnalysisId_type_status_key";
