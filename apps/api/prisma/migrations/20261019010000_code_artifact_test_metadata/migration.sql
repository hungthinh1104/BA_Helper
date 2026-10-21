-- Test declarations carry validated metadata; existing snapshot artifacts stay unchanged.
ALTER TABLE "CodeArtifact" ADD COLUMN "metadata" JSONB;
