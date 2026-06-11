-- CreateTable
CREATE TABLE "MergedMultiRepoReportReviewDecision" (
    "id" TEXT NOT NULL,
    "mergedReportId" TEXT NOT NULL,
    "decision" "AnalysisReviewDecisionValue" NOT NULL,
    "note" TEXT,
    "reviewedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MergedMultiRepoReportReviewDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MergedMultiRepoReportReviewDecision_mergedReportId_idx" ON "MergedMultiRepoReportReviewDecision"("mergedReportId");

-- CreateIndex
CREATE INDEX "MergedMultiRepoReportReviewDecision_reviewedByUserId_idx" ON "MergedMultiRepoReportReviewDecision"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "MergedMultiRepoReportReviewDecision" ADD CONSTRAINT "MergedMultiRepoReportReviewDecision_mergedReportId_fkey" FOREIGN KEY ("mergedReportId") REFERENCES "MergedMultiRepoReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MergedMultiRepoReportReviewDecision" ADD CONSTRAINT "MergedMultiRepoReportReviewDecision_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
