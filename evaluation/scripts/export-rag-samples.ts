import { existsSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { ArtifactRepository } from '../../apps/api/src/modules/artifact/infrastructure/artifact.repository';
import { FakeEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/fake-embedding.provider';
import { GoogleEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/google-embedding.provider';
import { OpenAiEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/openai-embedding.provider';
import { EmbeddingChunkRepository } from '../../apps/api/src/modules/embedding/infrastructure/embedding-chunk.repository';
import { type EmbeddingProvider } from '../../apps/api/src/modules/embedding/domain/embedding-provider.interface';
import type { EmbeddingProfile } from '../../apps/api/src/modules/embedding/domain/embedding-profile';
import {
  buildEmbeddingConfigHash,
  resolveRuntimeEmbeddingProfileFromEnv,
} from '../../apps/api/src/modules/embedding/domain/embedding-profile-registry';
import { GraphRepository } from '../../apps/api/src/modules/graph/infrastructure/graph.repository';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { loadDataset, readJsonFile, resolveRepoPath, writeJsonFile } from '../io';
import {
  evaluateCurrentHybridExportGuard,
  getCurrentHybridOutputTargets,
  type CurrentHybridExportMode,
} from '../src/current-hybrid-export-guard';
import { summarizeEvidenceQuality } from '../src/evidence-quality';
import {
  mapSnapshotMetadata,
  readArtifactEvidenceExcerpt,
  readEmbeddingState,
  readSnapshotMetadata,
  type RagExportEmbeddingState,
  type RagExportSnapshotMetadata,
} from '../src/rag-export-db-read-model';
import {
  readGroundTruthArtifactCoverage,
  type GroundTruthCoverageResult,
} from '../src/ground-truth-coverage';
import type {
  CandidateArtifact,
  ReqImpactEvaluationCase,
  RetrievedArtifactResult,
} from '../src/types';

type ExportMode = 'CASE_ONLY' | 'CURRENT_HYBRID';

type RetrievedArtifactResultWithExtras = RetrievedArtifactResult & {
  universalKind?: string;
  strategyVersion?: string;
  retrievalDiagnostics?: unknown;
  evidence: RetrievedArtifactResult['evidence'] & {
    excerptPreview: string;
  };
};

type RagSampleExport = {
  runId: string;
  generatedAt: string;
  mode: 'CASE_ONLY' | 'CURRENT_HYBRID_SMOKE' | 'CURRENT_HYBRID_BENCHMARK';
  caseId: string;
  repo: string;
  caseBaseSha?: string;
  requirementText: string;
  groundTruthFiles: string[];
  snapshot?: RagExportSnapshotMetadata;
  embeddingState?: RagExportEmbeddingState & {
    queryEmbeddingProfileId?: string;
    queryProviderName?: string;
    queryEmbeddingModel?: string;
    queryEmbeddingDimensions?: number;
    queryEmbeddingConfigHash?: string;
    artifactEmbeddingProfileId?: string;
    artifactEmbeddingProvider?: string;
    artifactEmbeddingModel?: string;
    artifactEmbeddingDimensions?: number;
    artifactEmbeddingConfigHash?: string;
    artifactEmbeddingModels?: string[];
    alignmentVerified?: boolean;
  };
  groundTruthCoverage?: GroundTruthCoverageResult;
  topK: RetrievedArtifactResultWithExtras[];
  summary: {
    topKCount: number;
    groundTruthHitCount: number;
    recallAt10: number;
    evidenceCoverage: number;
    locationOnlyEvidenceCount: number;
    codeLikeEvidenceCount: number;
    missedGroundTruthFiles: string[];
    unexpectedTopKFiles: string[];
  };
  warnings: string[];
};

type CaseSnapshotOverridesFile = {
  mappings: Array<{
    caseId: string;
    embeddingProfileId?: string;
  }>;
};

function parseArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function resolveOutputPath(relativePath: string): string {
  return resolve(process.cwd(), relativePath);
}

function getRequiredCase(caseId: string): ReqImpactEvaluationCase {
  const dataset = loadDataset('evaluation/datasets/cases.v0.json');
  const selectedCase = dataset.cases.find(
    (evaluationCase) => evaluationCase.id === caseId,
  );

  if (!selectedCase) {
    throw new Error(`Evaluation case not found: ${caseId}`);
  }

  return selectedCase;
}

function getMappedEmbeddingProfileId(caseId: string): string | undefined {
  const path = 'evaluation/datasets/case-snapshot-overrides.v0.json';
  if (!existsSync(resolveRepoPath(path))) {
    return undefined;
  }

  const overrides = readJsonFile<CaseSnapshotOverridesFile>(path);
  return overrides.mappings.find((mapping) => mapping.caseId === caseId)
    ?.embeddingProfileId;
}

function buildRunId(mode: ExportMode, caseId: string): string {
  return `rag-sample:${mode.toLowerCase()}:${caseId}:${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;
}

function shouldAllowRealQueryEmbedding(): boolean {
  return process.env.REQIMPACT_ALLOW_REAL_QUERY_EMBEDDING === '1';
}

function resolveRealQueryEmbeddingProvider(): {
  provider: EmbeddingProvider;
  providerName: string;
  embeddingModel: string;
  embeddingProfileId: string;
  profile: EmbeddingProfile;
} {
  const profile = resolveRuntimeEmbeddingProfileFromEnv('QUERY');
  const providerName = profile.provider;
  const embeddingModel = profile.model;

  switch (providerName) {
    case 'google':
      return {
        provider: new GoogleEmbeddingProvider(profile),
        providerName: 'google',
        embeddingModel,
        embeddingProfileId: profile.id,
        profile,
      };
    case 'openai':
      return {
        provider: new OpenAiEmbeddingProvider(profile),
        providerName: 'openai',
        embeddingModel,
        embeddingProfileId: profile.id,
        profile,
      };
    case 'fake':
      throw new Error('Fake query embedding provider is configured. Benchmark mode requires a real provider.');
    default:
      throw new Error(
        `Real query embedding provider "${providerName || 'unset'}" is not wired into the research exporter.`,
      );
  }
}

function mapCandidateArtifactToResult(
  artifact: CandidateArtifact,
  rank: number,
): RetrievedArtifactResultWithExtras {
  const evidence = summarizeEvidenceQuality(artifact.excerpt);

  return {
    rank,
    artifactKey: artifact.artifactKey,
    filePath: artifact.filePath,
    artifactType: artifact.artifactType,
    retrievalSignals: [],
    retrievalReason:
      'CASE_ONLY mode does not run retrieval; candidateArtifacts are exported in dataset order.',
    evidence,
    universalKind: artifact.universalKind,
  };
}

function computeSummary(
  groundTruthFiles: string[],
  topK: RetrievedArtifactResultWithExtras[],
) {
  const truthSet = new Set(groundTruthFiles);
  const topKFiles = topK.map((item) => item.filePath);
  const topKFileSet = new Set(topKFiles);
  const groundTruthHitCount = topKFiles.filter((filePath) =>
    truthSet.has(filePath),
  ).length;
  const evidenceCount = topK.filter((item) => item.evidence.hasEvidence).length;
  const locationOnlyEvidenceCount = topK.filter(
    (item) => item.evidence.isLocationOnly,
  ).length;
  const codeLikeEvidenceCount = topK.filter((item) => item.evidence.isCodeLike)
    .length;

  return {
    topKCount: topK.length,
    groundTruthHitCount,
    recallAt10:
      truthSet.size === 0
        ? 0
        : Number((groundTruthHitCount / truthSet.size).toFixed(4)),
    evidenceCoverage:
      topK.length === 0 ? 0 : Number((evidenceCount / topK.length).toFixed(4)),
    locationOnlyEvidenceCount,
    codeLikeEvidenceCount,
    missedGroundTruthFiles: groundTruthFiles.filter(
      (filePath) => !topKFileSet.has(filePath),
    ),
    unexpectedTopKFiles: topKFiles.filter((filePath) => !truthSet.has(filePath)),
  };
}

function renderMarkdown(result: RagSampleExport): string {
  const groundTruthNote =
    result.mode === 'CURRENT_HYBRID_BENCHMARK'
      ? 'Changed files are proxy ground truth. This single-case current-hybrid benchmark export is not an aggregate research conclusion.'
      : 'Changed files are proxy ground truth. This smoke export is not a final benchmark result.';
  const lines = [
    '# ReqImpact RAG Sample Export v0',
    '',
    `- Run ID: ${result.runId}`,
    `- Mode: ${result.mode}`,
    `- Case ID: ${result.caseId}`,
    `- Repo: ${result.repo}`,
    '',
    '## Requirement Text',
    '',
    result.requirementText,
    '',
    '## Ground Truth Note',
    '',
    groundTruthNote,
  ];

  if (result.snapshot) {
    lines.push(
      '',
      '## Snapshot Metadata',
      '',
      `- Snapshot ID: ${result.snapshot.snapshotId}`,
      `- Repository ID: ${result.snapshot.repositoryId}`,
      `- Project ID: ${result.snapshot.projectId}`,
      `- Commit SHA: ${result.snapshot.commitSha}`,
      ...(result.caseBaseSha ? [`- Case Base SHA: ${result.caseBaseSha}`] : []),
      `- Analyzer Version: ${result.snapshot.analyzerVersion}`,
      `- Coverage Status: ${result.snapshot.coverageStatus}`,
      `- Index Status: ${result.snapshot.indexStatus}`,
      `- Created At: ${result.snapshot.createdAt}`,
    );
  }

  if (result.embeddingState) {
    lines.push(
      '',
      '## Embedding State',
      '',
      `- Query Profile ID: ${result.embeddingState.queryEmbeddingProfileId ?? 'unknown'}`,
      `- Query Provider: ${result.embeddingState.queryProviderName ?? 'unknown'}`,
      `- Query Embedding Model: ${result.embeddingState.queryEmbeddingModel ?? 'unknown'}`,
      `- Query Dimensions: ${result.embeddingState.queryEmbeddingDimensions ?? 'unknown'}`,
      `- Query Config Hash: ${result.embeddingState.queryEmbeddingConfigHash ?? 'unknown'}`,
      `- Artifact Profile ID: ${result.embeddingState.artifactEmbeddingProfileId ?? 'unknown'}`,
      `- Artifact Provider: ${result.embeddingState.artifactEmbeddingProvider ?? 'unknown'}`,
      `- Artifact Embedding Model: ${result.embeddingState.artifactEmbeddingModel ?? 'unknown'}`,
      `- Artifact Dimensions: ${result.embeddingState.artifactEmbeddingDimensions ?? 'unknown'}`,
      `- Artifact Config Hash: ${result.embeddingState.artifactEmbeddingConfigHash ?? 'unknown'}`,
      `- Chunk count: ${result.embeddingState.chunkCount}`,
      `- Artifact embedding models: ${result.embeddingState.artifactEmbeddingModels?.join(', ') || 'none'}`,
      `- Chunker versions: ${result.embeddingState.chunkerVersions.join(', ') || 'none'}`,
      `- Alignment verified: ${result.embeddingState.alignmentVerified ? 'yes' : 'no'}`,
    );
  }

  if (result.groundTruthCoverage) {
    lines.push(
      '',
      '## Ground Truth Artifact Coverage',
      '',
      `- Status: ${result.groundTruthCoverage.status}`,
      `- Indexed ground-truth files: ${result.groundTruthCoverage.indexedGroundTruthFiles.join(', ') || 'none'}`,
      `- Missing indexed ground-truth files: ${result.groundTruthCoverage.missingIndexedGroundTruthFiles.join(', ') || 'none'}`,
    );
  }

  lines.push(
    '',
    '## Summary',
    '',
    `- Top-K count: ${result.summary.topKCount}`,
    `- Ground-truth hits in top-K: ${result.summary.groundTruthHitCount}`,
    `- Recall@10: ${result.summary.recallAt10}`,
    `- Evidence coverage: ${result.summary.evidenceCoverage}`,
    `- Location-only evidence count: ${result.summary.locationOnlyEvidenceCount}`,
    `- Code-like evidence count: ${result.summary.codeLikeEvidenceCount}`,
    `- Missed ground-truth files: ${result.summary.missedGroundTruthFiles.join(', ') || 'none'}`,
    `- Unexpected top-K files: ${result.summary.unexpectedTopKFiles.join(', ') || 'none'}`,
    '',
    '## Top-K',
    '',
    '| Rank | File | Type | Kind | Score | Final | Lexical | Vector | Graph | Kind Boost | Domain Boost | Signals | Evidence | Location-only | Code-like | Preview |',
    '| ---: | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- | --- |',
  );

  for (const item of result.topK) {
    lines.push(
      `| ${item.rank} | ${item.filePath} | ${item.artifactType} | ${item.universalKind ?? ''} | ${(
        item.score ?? 0
      ).toFixed(4)} | ${(item.finalScore ?? 0).toFixed(4)} | ${(
        item.lexicalScore ?? 0
      ).toFixed(4)} | ${(item.vectorScore ?? 0).toFixed(4)} | ${(
        item.graphScore ?? 0
      ).toFixed(4)} | ${(item.kindBoost ?? 0).toFixed(4)} | ${(
        item.domainBoost ?? 0
      ).toFixed(4)} | ${item.retrievalSignals.join(', ')} | ${
        item.evidence.hasEvidence ? 'yes' : 'no'
      } | ${item.evidence.isLocationOnly ? 'yes' : 'no'} | ${
        item.evidence.isCodeLike ? 'yes' : 'no'
      } | ${item.evidence.excerptPreview.replace(/\|/g, '\\|')} |`,
    );
  }

  lines.push('', '## Warnings', '');

  if (result.warnings.length === 0) {
    lines.push('- none');
  } else {
    for (const warning of result.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

async function runCaseOnlyMode(params: {
  evaluationCase: ReqImpactEvaluationCase;
  topKLimit: number;
}): Promise<RagSampleExport> {
  const topK = params.evaluationCase.candidateArtifacts
    .slice(0, params.topKLimit)
    .map((artifact, index) => mapCandidateArtifactToResult(artifact, index + 1));

  return {
    runId: buildRunId('CASE_ONLY', params.evaluationCase.id),
    generatedAt: new Date().toISOString(),
    mode: 'CASE_ONLY',
    caseId: params.evaluationCase.id,
    repo: params.evaluationCase.repo,
    requirementText: params.evaluationCase.requirementText,
    groundTruthFiles: params.evaluationCase.groundTruth.files,
    topK,
    summary: computeSummary(params.evaluationCase.groundTruth.files, topK),
    warnings: [
      'CASE_ONLY mode does not execute retrieval. Candidate artifacts are exported in dataset order only.',
      'Changed files are proxy ground truth, not absolute truth.',
    ],
  };
}

async function runCurrentHybridMode(params: {
  evaluationCase: ReqImpactEvaluationCase;
  projectId: string;
  repositoryId: string;
  snapshotId: string;
  embeddingArtifactProfileId?: string;
  topKLimit: number;
}): Promise<RagSampleExport> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'CURRENT_HYBRID mode requires DATABASE_URL and existing local DB state.',
    );
  }

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const snapshot = await readSnapshotMetadata({
      prisma,
      snapshotId: params.snapshotId,
    });

    if (!snapshot) {
      throw new Error(
        `Snapshot not found: ${params.snapshotId}. CURRENT_HYBRID mode requires an existing local snapshot.`,
      );
    }

    if (snapshot.repositoryId !== params.repositoryId) {
      throw new Error(
        `Snapshot repository mismatch: snapshot.repositoryId=${snapshot.repositoryId} but --repositoryId=${params.repositoryId}.`,
      );
    }

    if (snapshot.repository.projectId !== params.projectId) {
      throw new Error(
        `Snapshot project mismatch: repository.projectId=${snapshot.repository.projectId} but --projectId=${params.projectId}.`,
      );
    }

    const embeddingState = await readEmbeddingState({
      prisma,
      snapshotId: params.snapshotId,
    });
    const groundTruthCoverage = await readGroundTruthArtifactCoverage({
      prisma,
      snapshotId: params.snapshotId,
      groundTruthFiles: params.evaluationCase.groundTruth.files,
    });

    const allowRealQueryEmbedding = shouldAllowRealQueryEmbedding();
    const isSmokeMode = !allowRealQueryEmbedding;
    let queryProvider: EmbeddingProvider;
    let queryProviderName: string;
    let queryEmbeddingModel: string;
    let queryEmbeddingProfileId: string;
    let queryEmbeddingDimensions: number;
    let queryEmbeddingConfigHash: string;

    if (isSmokeMode) {
      const fakeProvider = new FakeEmbeddingProvider();
      queryProvider = fakeProvider;
      queryProviderName = fakeProvider.providerName;
      queryEmbeddingModel = 'fake-embedding';
      queryEmbeddingProfileId = fakeProvider.profile.id;
      queryEmbeddingDimensions = fakeProvider.profile.dimensions;
      queryEmbeddingConfigHash = buildEmbeddingConfigHash(fakeProvider.profile);
    } else {
      try {
        const resolvedProvider = resolveRealQueryEmbeddingProvider();
        queryProvider = resolvedProvider.provider;
        queryProviderName = resolvedProvider.providerName;
        queryEmbeddingModel = resolvedProvider.embeddingModel;
        queryEmbeddingProfileId = resolvedProvider.embeddingProfileId;
        queryEmbeddingDimensions = resolvedProvider.profile.dimensions;
        queryEmbeddingConfigHash = buildEmbeddingConfigHash(
          resolvedProvider.profile,
        );
      } catch (error) {
        throw new Error(
          `Real query embedding provider is configured but not yet wired into research exporter. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const artifactEmbeddingProfileId =
      params.embeddingArtifactProfileId ??
      getMappedEmbeddingProfileId(params.evaluationCase.id) ??
      (embeddingState.embeddingProfileIds.length === 1
        ? embeddingState.embeddingProfileIds[0]
        : undefined);
    const selectedArtifactProfile = embeddingState.profiles.find(
      (profile) => profile.embeddingProfileId === artifactEmbeddingProfileId,
    );
    const artifactEmbeddingProvider =
      selectedArtifactProfile?.embeddingProvider ?? undefined;
    const artifactEmbeddingModel =
      selectedArtifactProfile?.embeddingModel ?? undefined;
    const artifactEmbeddingDimensions =
      selectedArtifactProfile?.embeddingDimensions ?? undefined;
    const artifactEmbeddingConfigHash =
      selectedArtifactProfile?.embeddingConfigHash ?? undefined;

    const guardResult = evaluateCurrentHybridExportGuard({
      caseRepo: params.evaluationCase.repo,
      caseBaseSha: params.evaluationCase.baseSha,
      repositoryIdentity: snapshot.repository.canonicalUrl,
      snapshotCommitSha: snapshot.commitSha,
      snapshotIndexStatus: snapshot.indexStatus,
      chunkCount: embeddingState.chunkCount,
      embeddingProfileIds: embeddingState.embeddingProfileIds,
      embeddingModels: embeddingState.embeddingModels,
      embeddingDimensions: embeddingState.embeddingDimensions,
      embeddingConfigHashes: embeddingState.embeddingConfigHashes,
      queryEmbeddingProfileId,
      queryEmbeddingProvider: queryProviderName,
      queryEmbeddingModel,
      queryEmbeddingDimensions,
      queryEmbeddingConfigHash,
      artifactEmbeddingProfileId,
      artifactEmbeddingProvider,
      artifactEmbeddingModel,
      artifactEmbeddingDimensions,
      artifactEmbeddingConfigHash,
      selectedArtifactProfileChunkCount: selectedArtifactProfile?.chunkCount,
      allowRealQueryEmbedding,
      isSmokeMode,
    });

    if (!guardResult.allowed) {
      throw new Error(
        `CURRENT_HYBRID benchmark blocked:\n${guardResult.blockers.join('\n')}`,
      );
    }

    const retrievalService = new HybridRetrievalService(
      new EmbeddingChunkRepository(prisma),
      queryProvider,
      new ArtifactRepository(prisma),
      new GraphRepository(prisma),
      prisma,
    );

    const retrievedArtifacts = await retrievalService.retrieve({
      projectId: params.projectId,
      repositoryId: params.repositoryId,
      snapshotId: params.snapshotId,
      embeddingQueryProfileId: queryEmbeddingProfileId,
      embeddingArtifactProfileId: artifactEmbeddingProfileId ?? '',
      changeRequest: params.evaluationCase.requirementText,
      maxResults: params.topKLimit,
      expandGraph: true,
    });

    const topK: RetrievedArtifactResultWithExtras[] = [];
    for (const [index, retrieved] of retrievedArtifacts.entries()) {
      const excerpt = await readArtifactEvidenceExcerpt({
        prisma,
        snapshotId: params.snapshotId,
        artifactId: retrieved.artifactId,
      });
      const evidence = summarizeEvidenceQuality(excerpt);

      topK.push({
        rank: index + 1,
        artifactKey: retrieved.artifactKey,
        filePath: retrieved.filePath,
        artifactType: retrieved.artifactType,
        universalKind:
          retrieved.retrievalDiagnostics?.universalKind ?? undefined,
        score: retrieved.score,
        finalScore: retrieved.finalScore,
        lexicalScore: retrieved.lexicalScore,
        vectorScore: retrieved.vectorScore,
        graphScore: retrieved.graphScore,
        kindBoost: retrieved.kindBoost,
        domainBoost: retrieved.domainBoost,
        noisePenalty: undefined,
        retrievalSignals: retrieved.retrievalSignals,
        retrievalReason: retrieved.retrievalReason,
        strategyVersion: retrieved.strategyVersion,
        retrievalDiagnostics: retrieved.retrievalDiagnostics,
        evidence,
      });
    }

    const warnings: string[] = [
      'Changed files are proxy ground truth. This export is not a final research conclusion.',
    ];

    if (guardResult.mode === 'CURRENT_HYBRID_SMOKE') {
      warnings.push(
        `CURRENT_HYBRID smoke mode used ${queryProviderName} query embedding provider. This output is SMOKE_ONLY and not benchmark evidence.`,
      );
      warnings.push(...guardResult.warnings);
    } else {
      warnings.push('CURRENT_HYBRID benchmark mode alignment was verified.');
      warnings.push(...guardResult.warnings);
    }

    if (snapshot.indexStatus !== 'VECTOR_READY') {
      warnings.push(
        `Snapshot indexStatus is ${snapshot.indexStatus}; vector channel may be absent or incomplete.`,
      );
    }

    if (embeddingState.chunkCount === 0) {
      warnings.push(
        'No EmbeddingChunk rows exist for this snapshot, so vector retrieval cannot be evaluated.',
      );
    }

    if (!topK.some((item) => item.retrievalSignals.includes('VECTOR'))) {
      warnings.push(
        'No VECTOR retrieval signal appeared in the exported top-k results.',
      );
    }

    if (
      params.evaluationCase.evaluationScope ===
      'E2E_SCANNER_COVERAGE_FAILURE'
    ) {
      warnings.push(
        params.evaluationCase.scannerCoverageNote ??
          'This case is labeled as a scanner coverage failure.',
      );
      warnings.push(
        'Recall@10=0 for this case should be interpreted as scanner coverage / E2E failure, not pure retrieval failure.',
      );
    }

    if (groundTruthCoverage.status === 'GROUND_TRUTH_NOT_INDEXED') {
      warnings.push(
        `Ground-truth file(s) missing from persisted CodeArtifact rows: ${groundTruthCoverage.missingIndexedGroundTruthFiles.join(', ')}.`,
      );
    }

    return {
      runId: buildRunId('CURRENT_HYBRID', params.evaluationCase.id),
      generatedAt: new Date().toISOString(),
      mode: guardResult.mode,
      caseId: params.evaluationCase.id,
      repo: params.evaluationCase.repo,
      caseBaseSha: params.evaluationCase.baseSha,
      requirementText: params.evaluationCase.requirementText,
      groundTruthFiles: params.evaluationCase.groundTruth.files,
      snapshot: mapSnapshotMetadata(snapshot),
      embeddingState: {
        ...embeddingState,
        queryEmbeddingProfileId,
        queryProviderName,
        queryEmbeddingModel,
        queryEmbeddingDimensions,
        queryEmbeddingConfigHash,
        artifactEmbeddingProfileId,
        artifactEmbeddingProvider,
        artifactEmbeddingModel,
        artifactEmbeddingDimensions,
        artifactEmbeddingConfigHash,
        artifactEmbeddingModels: embeddingState.embeddingModels,
        alignmentVerified: guardResult.mode === 'CURRENT_HYBRID_BENCHMARK',
      },
      groundTruthCoverage,
      topK,
      summary: computeSummary(params.evaluationCase.groundTruth.files, topK),
      warnings,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function getOutputTargets(mode: ExportMode) {
  return mode === 'CURRENT_HYBRID'
    ? getCurrentHybridOutputTargets(
        shouldAllowRealQueryEmbedding()
          ? 'CURRENT_HYBRID_BENCHMARK'
          : 'CURRENT_HYBRID_SMOKE',
      )
    : {
        json: 'evaluation/results/rag-samples.v0.json',
        markdown: 'evaluation/results/rag-samples.v0.md',
      };
}

async function main(): Promise<void> {
  const caseId = parseArg('--caseId');
  if (!caseId) {
    throw new Error('Missing required argument: --caseId <id>');
  }

  const projectId = parseArg('--projectId');
  const repositoryId = parseArg('--repositoryId');
  const snapshotId = parseArg('--snapshotId');
  const embeddingArtifactProfileId = parseArg('--embeddingArtifactProfileId');
  const topKLimit = Number.parseInt(parseArg('--topK') ?? '10', 10);
  const evaluationCase = getRequiredCase(caseId);
  const isCurrentHybridMode = Boolean(projectId && repositoryId && snapshotId);

  if (
    [projectId, repositoryId, snapshotId].some(Boolean) &&
    !isCurrentHybridMode
  ) {
    throw new Error(
      'CURRENT_HYBRID mode requires --projectId, --repositoryId, and --snapshotId together. Otherwise omit all three and use CASE_ONLY mode.',
    );
  }

  const mode: ExportMode = isCurrentHybridMode ? 'CURRENT_HYBRID' : 'CASE_ONLY';
  const outputs = getOutputTargets(mode);

  const result =
    mode === 'CURRENT_HYBRID'
      ? await runCurrentHybridMode({
          evaluationCase,
          projectId: projectId as string,
          repositoryId: repositoryId as string,
          snapshotId: snapshotId as string,
          embeddingArtifactProfileId,
          topKLimit,
        })
      : await runCaseOnlyMode({
          evaluationCase,
          topKLimit,
        });

  writeJsonFile(outputs.json, result);
  writeFileSync(resolveOutputPath(outputs.markdown), renderMarkdown(result), 'utf8');

  console.log(`Wrote RAG sample export to ${outputs.json} (${result.mode})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
