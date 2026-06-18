-- AlterTable
ALTER TABLE "EmbeddingChunk"
  ADD COLUMN "embeddingProfileId" TEXT,
  ADD COLUMN "embeddingProvider" TEXT,
  ADD COLUMN "embeddingDimensions" INTEGER,
  ADD COLUMN "embeddingConfigHash" TEXT;

-- DropIndex
DROP INDEX "EmbeddingChunk_snapshotId_stableChunkId_embeddingModel_key";

-- CreateIndex
CREATE INDEX "EmbeddingChunk_snapshotId_embeddingProfileId_idx"
ON "EmbeddingChunk"("snapshotId", "embeddingProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingChunk_snapshotId_stableChunkId_embeddingProfileId_key"
ON "EmbeddingChunk"("snapshotId", "stableChunkId", "embeddingProfileId");
