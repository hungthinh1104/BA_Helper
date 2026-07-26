import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EmbedSnapshotArtifactsUseCase } from '@ba-helper/application';
import { FakeEmbeddingProvider } from '@ba-helper/backend-runtime';
import { ArtifactChunkBuilder, CHUNK_BUILDER_VERSION } from '@ba-helper/application';
import { createHash } from 'node:crypto';

const SNAPSHOT_NO_PLAN = {
  id: 'snap-1',
  repository: { projectId: 'proj-1' },
  repositoryId: 'repo-1',
  commitSha: 'sha-1',
  diagnostics: [], // no EMBEDDING_REUSE_PLAN → no reuse attempted
};

const ARTIFACT = {
  id: 'art-1',
  snapshotId: 'snap-1',
  artifactKey: 'src/index.ts::func1',
  artifactType: 'SERVICE_METHOD',
  name: 'index.ts',
  filePath: 'src/index.ts',
  contentHash: 'artifact-hash-1',
  evidences: [{ excerpt: 'const x = 1;' }],
};

function makeChunkRepoMock() {
  return {
    listBySnapshot: jest.fn<any>().mockResolvedValue([]),
    insertMany: jest.fn<any>().mockResolvedValue(undefined),
    listForReuseByArtifacts: jest.fn<any>().mockResolvedValue([]),
    copyChunk: jest.fn<any>().mockResolvedValue(true),
  };
}

function makeUseCase(chunkRepoMock: any, snapshotRepoMock: any, provider?: FakeEmbeddingProvider) {
  return new EmbedSnapshotArtifactsUseCase(
    chunkRepoMock,
    provider ?? new FakeEmbeddingProvider(),
    snapshotRepoMock,
  );
}

describe('EmbedSnapshotArtifactsUseCase', () => {
  let chunkRepoMock: ReturnType<typeof makeChunkRepoMock>;
  let snapshotRepoMock: any;
  let useCase: EmbedSnapshotArtifactsUseCase;
  let provider: FakeEmbeddingProvider;

  beforeEach(() => {
    chunkRepoMock = makeChunkRepoMock();
    snapshotRepoMock = {
      findSnapshotById: jest.fn<any>(),
      findArtifactsWithEvidenceBySnapshot: jest.fn<any>(),
      updateSnapshotIndexStatus: jest.fn<any>(),
      findPreviousArtifactsBySnapshot: jest.fn<any>(),
      updateSnapshotDiagnostics: jest.fn<any>(),
      markSnapshotFailed: jest.fn<any>(),
    };
    provider = new FakeEmbeddingProvider();
    useCase = makeUseCase(chunkRepoMock, snapshotRepoMock, provider);
  });

  // ── Basic lifecycle ──────────────────────────────────────────────────────

  it('throws SNAPSHOT_NOT_FOUND if snapshot missing', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(null);
    await expect(useCase.execute({ snapshotId: 'snap-1' })).rejects.toThrow('Snapshot not found');
  });

  it('transitions to VECTOR_READY if no artifacts exist', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(SNAPSHOT_NO_PLAN);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(snapshotRepoMock.updateSnapshotIndexStatus).toHaveBeenCalledWith('snap-1', 'VECTOR_INDEXING');
    expect(snapshotRepoMock.updateSnapshotIndexStatus).toHaveBeenCalledWith('snap-1', 'VECTOR_READY');
    expect(chunkRepoMock.insertMany).not.toHaveBeenCalled();
  });

  it('skips embedding when stableChunkId+contentHash cache hit (idempotent re-run)', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(SNAPSHOT_NO_PLAN);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);

    const built = ArtifactChunkBuilder.build({ artifact: ARTIFACT as any, evidence: ARTIFACT.evidences as any });
    const contentHash = createHash('sha256').update(built.content).digest('hex');
    chunkRepoMock.listBySnapshot.mockResolvedValue([{ stableChunkId: built.stableChunkId, contentHash }]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(chunkRepoMock.insertMany).not.toHaveBeenCalled();
    expect(snapshotRepoMock.updateSnapshotIndexStatus).toHaveBeenCalledWith('snap-1', 'VECTOR_READY');
  });

  it('re-embeds when contentHash differs (artifact changed)', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(SNAPSHOT_NO_PLAN);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);

    const built = ArtifactChunkBuilder.build({ artifact: ARTIFACT as any, evidence: ARTIFACT.evidences as any });
    chunkRepoMock.listBySnapshot.mockResolvedValue([
      { stableChunkId: built.stableChunkId, contentHash: 'old-hash' },
    ]);

    await useCase.execute({ snapshotId: 'snap-1' });
    expect(chunkRepoMock.insertMany).toHaveBeenCalledTimes(1);
  });

  it('embeds new artifact with correct fields (tenantId=projectId, correct stableChunkId)', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(SNAPSHOT_NO_PLAN);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);

    await useCase.execute({ snapshotId: 'snap-1' });

    const inserted = chunkRepoMock.insertMany.mock.calls[0][0] as any[];
    expect(inserted[0]).toMatchObject({
      tenantId: 'proj-1',
      projectId: 'proj-1',
      repositoryId: 'repo-1',
      snapshotId: 'snap-1',
      artifactId: 'art-1',
      commitSha: 'sha-1',
      filePath: 'src/index.ts',
      chunkerVersion: CHUNK_BUILDER_VERSION,
    });
    expect(inserted[0].stableChunkId).toBe('snap-1:src/index.ts::func1:METHOD_BODY');
    expect(inserted[0].embedding).toHaveLength(1536);
  });

  it('transitions to VECTOR_FAILED and re-throws on embedding error', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(SNAPSHOT_NO_PLAN);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);
    jest.spyOn(provider, 'embed').mockRejectedValue(new Error('API Down'));

    await expect(useCase.execute({ snapshotId: 'snap-1' })).rejects.toThrow('API Down');
    expect(snapshotRepoMock.markSnapshotFailed).toHaveBeenCalledWith('snap-1');
  });

  // ── Reuse path ───────────────────────────────────────────────────────────

  it('copies eligible chunk and does not call embed for it', async () => {
    const built = ArtifactChunkBuilder.build({ artifact: ARTIFACT as any, evidence: ARTIFACT.evidences as any });
    const contentHash = createHash('sha256').update(built.content).digest('hex');

    const snapshotWithPlan = {
      ...SNAPSHOT_NO_PLAN,
      diagnostics: [
        {
          code: 'EMBEDDING_REUSE_PLAN',
          payload: {
            baseSnapshotId: 'snap-base',
            targetSnapshotId: 'snap-1',
            reuseMode: 'PLAN_ONLY',
            reuseSafety: 'SAFE_FOR_FUTURE_REUSE',
            eligibleArtifactCount: 1,
            ineligibleArtifactCount: 0,
            eligibleRatio: 1,
            ineligibleReasons: { addedArtifactCount: 0, changedArtifactCount: 0, removedArtifactCount: 0, hashUnavailableArtifactCount: 0, versionChangedBlockedCount: 0 },
            sampleLimit: 20,
            samples: { eligible: [], ineligible: [] },
          },
        },
      ],
    };

    snapshotRepoMock.findSnapshotById.mockResolvedValue(snapshotWithPlan);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    snapshotRepoMock.findPreviousArtifactsBySnapshot.mockResolvedValue([{ id: 'old-art-1', artifactKey: ARTIFACT.artifactKey, contentHash: 'artifact-hash-1' }]);

    chunkRepoMock.listBySnapshot.mockResolvedValue([]); // nothing cached for new snapshot
    chunkRepoMock.listForReuseByArtifacts.mockResolvedValue([
      {
        artifactId: 'old-art-1',
        contentHash,
        chunkerVersion: CHUNK_BUILDER_VERSION,
        embeddingModel: 'fake',
      },
    ]);
    chunkRepoMock.copyChunk.mockResolvedValue(true);

    const embedSpy = jest.spyOn(provider, 'embed');
    await useCase.execute({ snapshotId: 'snap-1' });

    expect(chunkRepoMock.copyChunk).toHaveBeenCalledTimes(1);
    const copyCall = chunkRepoMock.copyChunk.mock.calls[0][0] as any;
    expect(copyCall.baseSnapshotId).toBe('snap-base');
    expect(copyCall.targetSnapshotId).toBe('snap-1');
    expect(copyCall.newArtifactId).toBe('art-1');         // current artifactId
    expect(copyCall.newStableChunkId).toBe(built.stableChunkId); // current stableChunkId
    expect(copyCall.oldArtifactId).toBe('old-art-1');    // previous artifactId
    expect(embedSpy).not.toHaveBeenCalled();             // no API call for reused chunk
  });

  it('copied chunk uses current snapshotId and current artifactId, not old ones', async () => {
    const built = ArtifactChunkBuilder.build({ artifact: ARTIFACT as any, evidence: ARTIFACT.evidences as any });
    const contentHash = createHash('sha256').update(built.content).digest('hex');

    const snapshotWithPlan = {
      ...SNAPSHOT_NO_PLAN,
      diagnostics: [{ code: 'EMBEDDING_REUSE_PLAN', payload: { baseSnapshotId: 'old-snap', targetSnapshotId: 'snap-1', reuseMode: 'PLAN_ONLY', reuseSafety: 'SAFE_FOR_FUTURE_REUSE', eligibleArtifactCount: 1, ineligibleArtifactCount: 0, eligibleRatio: 1, ineligibleReasons: { addedArtifactCount: 0, changedArtifactCount: 0, removedArtifactCount: 0, hashUnavailableArtifactCount: 0, versionChangedBlockedCount: 0 }, sampleLimit: 20, samples: { eligible: [], ineligible: [] } } }],
    };
    snapshotRepoMock.findSnapshotById.mockResolvedValue(snapshotWithPlan);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    snapshotRepoMock.findPreviousArtifactsBySnapshot.mockResolvedValue([{ id: 'old-art-1', artifactKey: ARTIFACT.artifactKey, contentHash: 'artifact-hash-1' }]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);
    chunkRepoMock.listForReuseByArtifacts.mockResolvedValue([{
      artifactId: 'old-art-1', contentHash, chunkerVersion: CHUNK_BUILDER_VERSION, embeddingModel: 'fake',
    }]);

    await useCase.execute({ snapshotId: 'snap-1' });
    const copyCall = chunkRepoMock.copyChunk.mock.calls[0][0] as any;

    expect(copyCall.targetSnapshotId).toBe('snap-1');  // copied row uses target snapshotId
    expect(copyCall.targetSnapshotId).not.toBe('old-snap'); // does not preserve old snapshotId
    expect(copyCall.newArtifactId).toBe('art-1');      // copied row uses current artifactId
    expect(copyCall.newArtifactId).not.toBe('old-art-1'); // does not preserve old artifactId
    expect(copyCall.newStableChunkId).toBe(built.stableChunkId); // copied row uses current stableChunkId
    expect(copyCall.oldArtifactId).toBe('old-art-1'); // old used only as source
    expect(copyCall).not.toHaveProperty('diagnostics'); // does not copy diagnostics
    expect(copyCall).not.toHaveProperty('evidence');    // does not copy evidence
    expect(copyCall).not.toHaveProperty('traceability'); // does not copy traceability data
  });

  it('falls back to generation when copyChunk returns false (source missing)', async () => {
    const built = ArtifactChunkBuilder.build({ artifact: ARTIFACT as any, evidence: ARTIFACT.evidences as any });
    const contentHash = createHash('sha256').update(built.content).digest('hex');

    const snapshotWithPlan = {
      ...SNAPSHOT_NO_PLAN,
      diagnostics: [{ code: 'EMBEDDING_REUSE_PLAN', payload: { baseSnapshotId: 'old-snap', targetSnapshotId: 'snap-1', reuseMode: 'PLAN_ONLY', reuseSafety: 'SAFE_FOR_FUTURE_REUSE', eligibleArtifactCount: 1, ineligibleArtifactCount: 0, eligibleRatio: 1, ineligibleReasons: { addedArtifactCount: 0, changedArtifactCount: 0, removedArtifactCount: 0, hashUnavailableArtifactCount: 0, versionChangedBlockedCount: 0 }, sampleLimit: 20, samples: { eligible: [], ineligible: [] } } }],
    };
    snapshotRepoMock.findSnapshotById.mockResolvedValue(snapshotWithPlan);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    snapshotRepoMock.findPreviousArtifactsBySnapshot.mockResolvedValue([{ id: 'old-art-1', artifactKey: ARTIFACT.artifactKey, contentHash: 'artifact-hash-1' }]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);
    chunkRepoMock.listForReuseByArtifacts.mockResolvedValue([{
      artifactId: 'old-art-1', contentHash, chunkerVersion: CHUNK_BUILDER_VERSION, embeddingModel: 'fake',
    }]);
    chunkRepoMock.copyChunk.mockResolvedValue(false); // source missing → fallback

    const embedSpy = jest.spyOn(provider, 'embed');
    await useCase.execute({ snapshotId: 'snap-1' });

    expect(embedSpy).toHaveBeenCalledTimes(1); // generation used as fallback
    expect(chunkRepoMock.insertMany).toHaveBeenCalledTimes(1);
  });

  it('does not attempt reuse when VERSION_CHANGED_REVIEW_REQUIRED', async () => {
    const snapshotWithVersionBlock = {
      ...SNAPSHOT_NO_PLAN,
      diagnostics: [{ code: 'EMBEDDING_REUSE_PLAN', payload: { baseSnapshotId: 'old-snap', targetSnapshotId: 'snap-1', reuseMode: 'PLAN_ONLY', reuseSafety: 'VERSION_CHANGED_REVIEW_REQUIRED', eligibleArtifactCount: 0, ineligibleArtifactCount: 1, eligibleRatio: 0, ineligibleReasons: { addedArtifactCount: 0, changedArtifactCount: 0, removedArtifactCount: 0, hashUnavailableArtifactCount: 0, versionChangedBlockedCount: 1 }, sampleLimit: 20, samples: { eligible: [], ineligible: [] } } }],
    };
    snapshotRepoMock.findSnapshotById.mockResolvedValue(snapshotWithVersionBlock);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(chunkRepoMock.copyChunk).not.toHaveBeenCalled();
    expect(chunkRepoMock.insertMany).toHaveBeenCalledTimes(1); // generation still runs
  });

  it('persists EMBEDDING_REUSE_EXECUTION_SUMMARY diagnostic on snapshot', async () => {
    snapshotRepoMock.findSnapshotById.mockResolvedValue(SNAPSHOT_NO_PLAN);
    snapshotRepoMock.findArtifactsWithEvidenceBySnapshot.mockResolvedValue([ARTIFACT]);
    chunkRepoMock.listBySnapshot.mockResolvedValue([]);

    await useCase.execute({ snapshotId: 'snap-1' });

    expect(snapshotRepoMock.updateSnapshotDiagnostics).toHaveBeenCalled();
    const payload = snapshotRepoMock.updateSnapshotDiagnostics.mock.calls[0][2][0].payload;
    expect(payload.mode).toBe('SNAPSHOT_SCOPED_COPY');
    expect(payload.samples).toHaveProperty('copied');
    expect(payload.samples).toHaveProperty('generated');
    expect(payload.samples).toHaveProperty('blocked');
    expect(payload.copiedChunkCount).toBeGreaterThanOrEqual(0);
    expect(payload.generatedChunkCount).toBeGreaterThanOrEqual(0);
    expect(payload.versionBlockedChunkCount).toBeGreaterThanOrEqual(0);
  });
});
