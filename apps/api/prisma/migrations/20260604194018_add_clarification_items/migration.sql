-- CreateEnum
CREATE TYPE "ClarificationStatus" AS ENUM ('OPEN', 'ANSWERED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "DocumentStatus" ADD VALUE 'STALE';

-- AlterTable
ALTER TABLE "ImpactAnalysis" ADD COLUMN     "error" JSONB;

-- AlterTable
ALTER TABLE "RepositorySnapshot" ADD COLUMN     "diagnostics" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "ScanJob" ADD COLUMN     "diagnostics" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "review_note" (
    "id" TEXT NOT NULL,
    "impact_analysis_id" TEXT NOT NULL,
    "insight_id" TEXT,
    "traceability_link_id" TEXT,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clarification_item" (
    "id" TEXT NOT NULL,
    "impact_analysis_id" TEXT NOT NULL,
    "source_insight_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "reason" TEXT,
    "status" "ClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "answer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clarification_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "review_note_insight_id_key" ON "review_note"("insight_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_note_traceability_link_id_key" ON "review_note"("traceability_link_id");

-- CreateIndex
CREATE INDEX "review_note_impact_analysis_id_idx" ON "review_note"("impact_analysis_id");

-- CreateIndex
CREATE INDEX "review_note_insight_id_idx" ON "review_note"("insight_id");

-- CreateIndex
CREATE INDEX "review_note_traceability_link_id_idx" ON "review_note"("traceability_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_note_impact_analysis_id_insight_id_key" ON "review_note"("impact_analysis_id", "insight_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_note_impact_analysis_id_traceability_link_id_key" ON "review_note"("impact_analysis_id", "traceability_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "clarification_item_source_insight_id_key" ON "clarification_item"("source_insight_id");

-- CreateIndex
CREATE INDEX "clarification_item_impact_analysis_id_idx" ON "clarification_item"("impact_analysis_id");

-- CreateIndex
CREATE INDEX "clarification_item_status_idx" ON "clarification_item"("status");

-- AddForeignKey
ALTER TABLE "review_note" ADD CONSTRAINT "review_note_impact_analysis_id_fkey" FOREIGN KEY ("impact_analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_note" ADD CONSTRAINT "review_note_insight_id_fkey" FOREIGN KEY ("insight_id") REFERENCES "BaInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_note" ADD CONSTRAINT "review_note_traceability_link_id_fkey" FOREIGN KEY ("traceability_link_id") REFERENCES "TraceabilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_item" ADD CONSTRAINT "clarification_item_impact_analysis_id_fkey" FOREIGN KEY ("impact_analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clarification_item" ADD CONSTRAINT "clarification_item_source_insight_id_fkey" FOREIGN KEY ("source_insight_id") REFERENCES "BaInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;
