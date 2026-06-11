-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "SnapshotIndexStatus" AS ENUM ('NOT_INDEXED', 'LEXICAL_READY', 'VECTOR_INDEXING', 'VECTOR_READY', 'VECTOR_FAILED');

-- AlterTable
ALTER TABLE "ImpactAnalysis" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "RepositorySnapshot" ADD COLUMN     "indexStatus" "SnapshotIndexStatus" NOT NULL DEFAULT 'NOT_INDEXED';

-- CreateTable
CREATE TABLE "EmbeddingChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "artifactId" TEXT,
    "stableChunkId" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "symbolName" TEXT,
    "artifactType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "embeddingModel" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmbeddingChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmbeddingChunk_tenantId_idx" ON "EmbeddingChunk"("tenantId");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_projectId_idx" ON "EmbeddingChunk"("projectId");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_repositoryId_idx" ON "EmbeddingChunk"("repositoryId");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_snapshotId_idx" ON "EmbeddingChunk"("snapshotId");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_artifactId_idx" ON "EmbeddingChunk"("artifactId");

-- CreateIndex
CREATE INDEX "EmbeddingChunk_commitSha_idx" ON "EmbeddingChunk"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddingChunk_snapshotId_stableChunkId_embeddingModel_key" ON "EmbeddingChunk"("snapshotId", "stableChunkId", "embeddingModel");

-- AddForeignKey
ALTER TABLE "EmbeddingChunk" ADD CONSTRAINT "EmbeddingChunk_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "RepositorySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddingChunk" ADD CONSTRAINT "EmbeddingChunk_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "CodeArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
