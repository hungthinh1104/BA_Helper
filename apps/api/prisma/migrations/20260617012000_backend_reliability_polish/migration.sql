CREATE INDEX "ImpactAnalysis_status_createdAt_idx" ON "ImpactAnalysis"("status", "createdAt");
CREATE INDEX "ImpactAnalysis_requirementRevisionId_idx" ON "ImpactAnalysis"("requirementRevisionId");
CREATE INDEX "ImpactAnalysis_snapshotId_idx" ON "ImpactAnalysis"("snapshotId");
CREATE INDEX "ImpactAnalysis_sourceTargetId_idx" ON "ImpactAnalysis"("sourceTargetId");

CREATE INDEX "BaInsight_impactAnalysisId_idx" ON "BaInsight"("impactAnalysisId");
CREATE INDEX "BaInsight_impactAnalysisId_reviewStatus_idx" ON "BaInsight"("impactAnalysisId", "reviewStatus");
CREATE INDEX "BaInsight_impactAnalysisId_certainty_idx" ON "BaInsight"("impactAnalysisId", "certainty");
CREATE INDEX "BaInsight_impactAnalysisId_insightType_idx" ON "BaInsight"("impactAnalysisId", "insightType");

CREATE INDEX "TraceabilityLink_impactAnalysisId_idx" ON "TraceabilityLink"("impactAnalysisId");
CREATE INDEX "TraceabilityLink_impactAnalysisId_reviewStatus_idx" ON "TraceabilityLink"("impactAnalysisId", "reviewStatus");
CREATE INDEX "TraceabilityLink_artifactId_idx" ON "TraceabilityLink"("artifactId");

CREATE INDEX "GeneratedDocument_impactAnalysisId_status_idx" ON "GeneratedDocument"("impactAnalysisId", "status");
