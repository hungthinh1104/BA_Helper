-- CreateEnum
CREATE TYPE "DocumentJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "document_job" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "snapshot_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "status" "DocumentJobStatus" NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "request_key" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "error" JSONB,
    "generated_document_id" TEXT,
    "last_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_job_analysis_id_idx" ON "document_job"("analysis_id");

-- CreateIndex
CREATE INDEX "document_job_status_idx" ON "document_job"("status");

-- CreateIndex
CREATE INDEX "document_job_request_key_idx" ON "document_job"("request_key");

-- CreateIndex
CREATE UNIQUE INDEX "document_job_snapshot_id_document_type_key" ON "document_job"("snapshot_id", "document_type");

-- AddForeignKey
ALTER TABLE "document_job" ADD CONSTRAINT "document_job_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_job" ADD CONSTRAINT "document_job_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "reviewed_report_snapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_job" ADD CONSTRAINT "document_job_generated_document_id_fkey" FOREIGN KEY ("generated_document_id") REFERENCES "GeneratedDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
