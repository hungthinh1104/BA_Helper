-- Keep the actionable diagnostic outside the transaction. Do not rewrite or
-- delete requests whose review decision belongs to another analysis.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM review_clarification_request AS request
    LEFT JOIN analysis_review_decision AS decision
      ON decision.id = request.review_decision_id
     AND decision.analysis_id = request.analysis_id
    WHERE decision.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce review clarification analysis scope: existing requests reference a decision from another analysis.';
  END IF;
END $$;

-- Serialize writes after preflight. The validated FK catches a mismatch
-- committed between the preflight and lock acquisition.
BEGIN;

LOCK TABLE review_clarification_request, analysis_review_decision
  IN SHARE ROW EXCLUSIVE MODE;

CREATE UNIQUE INDEX "analysis_review_decision_id_analysis_id_key"
  ON analysis_review_decision (id, analysis_id);

ALTER TABLE review_clarification_request
  DROP CONSTRAINT "review_clarification_request_review_decision_id_fkey",
  ADD CONSTRAINT "review_clarification_request_review_decision_id_analysis_id_fkey"
    FOREIGN KEY (review_decision_id, analysis_id)
    REFERENCES analysis_review_decision (id, analysis_id)
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
