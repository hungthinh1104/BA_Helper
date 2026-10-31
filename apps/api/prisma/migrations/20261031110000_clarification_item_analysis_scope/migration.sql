-- Keep the actionable diagnostic outside the transaction. Do not rewrite or
-- delete clarification history when an insight belongs to another analysis.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM clarification_item AS clarification
    LEFT JOIN "BaInsight" AS insight
      ON insight."id" = clarification.source_insight_id
     AND insight."impactAnalysisId" = clarification.impact_analysis_id
    WHERE insight."id" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce clarification item analysis scope: existing clarification rows reference an insight from another analysis.';
  END IF;
END $$;

-- Serialize writes after preflight. Adding the validated FK under these locks
-- also rejects a mismatch committed between the preflight and lock acquisition.
BEGIN;

LOCK TABLE clarification_item, "BaInsight"
  IN SHARE ROW EXCLUSIVE MODE;

CREATE UNIQUE INDEX "clarification_item_source_insight_id_impact_analysis_id_key"
  ON clarification_item (source_insight_id, impact_analysis_id);

DROP INDEX "clarification_item_source_insight_id_key";

ALTER TABLE clarification_item
  DROP CONSTRAINT "clarification_item_source_insight_id_fkey",
  ADD CONSTRAINT "clarification_item_source_insight_id_impact_analysis_id_fkey"
    FOREIGN KEY (source_insight_id, impact_analysis_id)
    REFERENCES "BaInsight" ("id", "impactAnalysisId")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
