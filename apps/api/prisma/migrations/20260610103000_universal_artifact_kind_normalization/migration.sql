ALTER TABLE "CodeArtifact"
ADD COLUMN "universal_kind" TEXT NOT NULL DEFAULT 'UNKNOWN';

UPDATE "CodeArtifact"
SET "universal_kind" = CASE
  WHEN "artifactType" = 'API_ROUTE' THEN 'API_ENDPOINT'
  WHEN "artifactType" = 'SERVICE_METHOD' THEN 'DOMAIN_SERVICE'
  WHEN "artifactType" = 'ENTITY' THEN 'DATA_MODEL'
  WHEN "artifactType" = 'TEST' THEN 'TEST_CASE'
  ELSE 'UNKNOWN'
END;
