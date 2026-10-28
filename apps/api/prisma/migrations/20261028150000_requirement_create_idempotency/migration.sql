ALTER TABLE "Requirement"
ADD COLUMN "requestKey" TEXT;

UPDATE "Requirement"
SET "requestKey" = gen_random_uuid()::text
WHERE "requestKey" IS NULL;

ALTER TABLE "Requirement"
ALTER COLUMN "requestKey" SET NOT NULL;

ALTER TABLE "Requirement"
ADD COLUMN "requestPayloadHash" TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX "Requirement_projectId_requestKey_key"
ON "Requirement"("projectId", "requestKey");
