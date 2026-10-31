-- Keep repository-derived Evidence attached to a snapshot and requirement-derived
-- Evidence attached to its immutable requirement revision.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Evidence"
    WHERE ("sourceType" IN ('CODE', 'TEST', 'STATIC_ANALYSIS', 'COVERAGE')
           AND "snapshotId" IS NULL)
       OR ("sourceType" = 'REQUIREMENT_INPUT'
           AND "requirementRevisionId" IS NULL)
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce Evidence source origin scope: historical rows are missing snapshot or requirement revision identity';
  END IF;
END
$$;

ALTER TABLE "Evidence"
  ADD CONSTRAINT "Evidence_source_origin_scope_check"
  CHECK (
    ("sourceType" NOT IN ('CODE', 'TEST', 'STATIC_ANALYSIS', 'COVERAGE')
     OR "snapshotId" IS NOT NULL)
    AND ("sourceType" <> 'REQUIREMENT_INPUT'
         OR "requirementRevisionId" IS NOT NULL)
  );
