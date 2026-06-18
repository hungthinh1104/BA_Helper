import {
  evaluateCurrentHybridExportGuard,
  getCurrentHybridOutputTargets,
} from './current-hybrid-export-guard';

describe('current hybrid export guard', () => {
  const baseInput = {
    caseRepo: 'ndmen/booking',
    caseBaseSha: 'abc123',
    repositoryIdentity: 'https://github.com/ndmen/booking',
    snapshotCommitSha: 'abc123',
    snapshotIndexStatus: 'VECTOR_READY',
    chunkCount: 31,
    embeddingProfileIds: ['google-gemini-001-1536'],
    embeddingModels: ['gemini-embedding-001'],
    embeddingConfigHashes: ['config-hash-google'],
    queryProviderName: 'google',
    queryEmbeddingModel: 'gemini-embedding-001',
    allowRealQueryEmbedding: true,
    isSmokeMode: false,
  } as const;

  it('rejects case baseSha mismatch', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      caseBaseSha: 'wrong',
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/case\.baseSha/i);
  });

  it('rejects fake query provider', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      queryProviderName: 'fake',
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/fake query embedding providers/i);
  });

  it('rejects missing allow flag', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      allowRealQueryEmbedding: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/REQIMPACT_ALLOW_REAL_QUERY_EMBEDDING=1/i);
  });

  it('rejects fake artifact embedding model', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      embeddingModels: ['fake-embedding'],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/fake-embedding/i);
  });

  it('rejects legacy artifact embeddings without profile provenance', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      embeddingProfileIds: [],
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/embeddingProfileId and embeddingConfigHash provenance/i);
  });

  it('rejects non vector ready snapshots', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      snapshotIndexStatus: 'NOT_INDEXED',
    });

    expect(result.allowed).toBe(false);
    expect(result.blockers.join('\n')).toMatch(/VECTOR_READY/i);
  });

  it('allows fully aligned real benchmark config', () => {
    const result = evaluateCurrentHybridExportGuard(baseInput);

    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('CURRENT_HYBRID_BENCHMARK');
    expect(result.blockers).toEqual([]);
  });

  it('smoke mode cannot be mistaken for benchmark mode', () => {
    const result = evaluateCurrentHybridExportGuard({
      ...baseInput,
      isSmokeMode: true,
      allowRealQueryEmbedding: false,
      queryProviderName: 'fake',
      queryEmbeddingModel: 'fake-embedding',
    });

    expect(result.allowed).toBe(true);
    expect(result.mode).toBe('CURRENT_HYBRID_SMOKE');
    expect(result.warnings.join('\n')).toMatch(/must not write benchmark-named output files/i);
  });

  it('smoke mode resolves smoke-labeled output targets only', () => {
    const targets = getCurrentHybridOutputTargets('CURRENT_HYBRID_SMOKE');

    expect(targets.json).toContain('.smoke.');
    expect(targets.json).not.toBe('evaluation/results/rag-samples.current-hybrid.v0.json');
  });
});
