export type CurrentHybridExportMode =
  | 'CASE_ONLY'
  | 'CURRENT_HYBRID_SMOKE'
  | 'CURRENT_HYBRID_BENCHMARK';

export type CurrentHybridExportGuardInput = {
  caseRepo: string;
  caseBaseSha?: string | null;
  repositoryIdentity?: string | null;
  snapshotCommitSha?: string | null;
  snapshotIndexStatus?: string | null;
  chunkCount: number;
  embeddingModels: readonly string[];
  queryProviderName?: string | null;
  queryEmbeddingModel?: string | null;
  allowRealQueryEmbedding: boolean;
  isSmokeMode: boolean;
};

export type CurrentHybridExportGuardResult = {
  allowed: boolean;
  mode: CurrentHybridExportMode;
  blockers: string[];
  warnings: string[];
};

export function getCurrentHybridOutputTargets(
  mode: CurrentHybridExportMode,
): { json: string; markdown: string } {
  return mode === 'CURRENT_HYBRID_BENCHMARK'
    ? {
        json: 'evaluation/results/rag-samples.current-hybrid.v0.json',
        markdown: 'evaluation/results/rag-samples.current-hybrid.v0.md',
      }
    : {
        json: 'evaluation/results/rag-samples.current-hybrid.smoke.v0.json',
        markdown: 'evaluation/results/rag-samples.current-hybrid.smoke.v0.md',
      };
}

function normalizeRepoIdentity(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .replace(/\.git$/i, '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^github\.com\//i, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }

  return normalized;
}

function hasOnlyFakeArtifactEmbeddings(embeddingModels: readonly string[]): boolean {
  const normalized = embeddingModels
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return normalized.length > 0 && normalized.every((value) => value === 'fake-embedding');
}

function isFakeQueryProvider(providerName: string | null | undefined): boolean {
  return (providerName ?? '').trim().toLowerCase().includes('fake');
}

export function evaluateCurrentHybridExportGuard(
  input: CurrentHybridExportGuardInput,
): CurrentHybridExportGuardResult {
  if (input.isSmokeMode) {
    return {
      allowed: true,
      mode: 'CURRENT_HYBRID_SMOKE',
      blockers: [],
      warnings: [
        'CURRENT_HYBRID smoke mode is not benchmark evidence.',
        'Smoke mode must not write benchmark-named output files.',
      ],
    };
  }

  const blockers: string[] = [];
  const warnings: string[] = [];

  const normalizedCaseRepo = normalizeRepoIdentity(input.caseRepo);
  const normalizedRepositoryIdentity = normalizeRepoIdentity(input.repositoryIdentity);

  if (
    normalizedCaseRepo &&
    normalizedRepositoryIdentity &&
    normalizedCaseRepo !== normalizedRepositoryIdentity
  ) {
    blockers.push(
      `Repository mismatch: case.repo=${input.caseRepo} but snapshot repository identity=${input.repositoryIdentity}.`,
    );
  } else if (!normalizedRepositoryIdentity) {
    warnings.push('Repository identity could not be normalized for a strict repo match check.');
  }

  const normalizedCaseBaseSha = (input.caseBaseSha ?? '').trim();
  const normalizedSnapshotCommitSha = (input.snapshotCommitSha ?? '').trim();

  if (
    normalizedCaseBaseSha.length === 0 ||
    normalizedSnapshotCommitSha.length === 0
  ) {
    blockers.push('case.baseSha and snapshot.commitSha are both required for benchmark alignment.');
  } else if (normalizedCaseBaseSha !== normalizedSnapshotCommitSha) {
    blockers.push(
      `Snapshot alignment failed: case.baseSha=${normalizedCaseBaseSha} but snapshot.commitSha=${normalizedSnapshotCommitSha}.`,
    );
  }

  if ((input.snapshotIndexStatus ?? '').trim() !== 'VECTOR_READY') {
    blockers.push(
      `Snapshot must be VECTOR_READY for benchmark mode. Received: ${input.snapshotIndexStatus ?? 'UNKNOWN'}.`,
    );
  }

  if (input.chunkCount <= 0) {
    blockers.push('Persisted EmbeddingChunk rows are required for benchmark mode.');
  }

  if (hasOnlyFakeArtifactEmbeddings(input.embeddingModels)) {
    blockers.push('Artifact embedding model is fake-embedding only. Benchmark mode requires real persisted embeddings.');
  }

  if (isFakeQueryProvider(input.queryProviderName)) {
    blockers.push('Fake query embedding providers are not allowed in benchmark mode.');
  }

  if ((input.queryEmbeddingModel ?? '').trim().length === 0) {
    blockers.push('queryEmbeddingModel is required for benchmark provenance.');
  }

  if (!input.allowRealQueryEmbedding) {
    blockers.push('Benchmark mode requires REQIMPACT_ALLOW_REAL_QUERY_EMBEDDING=1.');
  }

  return {
    allowed: blockers.length === 0,
    mode: 'CURRENT_HYBRID_BENCHMARK',
    blockers,
    warnings,
  };
}
