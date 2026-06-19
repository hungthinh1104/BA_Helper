-- CreateTable
CREATE TABLE "reviewed_report_snapshot" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "approved_document_id" TEXT,
    "markdown" TEXT NOT NULL,
    "review_decisions_snapshot" JSONB NOT NULL,
    "evidence_quality_summary_snapshot" JSONB NOT NULL,
    "evaluation_context_snapshot" JSONB,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviewed_report_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviewed_report_snapshot_analysis_id_created_at_idx" ON "reviewed_report_snapshot"("analysis_id", "created_at");

-- AddForeignKey
ALTER TABLE "reviewed_report_snapshot" ADD CONSTRAINT "reviewed_report_snapshot_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_report_snapshot" ADD CONSTRAINT "reviewed_report_snapshot_approved_document_id_fkey" FOREIGN KEY ("approved_document_id") REFERENCES "GeneratedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewed_report_snapshot" ADD CONSTRAINT "reviewed_report_snapshot_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
