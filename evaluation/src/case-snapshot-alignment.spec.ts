import {
  buildCaseSnapshotAlignmentRegistry,
  evaluateCaseSnapshotAlignment,
} from './case-snapshot-alignment';

describe('case snapshot alignment', () => {
  it('marks all cases as SNAPSHOT_MISSING when no mappings exist', () => {
    const registry = buildCaseSnapshotAlignmentRegistry({
      datasetPath: 'evaluation/datasets/cases.v0.json',
      dbReadinessPath: 'evaluation/results/does-not-exist.json',
      overridesPath: 'evaluation/datasets/does-not-exist.json',
      generatedAt: '2026-06-18T00:00:00.000Z',
    });

    expect(registry.caseCount).toBe(5);
    expect(registry.snapshotMissingCount).toBe(5);
    expect(registry.cases.every((item) => item.status === 'SNAPSHOT_MISSING')).toBe(true);
  });

  it('returns ALIGNED_VECTOR_READY for matching commit with real vectors', () => {
    const item = evaluateCaseSnapshotAlignment({
      caseId: 'case-1',
      repo: 'ndmen/booking',
      baseSha: 'abc123',
      mapping: {
        caseId: 'case-1',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
      },
      candidate: {
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        commitSha: 'abc123',
        indexStatus: 'VECTOR_READY',
        chunkCount: 10,
        embeddingModels: ['gemini-embedding-001'],
        chunkerVersions: ['artifact-chunker@0.1.0'],
        classification: 'VECTOR_READY_CANDIDATE',
        usableFor: ['CURRENT_HYBRID_EXPORT'],
        warnings: [],
      },
    });

    expect(item.status).toBe('ALIGNED_VECTOR_READY');
  });

  it('returns ALIGNED_LEXICAL_ONLY for matching commit without usable vectors', () => {
    const item = evaluateCaseSnapshotAlignment({
      caseId: 'case-1',
      repo: 'ndmen/booking',
      baseSha: 'abc123',
      mapping: {
        caseId: 'case-1',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
      },
      candidate: {
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        commitSha: 'abc123',
        indexStatus: 'NOT_INDEXED',
        chunkCount: 0,
        embeddingModels: [],
        chunkerVersions: [],
        classification: 'LEXICAL_ONLY_CANDIDATE',
        usableFor: ['CURRENT_HYBRID_EXPORT'],
        warnings: [],
      },
    });

    expect(item.status).toBe('ALIGNED_LEXICAL_ONLY');
  });

  it('returns SNAPSHOT_COMMIT_MISMATCH for mismatched commit', () => {
    const item = evaluateCaseSnapshotAlignment({
      caseId: 'case-1',
      repo: 'ndmen/booking',
      baseSha: 'abc123',
      mapping: {
        caseId: 'case-1',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
      },
      candidate: {
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        commitSha: 'wrong',
        indexStatus: 'VECTOR_READY',
        chunkCount: 10,
        embeddingModels: ['gemini-embedding-001'],
        chunkerVersions: ['artifact-chunker@0.1.0'],
        classification: 'VECTOR_READY_CANDIDATE',
        usableFor: ['CURRENT_HYBRID_EXPORT'],
        warnings: [],
      },
    });

    expect(item.status).toBe('SNAPSHOT_COMMIT_MISMATCH');
  });

  it('returns REPO_MISMATCH when mapping notes indicate another repo identity', () => {
    const item = evaluateCaseSnapshotAlignment({
      caseId: 'case-1',
      repo: 'ndmen/booking',
      baseSha: 'abc123',
      mapping: {
        caseId: 'case-1',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        notes: 'lujakob/nestjs-realworld-example-app',
      },
      candidate: {
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        commitSha: 'abc123',
        indexStatus: 'VECTOR_READY',
        chunkCount: 10,
        embeddingModels: ['gemini-embedding-001'],
        chunkerVersions: ['artifact-chunker@0.1.0'],
        classification: 'VECTOR_READY_CANDIDATE',
        usableFor: ['CURRENT_HYBRID_EXPORT'],
        warnings: [],
      },
    });

    expect(item.status).toBe('REPO_MISMATCH');
  });

  it('prevents fake embedding models from becoming ALIGNED_VECTOR_READY', () => {
    const item = evaluateCaseSnapshotAlignment({
      caseId: 'case-1',
      repo: 'ndmen/booking',
      baseSha: 'abc123',
      mapping: {
        caseId: 'case-1',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
      },
      candidate: {
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        commitSha: 'abc123',
        indexStatus: 'VECTOR_READY',
        chunkCount: 10,
        embeddingModels: ['fake-embedding'],
        chunkerVersions: ['artifact-chunker@0.1.0'],
        classification: 'VECTOR_READY_CANDIDATE',
        usableFor: ['CURRENT_HYBRID_EXPORT'],
        warnings: [],
      },
    });

    expect(item.status).toBe('ALIGNED_LEXICAL_ONLY');
  });
});
