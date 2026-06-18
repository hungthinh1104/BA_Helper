import {
  buildCaseSnapshotAlignmentRegistry,
  type DbReadinessCandidate,
  evaluateCaseSnapshotAlignment,
} from './case-snapshot-alignment';
import { loadDataset } from '../io';

describe('case snapshot alignment', () => {
  function candidate(
    overrides: Partial<DbReadinessCandidate> = {},
  ): DbReadinessCandidate {
    return {
      projectId: 'project-1',
      repositoryId: 'repo-1',
      snapshotId: 'snapshot-1',
      commitSha: 'abc123',
      indexStatus: 'VECTOR_READY',
      chunkCount: 10,
      embeddingProfileIds: ['google-gemini-001-1536'],
      embeddingProviders: ['google'],
      embeddingModels: ['gemini-embedding-001'],
      embeddingDimensions: [1536],
      embeddingConfigHashes: ['config-hash-google'],
      chunkerVersions: ['artifact-chunker@0.1.0'],
      classification: 'VECTOR_READY_CANDIDATE',
      usableFor: ['CURRENT_HYBRID_EXPORT'],
      warnings: [],
      ...overrides,
    };
  }

  it('marks all cases as SNAPSHOT_MISSING when no mappings exist', () => {
    const datasetCaseCount = loadDataset('evaluation/datasets/cases.v0.json').cases.length;
    const registry = buildCaseSnapshotAlignmentRegistry({
      datasetPath: 'evaluation/datasets/cases.v0.json',
      dbReadinessPath: 'evaluation/results/does-not-exist.json',
      overridesPath: 'evaluation/datasets/does-not-exist.json',
      generatedAt: '2026-06-18T00:00:00.000Z',
    });

    expect(registry.caseCount).toBe(datasetCaseCount);
    expect(registry.snapshotMissingCount).toBe(datasetCaseCount);
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
      candidate: candidate(),
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
      candidate: candidate({
        indexStatus: 'NOT_INDEXED',
        chunkCount: 0,
        embeddingProfileIds: [],
        embeddingProviders: [],
        embeddingModels: [],
        embeddingDimensions: [],
        embeddingConfigHashes: [],
        chunkerVersions: [],
        classification: 'LEXICAL_ONLY_CANDIDATE',
      }),
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
      candidate: candidate({
        commitSha: 'wrong',
      }),
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
      candidate: candidate(),
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
      candidate: candidate({
        embeddingProfileIds: ['fake-1536'],
        embeddingProviders: ['fake'],
        embeddingModels: ['fake-embedding'],
        embeddingConfigHashes: ['config-hash-fake'],
      }),
    });

    expect(item.status).toBe('ALIGNED_LEXICAL_ONLY');
  });

  it('requires mapping embeddingProfileId to exist in readiness candidate', () => {
    const item = evaluateCaseSnapshotAlignment({
      caseId: 'case-1',
      repo: 'ndmen/booking',
      baseSha: 'abc123',
      mapping: {
        caseId: 'case-1',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        snapshotId: 'snapshot-1',
        embeddingProfileId: 'openai-3-small-1536',
      },
      candidate: candidate(),
    });

    expect(item.status).toBe('ALIGNED_LEXICAL_ONLY');
    expect(item.requiredNextAction).toMatch(/selected embedding profile/i);
  });
});
