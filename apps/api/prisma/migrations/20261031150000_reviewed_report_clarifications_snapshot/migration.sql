-- Preserve clarification state at the reviewed-report snapshot boundary.
ALTER TABLE "reviewed_report_snapshot"
ADD COLUMN "clarifications_snapshot" JSONB;
