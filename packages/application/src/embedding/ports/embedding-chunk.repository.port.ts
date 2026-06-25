export type SimilarChunk = {
  id: string;
  artifactId: string | null;
  filePath: string;
  symbolName: string | null;
  artifactType: string;
  content: string;
  similarity: number;
};

export interface EmbeddingChunkRepositoryPort {
  insertMany(
    chunks: Array<{
      tenantId: string;
      projectId: string;
      repositoryId: string;
      snapshotId: string;
      artifactId: string | null;
      stableChunkId: string;
      commitSha: string;
      filePath: string;
      symbolName: string | null;
      artifactType: string;
      content: string;
      contentHash: string;
      tokenCount: number;
      chunkerVersion: string | null;
      embeddingModel: string;
      embedding: number[];
    }>,
  ): Promise<void>;

  searchSimilar(params: {
    tenantId: string;
    projectId: string;
    repositoryId: string;
    snapshotId: string;
    queryEmbedding: number[];
    limit?: number;
    artifactTypes?: string[];
  }): Promise<SimilarChunk[]>;

  listBySnapshot(
    snapshotId: string,
    embeddingModel: string,
  ): Promise<Array<{ stableChunkId: string; contentHash: string; artifactId: string | null; chunkerVersion: string | null }>>;

  deleteBySnapshot(snapshotId: string): Promise<any>;
  deleteByRepository(repositoryId: string): Promise<any>;
  deleteByArtifact(artifactId: string): Promise<any>;

  listForReuseByArtifacts(params: {
    snapshotId: string;
    artifactIds: string[];
    embeddingModel: string;
    chunkerVersion: string;
  }): Promise<Array<{ artifactId: string; contentHash: string; chunkerVersion: string | null; embeddingModel: string }>>;

  copyChunk(params: {
    baseSnapshotId: string;
    oldArtifactId: string;
    embeddingModel: string;
    chunkerVersion: string;
    contentHash: string;
    tenantId: string;
    projectId: string;
    repositoryId: string;
    targetSnapshotId: string;
    newArtifactId: string;
    newStableChunkId: string;
    commitSha: string;
    filePath: string;
    symbolName: string | null;
    artifactType: string;
    content: string;
    tokenCount: number;
  }): Promise<boolean>;
}
