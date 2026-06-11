import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmbedSnapshotArtifactsUseCase } from '../../apps/api/src/modules/embedding/application/embed-snapshot-artifacts.usecase';
import { FakeEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/fake-embedding.provider';
import { EmbeddingPolicy } from '../../apps/api/src/modules/embedding/domain/embedding.policy';

describe('EmbedSnapshotArtifactsUseCase', () => {
  let useCase: EmbedSnapshotArtifactsUseCase;
  let artifactRepoMock: any;
  let chunkRepoMock: any;
  let prismaMock: any;
  let provider: FakeEmbeddingProvider;

  const SNAPSHOT = {
    id: 'snap-1',
    repository: { projectId: 'proj-1' },
    repositoryId: 'repo-1',
    commitSha: 'sha-1',
  };

  const ARTIFACT = {
    id: 'art-1',
    artifactKey: 'src/index.ts::func1',
    artifactType: 'FILE',
    name: 'index.ts',
    filePath: 'src/index.ts',
  };

  beforeEach(() => {
    artifactRepoMock = { listBySnapshot: jest.fn() };
    chunkRepoMock = {
      listBySnapshot: jest.fn(),
      insertMany: jest.fn(),
    };
    prismaMock = {
      repositorySnapshot: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    provider = new FakeEmbeddingProvider();

    useCase = new EmbedSnapshotArtifactsUseCase(
      artifactRepoMock,
      chunkRepoMock,
      provider,
      prismaMock,
    );
  });

  it('should throw error if snapshot not found', async () => {
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue(null);
    await expect(useCase.execute({ snapshotId: 'snap-1' })).rejects.toThrow('Snapshot not found');
  });

  it('should transition to VECTOR_READY if no artifacts exist', async () => {
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue(SNAPSHOT);
    artifactRepoMock.listBySnapshot.mockResolvedValue([]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(prismaMock.repositorySnapshot.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'snap-1' },
      data: { indexStatus: 'VECTOR_INDEXING' },
    });
    expect(prismaMock.repositorySnapshot.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'snap-1' },
      data: { indexStatus: 'VECTOR_READY' },
    });
    expect(chunkRepoMock.insertMany as jest.Mock).not.toHaveBeenCalled();
  });

  it('should skip embedding for unchanged artifacts (stableChunkId cache hit)', async () => {
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue(SNAPSHOT);
    artifactRepoMock.listBySnapshot.mockResolvedValue([ARTIFACT]);

    const content = EmbeddingPolicy.buildArtifactContent(ARTIFACT);
    const contentHash = EmbeddingPolicy.computeContentHash(content);
    const stableChunkId = `artifact:${ARTIFACT.artifactKey}:${contentHash}`;

    // Existing chunk matches stableChunkId + contentHash → skip
    chunkRepoMock.listBySnapshot.mockResolvedValue([{ stableChunkId, contentHash }]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(chunkRepoMock.insertMany as jest.Mock).not.toHaveBeenCalled();
    expect(prismaMock.repositorySnapshot.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'snap-1' },
      data: { indexStatus: 'VECTOR_READY' },
    });
  });

  it('should re-embed when artifact content changed (stableChunkId exists but contentHash differs)', async () => {
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue(SNAPSHOT);
    artifactRepoMock.listBySnapshot.mockResolvedValue([ARTIFACT]);

    const content = EmbeddingPolicy.buildArtifactContent(ARTIFACT);
    const contentHash = EmbeddingPolicy.computeContentHash(content);
    const stableChunkId = `artifact:${ARTIFACT.artifactKey}:${contentHash}`;

    // Existing chunk has same stableChunkId but DIFFERENT contentHash → re-embed
    chunkRepoMock.listBySnapshot.mockResolvedValue([
      { stableChunkId, contentHash: 'old-hash-different' },
    ]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(chunkRepoMock.insertMany as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('should embed new artifacts with tenantId=projectId and correct stableChunkId format', async () => {
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue(SNAPSHOT);
    artifactRepoMock.listBySnapshot.mockResolvedValue([ARTIFACT]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]); // No existing cache

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(chunkRepoMock.insertMany as jest.Mock).toHaveBeenCalledTimes(1);
    const insertedChunks = chunkRepoMock.insertMany.mock.calls[0][0];
    expect(insertedChunks).toHaveLength(1);

    const chunk = insertedChunks[0];
    expect(chunk).toMatchObject({
      tenantId: 'proj-1',        // MVP: tenantId = projectId
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      snapshotId: 'snap-1',
      artifactId: 'art-1',
      commitSha: 'sha-1',
      filePath: 'src/index.ts',
      artifactType: 'FILE',
      embeddingModel: 'fake-embedding',
    });
    // stableChunkId follows pattern "artifact:<artifactKey>:<contentHash>"
    expect(chunk.stableChunkId).toMatch(/^artifact:src\/index\.ts::func1:/);
    expect(chunk.embedding).toHaveLength(1536);

    expect(prismaMock.repositorySnapshot.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'snap-1' },
      data: { indexStatus: 'VECTOR_READY' },
    });
  });

  it('should transition to VECTOR_FAILED and re-throw if embedding throws', async () => {
    prismaMock.repositorySnapshot.findUnique.mockResolvedValue(SNAPSHOT);
    artifactRepoMock.listBySnapshot.mockResolvedValue([ARTIFACT]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);

    jest.spyOn(provider, 'embed').mockRejectedValue(new Error('API Down'));

    await expect(useCase.execute({ snapshotId: 'snap-1' })).rejects.toThrow('API Down');

    expect(prismaMock.repositorySnapshot.update as jest.Mock).toHaveBeenCalledWith({
      where: { id: 'snap-1' },
      data: { indexStatus: 'VECTOR_FAILED' },
    });
  });
});
