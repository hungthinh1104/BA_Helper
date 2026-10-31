-- A persisted review decision must belong to the same analysis as its link.
-- Existing mismatches cause this validated constraint to fail without rewriting rows.
CREATE UNIQUE INDEX "TraceabilityLink_id_impactAnalysisId_key"
ON "TraceabilityLink"("id", "impactAnalysisId");

CREATE UNIQUE INDEX "traceability_review_decision_traceability_link_id_analysis_id_key"
ON "traceability_review_decision"("traceability_link_id", "analysis_id");

ALTER TABLE "traceability_review_decision"
DROP CONSTRAINT "traceability_review_decision_traceability_link_id_fkey";

ALTER TABLE "traceability_review_decision"
ADD CONSTRAINT "traceability_review_decision_traceability_link_id_analysis_id_fkey"
FOREIGN KEY ("traceability_link_id", "analysis_id")
REFERENCES "TraceabilityLink"("id", "impactAnalysisId")
ON DELETE CASCADE ON UPDATE CASCADE;
