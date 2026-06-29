-- CreateEnum
CREATE TYPE "DomainPackCapabilityStatus" AS ENUM ('STABLE', 'PARTIAL', 'EXPERIMENTAL', 'FALLBACK');

-- CreateEnum
CREATE TYPE "DomainPackSelectionSource" AS ENUM ('EXPLICIT', 'REPOSITORY_PROFILE', 'FALLBACK');

-- AlterTable
ALTER TABLE "ImpactAnalysis"
  ADD COLUMN "requestedDomainPackId" TEXT,
  ADD COLUMN "resolvedDomainPackId" TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN "resolvedDomainPackVersion" TEXT NOT NULL DEFAULT '0.0.0',
  ADD COLUMN "resolvedDomainPackStatus" "DomainPackCapabilityStatus" NOT NULL DEFAULT 'FALLBACK',
  ADD COLUMN "domainPackSelectedBy" "DomainPackSelectionSource" NOT NULL DEFAULT 'FALLBACK',
  ADD COLUMN "domainPackResolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "domainPackManifestDigest" TEXT,
  ADD COLUMN "domainPackRegistryVersion" TEXT;

-- AlterTable
ALTER TABLE "MultiRepoAnalysisRun"
  ADD COLUMN "requestedDomainPackId" TEXT,
  ADD COLUMN "resolvedDomainPackId" TEXT NOT NULL DEFAULT 'general',
  ADD COLUMN "resolvedDomainPackVersion" TEXT NOT NULL DEFAULT '0.0.0',
  ADD COLUMN "resolvedDomainPackStatus" "DomainPackCapabilityStatus" NOT NULL DEFAULT 'FALLBACK',
  ADD COLUMN "domainPackSelectedBy" "DomainPackSelectionSource" NOT NULL DEFAULT 'FALLBACK',
  ADD COLUMN "domainPackResolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "domainPackManifestDigest" TEXT,
  ADD COLUMN "domainPackRegistryVersion" TEXT;

-- Backfill ImpactAnalysis from the resolved selection persisted in metadata.
UPDATE "ImpactAnalysis"
SET
  "requestedDomainPackId" = NULLIF("metadata" #>> '{selectedDomainPack,requestedDomainPackId}', ''),
  "resolvedDomainPackId" = COALESCE(NULLIF("metadata" #>> '{selectedDomainPack,resolvedDomainPackId}', ''), "resolvedDomainPackId"),
  "resolvedDomainPackVersion" = COALESCE(NULLIF("metadata" #>> '{selectedDomainPack,resolvedDomainPackVersion}', ''), "resolvedDomainPackVersion"),
  "resolvedDomainPackStatus" = CASE
    WHEN "metadata" #>> '{selectedDomainPack,resolvedDomainPackStatus}' IN ('STABLE', 'PARTIAL', 'EXPERIMENTAL', 'FALLBACK')
      THEN ("metadata" #>> '{selectedDomainPack,resolvedDomainPackStatus}')::"DomainPackCapabilityStatus"
    ELSE "resolvedDomainPackStatus"
  END,
  "domainPackSelectedBy" = CASE
    WHEN "metadata" #>> '{selectedDomainPack,selectedBy}' IN ('EXPLICIT', 'REPOSITORY_PROFILE', 'FALLBACK')
      THEN ("metadata" #>> '{selectedDomainPack,selectedBy}')::"DomainPackSelectionSource"
    ELSE "domainPackSelectedBy"
  END,
  "domainPackResolvedAt" = CASE
    WHEN ("metadata" #>> '{selectedDomainPack,resolvedAt}') ~ '^\d{4}-\d{2}-\d{2}T'
      THEN ("metadata" #>> '{selectedDomainPack,resolvedAt}')::timestamp
    ELSE "domainPackResolvedAt"
  END
WHERE "metadata" ? 'selectedDomainPack';

-- Backfill multi-repo runs from the first child analysis. v1 creates child
-- analyses with the same explicit run-level selection when a run-level pack is
-- requested; mixed or legacy runs retain conservative defaults.
UPDATE "MultiRepoAnalysisRun" AS run
SET
  "requestedDomainPackId" = child."requestedDomainPackId",
  "resolvedDomainPackId" = child."resolvedDomainPackId",
  "resolvedDomainPackVersion" = child."resolvedDomainPackVersion",
  "resolvedDomainPackStatus" = child."resolvedDomainPackStatus",
  "domainPackSelectedBy" = child."domainPackSelectedBy",
  "domainPackResolvedAt" = child."domainPackResolvedAt",
  "domainPackManifestDigest" = child."domainPackManifestDigest",
  "domainPackRegistryVersion" = child."domainPackRegistryVersion"
FROM LATERAL (
  SELECT
    analysis."requestedDomainPackId",
    analysis."resolvedDomainPackId",
    analysis."resolvedDomainPackVersion",
    analysis."resolvedDomainPackStatus",
    analysis."domainPackSelectedBy",
    analysis."domainPackResolvedAt",
    analysis."domainPackManifestDigest",
    analysis."domainPackRegistryVersion"
  FROM "ImpactAnalysis" AS analysis
  WHERE analysis."multiRepoRunId" = run."id"
  ORDER BY analysis."createdAt" ASC
  LIMIT 1
) AS child
WHERE child."resolvedDomainPackId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ImpactAnalysis_resolvedDomainPackId_resolvedDomainPackVersion_idx"
  ON "ImpactAnalysis"("resolvedDomainPackId", "resolvedDomainPackVersion");

-- CreateIndex
CREATE INDEX "MultiRepoAnalysisRun_resolvedDomainPackId_resolvedDomainPackVersion_idx"
  ON "MultiRepoAnalysisRun"("resolvedDomainPackId", "resolvedDomainPackVersion");
