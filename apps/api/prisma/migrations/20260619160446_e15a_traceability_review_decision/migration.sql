-- CreateEnum
CREATE TYPE "TraceabilityReviewDecisionValue" AS ENUM ('ACCEPTED', 'REJECTED', 'NEEDS_REVIEW', 'NEEDS_MORE_EVIDENCE');

-- CreateTable
CREATE TABLE "traceability_review_decision" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "traceability_link_id" TEXT NOT NULL,
    "decision" "TraceabilityReviewDecisionValue" NOT NULL,
    "note" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "traceability_review_decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "traceability_review_decision_traceability_link_id_key" ON "traceability_review_decision"("traceability_link_id");

-- CreateIndex
CREATE INDEX "traceability_review_decision_analysis_id_idx" ON "traceability_review_decision"("analysis_id");

-- CreateIndex
CREATE INDEX "traceability_review_decision_reviewed_by_user_id_idx" ON "traceability_review_decision"("reviewed_by_user_id");

-- AddForeignKey
ALTER TABLE "traceability_review_decision" ADD CONSTRAINT "traceability_review_decision_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_review_decision" ADD CONSTRAINT "traceability_review_decision_traceability_link_id_fkey" FOREIGN KEY ("traceability_link_id") REFERENCES "TraceabilityLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traceability_review_decision" ADD CONSTRAINT "traceability_review_decision_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
