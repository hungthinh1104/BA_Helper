import {
  buildDbSnapshotReadinessReport,
  classifySnapshotCandidate,
  probeDbSnapshotReadiness,
  renderDbSnapshotReadinessMarkdown,
} from './db-snapshot-readiness';

describe('db snapshot readiness', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('returns NO_DATABASE_URL and does not inspect the DB when DATABASE_URL is missing', async () => {
    delete process.env.DATABASE_URL;
    const inspectDb = jest.fn();

    const report = await probeDbSnapshotReadiness({ inspectDb });

    expect(report.status).toBe('NO_DATABASE_URL');
    expect(report.database.inspectedReadOnly).toBe(false);
    expect(inspectDb).not.toHaveBeenCalled();
  });

  it('classifies VECTOR_READY snapshots with chunks, model, and chunker version', () => {
    const candidate = classifySnapshotCandidate({
      projectId: 'project-1',
      repositoryId: 'repo-1',
      snapshotId: 'snapshot-1',
      commitSha: 'abc123',
      indexStatus: 'VECTOR_READY',
      chunkCount: 4,
      embeddingModels: ['text-embedding-004'],
      chunkerVersions: ['artifact-chunker@1'],
    });

    expect(candidate.classification).toBe('VECTOR_READY_CANDIDATE');
    expect(candidate.usableFor).toEqual([
      'VECTOR_BASELINE',
      'CURRENT_HYBRID_EXPORT',
    ]);
  });

  it('classifies chunkless snapshots as lexical-only candidates', () => {
    const candidate = classifySnapshotCandidate({
      projectId: 'project-1',
      repositoryId: 'repo-1',
      snapshotId: 'snapshot-1',
      commitSha: 'abc123',
      indexStatus: 'LEXICAL_READY',
      chunkCount: 0,
      embeddingModels: [],
      chunkerVersions: [],
    });

    expect(candidate.classification).toBe('LEXICAL_ONLY_CANDIDATE');
    expect(candidate.usableFor).toEqual(['CURRENT_HYBRID_EXPORT']);
  });

  it('treats missing embedding metadata as NOT_READY', () => {
    const candidate = classifySnapshotCandidate({
      projectId: 'project-1',
      repositoryId: 'repo-1',
      snapshotId: 'snapshot-1',
      commitSha: 'abc123',
      indexStatus: 'VECTOR_READY',
      chunkCount: 3,
      embeddingModels: [],
      chunkerVersions: ['artifact-chunker@1'],
    });

    expect(candidate.classification).toBe('NOT_READY');
  });

  it('returns DB_UNAVAILABLE when DB inspection fails', async () => {
    process.env.DATABASE_URL = 'postgresql://example';

    const report = await probeDbSnapshotReadiness({
      inspectDb: async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      },
    });

    expect(report.status).toBe('DB_UNAVAILABLE');
    expect(report.database.errorSummary).toContain('ECONNREFUSED');
  });

  it('does not imply benchmark execution in markdown output', () => {
    const report = buildDbSnapshotReadinessReport({
      hasDatabaseUrl: false,
      inspectedReadOnly: false,
      generatedAt: '2026-06-17T12:00:00.000Z',
    });

    const markdown = renderDbSnapshotReadinessMarkdown({
      report,
      exampleCaseId: 'reqimpact-case-001',
    });

    expect(markdown).toContain('This is not a benchmark result.');
    expect(markdown).toContain('No retrieval was executed.');
    expect(markdown).toContain('No vector-baseline.v0.json was created.');
  });
});
