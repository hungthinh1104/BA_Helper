-- Fail closed on historical values before adding the persisted confidence contract.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "BaInsight"
    WHERE confidence IS NOT NULL AND NOT (confidence >= 0 AND confidence <= 1)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce BaInsight confidence range: historical values must be between 0 and 1';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "TraceabilityLink"
    WHERE confidence IS NOT NULL AND NOT (confidence >= 0 AND confidence <= 1)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce TraceabilityLink confidence range: historical values must be between 0 and 1';
  END IF;
END
$$;

BEGIN;

LOCK TABLE "BaInsight", "TraceabilityLink" IN SHARE ROW EXCLUSIVE MODE;

-- Recheck while writes are blocked so no invalid value can slip in after preflight.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "BaInsight"
    WHERE confidence IS NOT NULL AND NOT (confidence >= 0 AND confidence <= 1)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce BaInsight confidence range: historical values must be between 0 and 1';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "TraceabilityLink"
    WHERE confidence IS NOT NULL AND NOT (confidence >= 0 AND confidence <= 1)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce TraceabilityLink confidence range: historical values must be between 0 and 1';
  END IF;
END
$$;

ALTER TABLE "BaInsight"
  ADD CONSTRAINT "BaInsight_confidence_range"
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

ALTER TABLE "TraceabilityLink"
  ADD CONSTRAINT "TraceabilityLink_confidence_range"
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

COMMIT;
