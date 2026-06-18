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
  embeddingProfileIds: readonly string[];
  embeddingModels: readonly string[];
  embeddingDimensions: readonly number[];
  embeddingConfigHashes: readonly string[];
  queryEmbeddingProfileId?: string | null;
  queryEmbeddingProvider?: string | null;
  queryEmbeddingModel?: string | null;
  queryEmbeddingDimensions?: number | null;
  queryEmbeddingConfigHash?: string | null;
  artifactEmbeddingProfileId?: string | null;
  artifactEmbeddingProvider?: string | null;
  artifactEmbeddingModel?: string | null;
  artifactEmbeddingDimensions?: number | null;
  artifactEmbeddingConfigHash?: string | null;
  selectedArtifactProfileChunkCount?: number | null;
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

function hasMissingArtifactProfileProvenance(
  chunkCount: number,
  embeddingProfileIds: readonly string[],
  embeddingConfigHashes: readonly string[],
): boolean {
  return chunkCount > 0 && (embeddingProfileIds.length === 0 || embeddingConfigHashes.length === 0);
}

function isFakeQueryProvider(providerName: string | null | undefined): boolean {
  return (providerName ?? '').trim().toLowerCase().includes('fake');
}

function isFakeArtifactProviderOrModel(params: {
  provider?: string | null;
  model?: string | null;
}): boolean {
  return [params.provider, params.model].some((value) =>
    (value ?? '').trim().toLowerCase().includes('fake'),
  );
}

function isBlank(value: string | null | undefined): boolean {
  return (value ?? '').trim().length === 0;
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

  if (
    hasMissingArtifactProfileProvenance(
      input.chunkCount,
      input.embeddingProfileIds,
      input.embeddingConfigHashes,
    )
  ) {
    blockers.push(
      'Artifact embeddings are legacy profile-missing rows. Benchmark mode requires embeddingProfileId and embeddingConfigHash provenance.',
    );
  }

  if (isFakeQueryProvider(input.queryEmbeddingProvider)) {
    blockers.push('Fake query embedding providers are not allowed in benchmark mode.');
  }

  if (isFakeArtifactProviderOrModel({
    provider: input.artifactEmbeddingProvider,
    model: input.artifactEmbeddingModel,
  })) {
    blockers.push('Fake artifact embedding profiles are not allowed in benchmark mode.');
  }

  if (isBlank(input.queryEmbeddingProfileId)) {
    blockers.push('queryEmbeddingProfileId is required for benchmark provenance.');
  }

  if (isBlank(input.artifactEmbeddingProfileId)) {
    blockers.push('artifactEmbeddingProfileId is required for benchmark provenance.');
  }

  if (
    !isBlank(input.queryEmbeddingProfileId) &&
    !isBlank(input.artifactEmbeddingProfileId) &&
    input.queryEmbeddingProfileId !== input.artifactEmbeddingProfileId
  ) {
    blockers.push(
      `Embedding profile mismatch: query=${input.queryEmbeddingProfileId} artifact=${input.artifactEmbeddingProfileId}.`,
    );
  }

  if (isBlank(input.queryEmbeddingProvider)) {
    blockers.push('queryEmbeddingProvider is required for benchmark provenance.');
  }

  if (isBlank(input.artifactEmbeddingProvider)) {
    blockers.push('artifactEmbeddingProvider is required for benchmark provenance.');
  }

  if (
    !isBlank(input.queryEmbeddingProvider) &&
    !isBlank(input.artifactEmbeddingProvider) &&
    input.queryEmbeddingProvider !== input.artifactEmbeddingProvider
  ) {
    blockers.push(
      `Embedding provider mismatch: query=${input.queryEmbeddingProvider} artifact=${input.artifactEmbeddingProvider}.`,
    );
  }

  if ((input.queryEmbeddingModel ?? '').trim().length === 0) {
    blockers.push('queryEmbeddingModel is required for benchmark provenance.');
  }

  if (isBlank(input.artifactEmbeddingModel)) {
    blockers.push('artifactEmbeddingModel is required for benchmark provenance.');
  }

  if (
    !isBlank(input.queryEmbeddingModel) &&
    !isBlank(input.artifactEmbeddingModel) &&
    input.queryEmbeddingModel !== input.artifactEmbeddingModel
  ) {
    blockers.push(
      `Embedding model mismatch: query=${input.queryEmbeddingModel} artifact=${input.artifactEmbeddingModel}.`,
    );
  }

  if (!input.queryEmbeddingDimensions) {
    blockers.push('queryEmbeddingDimensions is required for benchmark provenance.');
  }

  if (!input.artifactEmbeddingDimensions) {
    blockers.push('artifactEmbeddingDimensions is required for benchmark provenance.');
  }

  if (
    input.queryEmbeddingDimensions &&
    input.artifactEmbeddingDimensions &&
    input.queryEmbeddingDimensions !== input.artifactEmbeddingDimensions
  ) {
    blockers.push(
      `Embedding dimension mismatch: query=${input.queryEmbeddingDimensions} artifact=${input.artifactEmbeddingDimensions}.`,
    );
  }

  if (isBlank(input.queryEmbeddingConfigHash)) {
    blockers.push('queryEmbeddingConfigHash is required for benchmark provenance.');
  }

  if (isBlank(input.artifactEmbeddingConfigHash)) {
    blockers.push('artifactEmbeddingConfigHash is required for benchmark provenance.');
  }

  if (
    !isBlank(input.queryEmbeddingConfigHash) &&
    !isBlank(input.artifactEmbeddingConfigHash) &&
    input.queryEmbeddingConfigHash !== input.artifactEmbeddingConfigHash
  ) {
    blockers.push('Embedding config hash mismatch between query and artifact profiles.');
  }

  if (input.embeddingProfileIds.length > 1 && isBlank(input.artifactEmbeddingProfileId)) {
    blockers.push(
      'Multiple artifact embedding profiles exist; select --embeddingArtifactProfileId explicitly for benchmark mode.',
    );
  }

  if ((input.selectedArtifactProfileChunkCount ?? 0) <= 0) {
    blockers.push('Selected artifact embedding profile has zero persisted chunks.');
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
