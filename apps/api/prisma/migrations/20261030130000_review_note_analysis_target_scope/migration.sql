-- A review note's target must belong to the analysis recorded on the note.
-- Existing mismatches cause these validated constraints to fail without rewriting rows.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "review_note" note
    LEFT JOIN "BaInsight" insight
      ON insight."id" = note."insight_id"
     AND insight."impactAnalysisId" = note."impact_analysis_id"
    WHERE note."insight_id" IS NOT NULL
      AND insight."id" IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM "review_note" note
    LEFT JOIN "TraceabilityLink" link
      ON link."id" = note."traceability_link_id"
     AND link."impactAnalysisId" = note."impact_analysis_id"
    WHERE note."traceability_link_id" IS NOT NULL
      AND link."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce review note scope: existing target belongs to another analysis';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "BaInsight_id_impactAnalysisId_key"
ON "BaInsight"("id", "impactAnalysisId");

CREATE UNIQUE INDEX IF NOT EXISTS "review_note_insight_id_impact_analysis_id_key"
ON "review_note"("insight_id", "impact_analysis_id");

CREATE UNIQUE INDEX IF NOT EXISTS "review_note_traceability_link_id_impact_analysis_id_key"
ON "review_note"("traceability_link_id", "impact_analysis_id");

ALTER TABLE "review_note"
DROP CONSTRAINT IF EXISTS "review_note_insight_id_fkey";

ALTER TABLE "review_note"
DROP CONSTRAINT IF EXISTS "review_note_traceability_link_id_fkey";

ALTER TABLE "review_note"
DROP CONSTRAINT IF EXISTS "review_note_insight_id_impact_analysis_id_fkey";

ALTER TABLE "review_note"
DROP CONSTRAINT IF EXISTS "review_note_traceability_link_id_impact_analysis_id_fkey";

ALTER TABLE "review_note"
ADD CONSTRAINT "review_note_insight_id_impact_analysis_id_fkey"
FOREIGN KEY ("insight_id", "impact_analysis_id")
REFERENCES "BaInsight"("id", "impactAnalysisId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "review_note"
ADD CONSTRAINT "review_note_traceability_link_id_impact_analysis_id_fkey"
FOREIGN KEY ("traceability_link_id", "impact_analysis_id")
REFERENCES "TraceabilityLink"("id", "impactAnalysisId")
ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
