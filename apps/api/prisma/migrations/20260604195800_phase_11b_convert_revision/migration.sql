-- AlterEnum
ALTER TYPE "ClarificationStatus" ADD VALUE 'CONVERTED_TO_REVISION';

-- AlterTable
ALTER TABLE "clarification_item" ADD COLUMN "converted_revision_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "clarification_item_converted_revision_id_key" ON "clarification_item"("converted_revision_id");

-- AddForeignKey
ALTER TABLE "clarification_item" ADD CONSTRAINT "clarification_item_converted_revision_id_fkey" FOREIGN KEY ("converted_revision_id") REFERENCES "RequirementRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "ImpactAnalysis" ADD COLUMN "source_clarification_id" TEXT;

-- CreateIndex
CREATE INDEX "ImpactAnalysis_source_clarification_id_idx" ON "ImpactAnalysis"("source_clarification_id");

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_source_clarification_id_fkey" FOREIGN KEY ("source_clarification_id") REFERENCES "clarification_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;
