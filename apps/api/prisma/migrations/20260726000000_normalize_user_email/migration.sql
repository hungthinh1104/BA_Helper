-- Normalize account emails to their canonical (lowercase) form and enforce
-- case-insensitive uniqueness. Application writes are already normalized at the
-- contract boundary; this migration fixes any legacy mixed-case rows and adds a
-- database-level guard.

-- 1. Abort with a clear, actionable message if lowercasing would merge two
--    distinct accounts. We never silently merge accounts.
DO $$
DECLARE
  collided text;
BEGIN
  SELECT lower(email)
    INTO collided
    FROM "user"
   GROUP BY lower(email)
  HAVING count(*) > 1
   LIMIT 1;

  IF collided IS NOT NULL THEN
    RAISE EXCEPTION
      'Email normalization aborted: case-variant duplicate accounts exist for "%". Resolve the duplicate accounts before re-running this migration.',
      collided;
  END IF;
END $$;

-- 2. Backfill legacy mixed-case emails to lowercase.
UPDATE "user"
   SET email = lower(email)
 WHERE email <> lower(email);

-- 3. Enforce case-insensitive uniqueness at the database level (defense in depth,
--    in addition to the always-normalized application writes).
CREATE UNIQUE INDEX IF NOT EXISTS "user_email_lower_key" ON "user" (lower(email));
