import { existsSync } from 'fs';
import { loadDataset, readJsonFile, resolveRepoPath } from '../io';

export type CaseSnapshotAlignmentStatus =
  | 'ALIGNED_VECTOR_READY'
  | 'ALIGNED_LEXICAL_ONLY'
  | 'SNAPSHOT_MISSING'
  | 'SNAPSHOT_COMMIT_MISMATCH'
  | 'REPO_MISMATCH'
  | 'UNKNOWN';

export type CaseSnapshotOverrideMapping = {
  caseId: string;
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  notes?: string;
};

export type CaseSnapshotOverridesFile = {
  mappings: CaseSnapshotOverrideMapping[];
};

export type DbReadinessCandidate = {
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  commitSha: string;
  indexStatus: string | null;
  chunkCount: number;
  embeddingModels: string[];
  chunkerVersions: string[];
  classification: string;
  usableFor: string[];
  warnings: string[];
};

export type DbReadinessFile = {
  runId: string;
  generatedAt: string;
  status: string;
  candidates: DbReadinessCandidate[];
  warnings?: string[];
};

export type CaseSnapshotAlignmentItem = {
  caseId: string;
  repo: string;
  baseSha: string | null;
  status: CaseSnapshotAlignmentStatus;
  projectId: string | null;
  repositoryId: string | null;
  snapshotId: string | null;
  snapshotCommitSha: string | null;
  indexStatus: string | null;
  chunkCount: number;
  embeddingModels: string[];
  requiredNextAction: string;
  warnings: string[];
  notes?: string;
};

export type CaseSnapshotAlignmentRegistry = {
  runId: string;
  generatedAt: string;
  caseCount: number;
  alignedVectorReadyCount: number;
  alignedLexicalOnlyCount: number;
  snapshotMissingCount: number;
  cases: CaseSnapshotAlignmentItem[];
  warnings: string[];
};

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

function loadOptionalOverrides(
  path: string,
): CaseSnapshotOverridesFile {
  const absolutePath = resolveRepoPath(path);
  if (!existsSync(absolutePath)) {
    return { mappings: [] };
  }
  return readJsonFile<CaseSnapshotOverridesFile>(path);
}

function loadOptionalReadiness(
  path: string,
): DbReadinessFile | null {
  const absolutePath = resolveRepoPath(path);
  if (!existsSync(absolutePath)) {
    return null;
  }
  return readJsonFile<DbReadinessFile>(path);
}

function hasUsableNonFakeEmbeddings(embeddingModels: readonly string[]): boolean {
  const normalized = embeddingModels
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  return normalized.some((value) => value !== 'fake-embedding');
}

function createMissingItem(params: {
  caseId: string;
  repo: string;
  baseSha: string | null;
}): CaseSnapshotAlignmentItem {
  return {
    caseId: params.caseId,
    repo: params.repo,
    baseSha: params.baseSha,
    status: 'SNAPSHOT_MISSING',
    projectId: null,
    repositoryId: null,
    snapshotId: null,
    snapshotCommitSha: null,
    indexStatus: null,
    chunkCount: 0,
    embeddingModels: [],
    requiredNextAction: 'Create/index snapshot at case baseSha.',
    warnings: [],
  };
}

export function evaluateCaseSnapshotAlignment(params: {
  caseId: string;
  repo: string;
  baseSha: string | null;
  mapping?: CaseSnapshotOverrideMapping;
  candidate?: DbReadinessCandidate | null;
}): CaseSnapshotAlignmentItem {
  const baseSha = params.baseSha?.trim() || null;

  if (!params.mapping || !params.candidate) {
    return createMissingItem({
      caseId: params.caseId,
      repo: params.repo,
      baseSha,
    });
  }

  const candidate = params.candidate;
  const warnings = [...candidate.warnings];

  const snapshotCommitSha = candidate.commitSha?.trim() || null;
  const normalizedRepositoryId = params.mapping.repositoryId;

  const itemBase: Omit<
    CaseSnapshotAlignmentItem,
    'status' | 'requiredNextAction'
  > = {
    caseId: params.caseId,
    repo: params.repo,
    baseSha,
    projectId: params.mapping.projectId,
    repositoryId: normalizedRepositoryId,
    snapshotId: params.mapping.snapshotId,
    snapshotCommitSha,
    indexStatus: candidate.indexStatus,
    chunkCount: candidate.chunkCount,
    embeddingModels: [...candidate.embeddingModels],
    warnings,
    notes: params.mapping.notes,
  };

  if (!baseSha || !snapshotCommitSha) {
    return {
      ...itemBase,
      status: 'UNKNOWN',
      requiredNextAction: 'Verify case.baseSha and snapshot.commitSha before attempting benchmark export.',
    };
  }

  if (baseSha !== snapshotCommitSha) {
    return {
      ...itemBase,
      status: 'SNAPSHOT_COMMIT_MISMATCH',
      requiredNextAction: 'Create or select a snapshot whose commitSha exactly matches case.baseSha.',
    };
  }

  const mappingRepoIdentity = normalizeRepoIdentity(params.repo);
  const candidateRepoIdentity = normalizeRepoIdentity(params.mapping.notes);
  if (
    candidateRepoIdentity &&
    mappingRepoIdentity &&
    candidateRepoIdentity !== mappingRepoIdentity
  ) {
    return {
      ...itemBase,
      status: 'REPO_MISMATCH',
      requiredNextAction: 'Correct the mapping so case.repo and repository identity refer to the same repository.',
    };
  }

  if (
    candidate.indexStatus === 'VECTOR_READY' &&
    candidate.chunkCount > 0 &&
    hasUsableNonFakeEmbeddings(candidate.embeddingModels)
  ) {
    return {
      ...itemBase,
      status: 'ALIGNED_VECTOR_READY',
      requiredNextAction:
        'Eligible for future CURRENT_HYBRID benchmark export when real query embedding is enabled.',
    };
  }

  if (candidate.chunkCount <= 0 || !hasUsableNonFakeEmbeddings(candidate.embeddingModels)) {
    return {
      ...itemBase,
      status: 'ALIGNED_LEXICAL_ONLY',
      requiredNextAction:
        'Snapshot aligns by commit, but real vector benchmark is blocked until usable non-fake embeddings exist.',
    };
  }

  return {
    ...itemBase,
    status: 'UNKNOWN',
    requiredNextAction: 'Inspect snapshot readiness metadata manually before running benchmark export.',
  };
}

export function buildCaseSnapshotAlignmentRegistry(params?: {
  datasetPath?: string;
  dbReadinessPath?: string;
  overridesPath?: string;
  generatedAt?: string;
  runId?: string;
}): CaseSnapshotAlignmentRegistry {
  const datasetPath = params?.datasetPath ?? 'evaluation/datasets/cases.v0.json';
  const dbReadinessPath =
    params?.dbReadinessPath ?? 'evaluation/results/db-snapshot-readiness.v0.json';
  const overridesPath =
    params?.overridesPath ?? 'evaluation/datasets/case-snapshot-overrides.v0.json';

  const dataset = loadDataset(datasetPath);
  const readiness = loadOptionalReadiness(dbReadinessPath);
  const overrides = loadOptionalOverrides(overridesPath);

  const candidateBySnapshotId = new Map<string, DbReadinessCandidate>(
    (readiness?.candidates ?? []).map((candidate) => [candidate.snapshotId, candidate]),
  );
  const mappingByCaseId = new Map<string, CaseSnapshotOverrideMapping>(
    overrides.mappings.map((mapping) => [mapping.caseId, mapping]),
  );

  const cases = dataset.cases.map((evaluationCase) => {
    const mapping = mappingByCaseId.get(evaluationCase.id);
    const candidate = mapping
      ? candidateBySnapshotId.get(mapping.snapshotId) ?? null
      : null;

    return evaluateCaseSnapshotAlignment({
      caseId: evaluationCase.id,
      repo: evaluationCase.repo,
      baseSha: evaluationCase.baseSha ?? null,
      mapping,
      candidate,
    });
  });

  return {
    runId: params?.runId ?? 'case-snapshot-alignment-v0',
    generatedAt: params?.generatedAt ?? new Date().toISOString(),
    caseCount: dataset.cases.length,
    alignedVectorReadyCount: cases.filter((item) => item.status === 'ALIGNED_VECTOR_READY').length,
    alignedLexicalOnlyCount: cases.filter((item) => item.status === 'ALIGNED_LEXICAL_ONLY').length,
    snapshotMissingCount: cases.filter((item) => item.status === 'SNAPSHOT_MISSING').length,
    cases,
    warnings: [
      'This registry does not run retrieval.',
      'Only ALIGNED_VECTOR_READY cases are eligible for current-hybrid benchmark export.',
      ...(readiness ? [] : ['DB readiness file was not found. Cases remain snapshot-missing until mappings and readiness data exist.']),
      ...(overrides.mappings.length === 0
        ? ['No case-snapshot override mappings were provided.']
        : []),
    ],
  };
}

export function renderCaseSnapshotAlignmentMarkdown(
  registry: CaseSnapshotAlignmentRegistry,
): string {
  const lines = [
    '# Case Snapshot Alignment v0',
    '',
    `Generated at: ${registry.generatedAt}`,
    '',
    `- Cases: ${registry.caseCount}`,
    `- ALIGNED_VECTOR_READY: ${registry.alignedVectorReadyCount}`,
    `- ALIGNED_LEXICAL_ONLY: ${registry.alignedLexicalOnlyCount}`,
    `- SNAPSHOT_MISSING: ${registry.snapshotMissingCount}`,
    '',
    'This registry does not run retrieval.',
    'Only ALIGNED_VECTOR_READY cases are eligible for current-hybrid benchmark export.',
    '',
    '## Status Meaning',
    '',
    '- `ALIGNED_VECTOR_READY`: case baseSha matches a mapped snapshot commit, and the snapshot has usable non-fake vector state.',
    '- `ALIGNED_LEXICAL_ONLY`: case baseSha matches a mapped snapshot commit, but usable vector state is not available.',
    '- `SNAPSHOT_MISSING`: no local mapped snapshot exists yet for this case.',
    '- `SNAPSHOT_COMMIT_MISMATCH`: do not run benchmark export; create/select a snapshot at the exact case baseSha.',
    '- `REPO_MISMATCH`: do not run benchmark export until the mapping points at the correct repository.',
    '',
    '## Cases',
    '',
    '| Case | Repo | Base SHA | Status | Snapshot | Index Status | Chunks | Embeddings | Next Action |',
    '| --- | --- | --- | --- | --- | --- | ---: | --- | --- |',
  ];

  for (const item of registry.cases) {
    lines.push(
      `| ${item.caseId} | ${item.repo} | ${item.baseSha ?? 'none'} | ${item.status} | ${item.snapshotId ?? 'none'} | ${item.indexStatus ?? 'none'} | ${item.chunkCount} | ${item.embeddingModels.join(', ') || 'none'} | ${item.requiredNextAction} |`,
    );
  }

  lines.push(
    '',
    '## Future CURRENT_HYBRID Command Template',
    '',
    '```bash',
    'pnpm exec ts-node --project tsconfig.json evaluation/scripts/export-rag-samples.ts \\',
    '  --caseId <aligned-case-id> \\',
    '  --projectId <project-id> \\',
    '  --repositoryId <repository-id> \\',
    '  --snapshotId <snapshot-id>',
    '```',
    '',
    '## Warnings',
    '',
  );

  for (const warning of registry.warnings) {
    lines.push(`- ${warning}`);
  }

  return `${lines.join('\n')}\n`;
}
