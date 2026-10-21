-- Freeze static test paths at review time; historical report snapshots remain unchanged.
ALTER TABLE "reviewed_report_snapshot" ADD COLUMN "test_trace_snapshot" JSONB;
