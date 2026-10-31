-- Keep persisted embedding identity aligned with its project and source snapshot.
-- Refuse to apply if historical data needs an explicit repair decision.
-- Keep this diagnostic outside the write transaction so Prisma can expose the
-- actionable failure instead of a later aborted-transaction message.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "EmbeddingChunk" AS chunk
    LEFT JOIN "Repository" AS repository
      ON repository."id" = chunk."repositoryId"
    LEFT JOIN "RepositorySnapshot" AS snapshot
      ON snapshot."id" = chunk."snapshotId"
    LEFT JOIN "CodeArtifact" AS artifact
      ON artifact."id" = chunk."artifactId"
    WHERE chunk."tenantId" IS DISTINCT FROM chunk."projectId"
      OR repository."projectId" IS DISTINCT FROM chunk."projectId"
      OR snapshot."repositoryId" IS DISTINCT FROM chunk."repositoryId"
      OR snapshot."commitSha" IS DISTINCT FROM chunk."commitSha"
      OR (
        chunk."artifactId" IS NOT NULL
        AND artifact."snapshotId" IS DISTINCT FROM chunk."snapshotId"
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enforce EmbeddingChunk provenance: historical rows have mismatched project, repository, snapshot, artifact, or commit identity';
  END IF;
END
$$;

BEGIN;

LOCK TABLE "EmbeddingChunk", "Repository", "RepositorySnapshot", "CodeArtifact"
  IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "EmbeddingChunk" AS chunk
    LEFT JOIN "Repository" AS repository
      ON repository."id" = chunk."repositoryId"
    LEFT JOIN "RepositorySnapshot" AS snapshot
      ON snapshot."id" = chunk."snapshotId"
    LEFT JOIN "CodeArtifact" AS artifact
      ON artifact."id" = chunk."artifactId"
    WHERE chunk."tenantId" IS DISTINCT FROM chunk."projectId"
      OR repository."projectId" IS DISTINCT FROM chunk."projectId"
      OR snapshot."repositoryId" IS DISTINCT FROM chunk."repositoryId"
      OR snapshot."commitSha" IS DISTINCT FROM chunk."commitSha"
      OR (
        chunk."artifactId" IS NOT NULL
        AND artifact."snapshotId" IS DISTINCT FROM chunk."snapshotId"
      )
  ) THEN
    RAISE EXCEPTION 'Cannot enforce EmbeddingChunk provenance: historical rows have mismatched project, repository, snapshot, artifact, or commit identity';
  END IF;
END
$$;

CREATE UNIQUE INDEX "Repository_id_projectId_key"
  ON "Repository"("id", "projectId");
CREATE UNIQUE INDEX "RepositorySnapshot_id_repositoryId_commitSha_key"
  ON "RepositorySnapshot"("id", "repositoryId", "commitSha");
CREATE UNIQUE INDEX "CodeArtifact_id_snapshotId_key"
  ON "CodeArtifact"("id", "snapshotId");

ALTER TABLE "EmbeddingChunk"
  DROP CONSTRAINT "EmbeddingChunk_snapshotId_fkey",
  DROP CONSTRAINT "EmbeddingChunk_artifactId_fkey";

ALTER TABLE "EmbeddingChunk"
  ADD CONSTRAINT "EmbeddingChunk_tenantId_projectId_check"
    CHECK ("tenantId" = "projectId"),
  ADD CONSTRAINT "EmbeddingChunk_repositoryId_projectId_fkey"
    FOREIGN KEY ("repositoryId", "projectId")
    REFERENCES "Repository"("id", "projectId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EmbeddingChunk_snapshotId_repositoryId_commitSha_fkey"
    FOREIGN KEY ("snapshotId", "repositoryId", "commitSha")
    REFERENCES "RepositorySnapshot"("id", "repositoryId", "commitSha")
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EmbeddingChunk_artifactId_snapshotId_fkey"
    FOREIGN KEY ("artifactId", "snapshotId")
    REFERENCES "CodeArtifact"("id", "snapshotId")
    ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
