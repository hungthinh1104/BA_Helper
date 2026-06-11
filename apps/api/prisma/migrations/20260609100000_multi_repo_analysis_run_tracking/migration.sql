CREATE TABLE "MultiRepoAnalysisRun" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "requirementRevisionId" TEXT NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "requestKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MultiRepoAnalysisRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ImpactAnalysis"
ADD COLUMN "multiRepoRunId" TEXT;

CREATE UNIQUE INDEX "MultiRepoAnalysisRun_projectId_requestKey_key"
ON "MultiRepoAnalysisRun"("projectId", "requestKey");

CREATE INDEX "MultiRepoAnalysisRun_projectId_idx"
ON "MultiRepoAnalysisRun"("projectId");

CREATE INDEX "MultiRepoAnalysisRun_requirementRevisionId_idx"
ON "MultiRepoAnalysisRun"("requirementRevisionId");

CREATE INDEX "MultiRepoAnalysisRun_createdByUserId_idx"
ON "MultiRepoAnalysisRun"("createdByUserId");

CREATE INDEX "ImpactAnalysis_multiRepoRunId_idx"
ON "ImpactAnalysis"("multiRepoRunId");

ALTER TABLE "MultiRepoAnalysisRun"
ADD CONSTRAINT "MultiRepoAnalysisRun_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MultiRepoAnalysisRun"
ADD CONSTRAINT "MultiRepoAnalysisRun_requirementRevisionId_fkey"
FOREIGN KEY ("requirementRevisionId") REFERENCES "RequirementRevision"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MultiRepoAnalysisRun"
ADD CONSTRAINT "MultiRepoAnalysisRun_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "user"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImpactAnalysis"
ADD CONSTRAINT "ImpactAnalysis_multiRepoRunId_fkey"
FOREIGN KEY ("multiRepoRunId") REFERENCES "MultiRepoAnalysisRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
