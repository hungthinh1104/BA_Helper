import { existsSync } from 'fs';
import { EvaluationPaths } from '../core/paths';
import { loadDataset, readJsonFile, resolveRepoPath } from '../../io';
import {
  evaluateGroundTruthArtifactCoverage,
  type GroundTruthCoverageStatus,
} from '../analysis/ground-truth-coverage';

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
  embeddingProfileId?: string;
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
  embeddingProfileIds: string[];
  embeddingProviders: string[];
  embeddingModels: string[];
  embeddingDimensions: number[];
  embeddingConfigHashes: string[];
  chunkerVersions: string[];
  indexedArtifactFilePaths?: string[];
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
  selectedEmbeddingProfileId: string | null;
  embeddingProfileIds: string[];
  embeddingProviders: string[];
  embeddingModels: string[];
  embeddingDimensions: number[];
  embeddingConfigHashes: string[];
  cleanRetrievalEligible: boolean;
  e2eEligible: boolean;
  scannerCoverageStatus: GroundTruthCoverageStatus;
  missingIndexedGroundTruthFiles: string[];
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
  cleanRetrievalEligibleCount: number;
  scannerCoverageFailureCount: number;
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

function hasSelectedProfile(params: {
  mapping?: CaseSnapshotOverrideMapping;
  candidate: DbReadinessCandidate;
}): boolean {
  const selectedProfile = params.mapping?.embeddingProfileId?.trim();
  if (!selectedProfile) {
    return params.candidate.embeddingProfileIds.length > 0;
  }

  return params.candidate.embeddingProfileIds.includes(selectedProfile);
}

function hasSelectedProfileProvenance(candidate: DbReadinessCandidate): boolean {
  return (
    candidate.embeddingProviders.length > 0 &&
    candidate.embeddingDimensions.length > 0 &&
    candidate.embeddingConfigHashes.length > 0
  );
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
    selectedEmbeddingProfileId: null,
    embeddingProfileIds: [],
    embeddingProviders: [],
    embeddingModels: [],
    embeddingDimensions: [],
    embeddingConfigHashes: [],
    cleanRetrievalEligible: false,
    e2eEligible: false,
    scannerCoverageStatus: 'UNKNOWN',
    missingIndexedGroundTruthFiles: [],
    requiredNextAction: 'Create/index snapshot at case baseSha.',
    warnings: [],
  };
}

export function evaluateCaseSnapshotAlignment(params: {
  caseId: string;
  repo: string;
  baseSha: string | null;
  groundTruthFiles?: readonly string[];
  evaluationScope?: string;
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
  const coverage = evaluateGroundTruthArtifactCoverage({
    groundTruthFiles: params.groundTruthFiles ?? [],
    indexedArtifactFilePaths: candidate.indexedArtifactFilePaths,
  });
  const explicitScannerCoverageFailure =
    params.evaluationScope === 'E2E_SCANNER_COVERAGE_FAILURE';
  const scannerCoverageStatus =
    explicitScannerCoverageFailure && coverage.status !== 'OK'
      ? 'GROUND_TRUTH_NOT_INDEXED'
      : coverage.status;
  const missingIndexedGroundTruthFiles =
    explicitScannerCoverageFailure && coverage.status !== 'OK'
      ? [...(params.groundTruthFiles ?? [])]
      : coverage.missingIndexedGroundTruthFiles;

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
    selectedEmbeddingProfileId: params.mapping.embeddingProfileId ?? null,
    embeddingProfileIds: [...candidate.embeddingProfileIds],
    embeddingProviders: [...candidate.embeddingProviders],
    embeddingModels: [...candidate.embeddingModels],
    embeddingDimensions: [...candidate.embeddingDimensions],
    embeddingConfigHashes: [...candidate.embeddingConfigHashes],
    cleanRetrievalEligible: false,
    e2eEligible: false,
    scannerCoverageStatus,
    missingIndexedGroundTruthFiles,
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

  if (!hasSelectedProfile({ mapping: params.mapping, candidate })) {
    return {
      ...itemBase,
      status: 'ALIGNED_LEXICAL_ONLY',
      e2eEligible: true,
      requiredNextAction:
        `Selected embedding profile ${params.mapping.embeddingProfileId ?? 'UNKNOWN'} is missing from snapshot chunks.`,
    };
  }

  if (
    candidate.indexStatus === 'VECTOR_READY' &&
    candidate.chunkCount > 0 &&
    hasUsableNonFakeEmbeddings(candidate.embeddingModels) &&
    hasSelectedProfileProvenance(candidate)
  ) {
    return {
      ...itemBase,
      status: 'ALIGNED_VECTOR_READY',
      cleanRetrievalEligible: scannerCoverageStatus === 'OK',
      e2eEligible: true,
      requiredNextAction:
        scannerCoverageStatus === 'OK'
          ? 'Eligible for future CURRENT_HYBRID benchmark export when real query embedding is enabled.'
          : 'Vector-ready for E2E, but clean retrieval aggregate is blocked until ground-truth files are indexed as CodeArtifact rows.',
    };
  }

  if (
    candidate.chunkCount <= 0 ||
    !hasUsableNonFakeEmbeddings(candidate.embeddingModels) ||
    !hasSelectedProfileProvenance(candidate)
  ) {
    return {
      ...itemBase,
      status: 'ALIGNED_LEXICAL_ONLY',
      e2eEligible: true,
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
  const datasetPath = params?.datasetPath ?? EvaluationPaths.datasetV0.cases;
  const dbReadinessPath =
    params?.dbReadinessPath ?? EvaluationPaths.resultsLegacy.probes.dbReadinessJson;
  const overridesPath =
    params?.overridesPath ?? EvaluationPaths.datasetV0.snapshotOverrides;

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
      groundTruthFiles: evaluationCase.groundTruth.files,
      evaluationScope: evaluationCase.evaluationScope,
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
    cleanRetrievalEligibleCount: cases.filter((item) => item.cleanRetrievalEligible).length,
    scannerCoverageFailureCount: cases.filter(
      (item) => item.scannerCoverageStatus === 'GROUND_TRUTH_NOT_INDEXED',
    ).length,
    cases,
    warnings: [
      'This registry does not run retrieval.',
      'Only ALIGNED_VECTOR_READY cases with cleanRetrievalEligible=true are eligible for clean current-hybrid retrieval aggregates.',
      'ALIGNED_VECTOR_READY cases with e2eEligible=true but cleanRetrievalEligible=false are reserved for scanner coverage or end-to-end failure analysis.',
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
    `- Clean retrieval eligible: ${registry.cleanRetrievalEligibleCount}`,
    `- Scanner coverage failures: ${registry.scannerCoverageFailureCount}`,
    '',
    'This registry does not run retrieval.',
    'Only ALIGNED_VECTOR_READY cases with clean retrieval eligibility are clean benchmark candidates.',
    'Vector-ready E2E cases without indexed ground-truth coverage are useful for scanner coverage failure analysis, not clean retrieval aggregates.',
    '',
    '## Status Meaning',
    '',
    '- `ALIGNED_VECTOR_READY`: case baseSha matches a mapped snapshot commit, and the snapshot has usable non-fake vector state.',
    '- `Clean Retrieval`: all proxy ground-truth files are materialized as indexed `CodeArtifact` rows for the mapped snapshot.',
    '- `ALIGNED_LEXICAL_ONLY`: case baseSha matches a mapped snapshot commit, but usable vector state is not available.',
    '- `SNAPSHOT_MISSING`: no local mapped snapshot exists yet for this case.',
    '- `SNAPSHOT_COMMIT_MISMATCH`: do not run benchmark export; create/select a snapshot at the exact case baseSha.',
    '- `REPO_MISMATCH`: do not run benchmark export until the mapping points at the correct repository.',
    '',
    '## Cases',
    '',
    '| Case | Repo | Base SHA | Status | Clean Retrieval | E2E | Scanner Coverage | Missing Indexed Ground Truth | Snapshot | Index Status | Chunks | Selected Profile | Profiles | Embeddings | Next Action |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |',
  ];

  for (const item of registry.cases) {
    lines.push(
      `| ${item.caseId} | ${item.repo} | ${item.baseSha ?? 'none'} | ${item.status} | ${item.cleanRetrievalEligible ? 'yes' : 'no'} | ${item.e2eEligible ? 'yes' : 'no'} | ${item.scannerCoverageStatus} | ${item.missingIndexedGroundTruthFiles.join(', ') || 'none'} | ${item.snapshotId ?? 'none'} | ${item.indexStatus ?? 'none'} | ${item.chunkCount} | ${item.selectedEmbeddingProfileId ?? 'none'} | ${item.embeddingProfileIds.join(', ') || 'none'} | ${item.embeddingModels.join(', ') || 'none'} | ${item.requiredNextAction} |`,
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
