-- CreateEnum
CREATE TYPE "ReviewClarificationStatus" AS ENUM ('OPEN', 'ANSWERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AnalysisReviewDecisionValue" AS ENUM ('ACCEPTED', 'REJECTED', 'NEEDS_MORE_CLARIFICATION');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REVIEWER', 'VIEWER');

-- AlterTable
ALTER TABLE "ImpactAnalysis" ADD COLUMN     "derived_from_analysis_id" TEXT,
ADD COLUMN     "review_clarification_request_id" TEXT;

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'REVIEWER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_review_decision" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "decision" "AnalysisReviewDecisionValue" NOT NULL,
    "note" TEXT,
    "reviewed_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_review_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_clarification_request" (
    "id" TEXT NOT NULL,
    "analysis_id" TEXT NOT NULL,
    "review_decision_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "ReviewClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "created_by_user_id" UUID NOT NULL,
    "answered_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "review_clarification_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "analysis_review_decision_analysis_id_created_at_idx" ON "analysis_review_decision"("analysis_id", "created_at");

-- CreateIndex
CREATE INDEX "review_clarification_request_analysis_id_created_at_idx" ON "review_clarification_request"("analysis_id", "created_at");

-- CreateIndex
CREATE INDEX "review_clarification_request_review_decision_id_idx" ON "review_clarification_request"("review_decision_id");

-- CreateIndex
CREATE INDEX "ImpactAnalysis_derived_from_analysis_id_idx" ON "ImpactAnalysis"("derived_from_analysis_id");

-- CreateIndex
CREATE INDEX "ImpactAnalysis_review_clarification_request_id_idx" ON "ImpactAnalysis"("review_clarification_request_id");

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_derived_from_analysis_id_fkey" FOREIGN KEY ("derived_from_analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpactAnalysis" ADD CONSTRAINT "ImpactAnalysis_review_clarification_request_id_fkey" FOREIGN KEY ("review_clarification_request_id") REFERENCES "review_clarification_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_review_decision" ADD CONSTRAINT "analysis_review_decision_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_review_decision" ADD CONSTRAINT "analysis_review_decision_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_clarification_request" ADD CONSTRAINT "review_clarification_request_analysis_id_fkey" FOREIGN KEY ("analysis_id") REFERENCES "ImpactAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_clarification_request" ADD CONSTRAINT "review_clarification_request_review_decision_id_fkey" FOREIGN KEY ("review_decision_id") REFERENCES "analysis_review_decision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_clarification_request" ADD CONSTRAINT "review_clarification_request_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_clarification_request" ADD CONSTRAINT "review_clarification_request_answered_by_user_id_fkey" FOREIGN KEY ("answered_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
