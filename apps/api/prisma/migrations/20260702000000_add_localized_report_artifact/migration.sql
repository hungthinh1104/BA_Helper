-- CreateEnum
CREATE TYPE "LocalizationStatus" AS ENUM ('QUEUED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LocalizedReportArtifact" (
    "id" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "sourceLocale" TEXT NOT NULL DEFAULT 'en',
    "localizationStatus" "LocalizationStatus" NOT NULL,
    "contentMarkdown" TEXT,
    "sourceContentHash" TEXT NOT NULL,
    "glossaryVersion" TEXT,
    "provider" TEXT,
    "model" TEXT,
    "translationPromptVersion" TEXT,
    "structuralValidatorVersion" TEXT,
    "fieldPolicyVersion" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizedReportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalizedReportArtifact_sourceDocumentId_locale_key" ON "LocalizedReportArtifact"("sourceDocumentId", "locale");

-- CreateIndex
CREATE INDEX "LocalizedReportArtifact_sourceDocumentId_idx" ON "LocalizedReportArtifact"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "LocalizedReportArtifact_locale_idx" ON "LocalizedReportArtifact"("locale");

-- CreateIndex
CREATE INDEX "LocalizedReportArtifact_localizationStatus_idx" ON "LocalizedReportArtifact"("localizationStatus");

-- AddForeignKey
ALTER TABLE "LocalizedReportArtifact" ADD CONSTRAINT "LocalizedReportArtifact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "GeneratedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
