-- Review notes must describe exactly one insight or traceability link.
-- Abort before DDL when existing rows violate that invariant.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "review_note"
    WHERE ("insight_id" IS NULL) = ("traceability_link_id" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Cannot enforce review note target cardinality: existing note has zero or two targets';
  END IF;
END
$$;

ALTER TABLE "review_note"
DROP CONSTRAINT IF EXISTS "review_note_exactly_one_target_check";

ALTER TABLE "review_note"
ADD CONSTRAINT "review_note_exactly_one_target_check"
CHECK (("insight_id" IS NULL) <> ("traceability_link_id" IS NULL));

COMMIT;
