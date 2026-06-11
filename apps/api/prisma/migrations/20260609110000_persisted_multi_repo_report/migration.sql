-- CreateTable
CREATE TABLE "MergedMultiRepoReport" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "provenance" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MergedMultiRepoReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MergedMultiRepoReport_runId_key" ON "MergedMultiRepoReport"("runId");

-- CreateIndex
CREATE INDEX "MergedMultiRepoReport_runId_idx" ON "MergedMultiRepoReport"("runId");

-- AddForeignKey
ALTER TABLE "MergedMultiRepoReport" ADD CONSTRAINT "MergedMultiRepoReport_runId_fkey" FOREIGN KEY ("runId") REFERENCES "MultiRepoAnalysisRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
