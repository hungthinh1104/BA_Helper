import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { ArtifactRepository } from '../../apps/api/src/modules/artifact/infrastructure/artifact.repository';
import { FakeEmbeddingProvider } from '../../apps/api/src/modules/embedding/infrastructure/fake-embedding.provider';
import { EmbeddingChunkRepository } from '../../apps/api/src/modules/embedding/infrastructure/embedding-chunk.repository';
import { GraphRepository } from '../../apps/api/src/modules/graph/infrastructure/graph.repository';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { loadDataset, writeJsonFile } from '../io';
import { summarizeEvidenceQuality } from '../src/evidence-quality';
import type {
  CandidateArtifact,
  ReqImpactEvaluationCase,
  RetrievedArtifactResult,
} from '../src/types';

type ExportMode = 'CASE_ONLY' | 'CURRENT_HYBRID';

type RagSampleExport = {
  runId: string;
  generatedAt: string;
  mode: ExportMode;
  caseId: string;
  repo: string;
  requirementText: string;
  groundTruthFiles: string[];
  topK: RetrievedArtifactResultWithExtras[];
  summary: {
    topKCount: number;
    groundTruthHitCount: number;
    recallAtK: number;
    evidenceCoverage: number;
    locationOnlyEvidenceCount: number;
    codeLikeEvidenceCount: number;
  };
  warnings: string[];
};

type RetrievedArtifactResultWithExtras = RetrievedArtifactResult & {
  universalKind?: string;
  strategyVersion?: string;
  evidence: RetrievedArtifactResult['evidence'] & {
    excerptPreview: string;
  };
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

function buildRunId(mode: ExportMode, caseId: string): string {
  return `rag-sample:${mode.toLowerCase()}:${caseId}:${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')}`;
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
  const groundTruthHitCount = topK.filter((item) => truthSet.has(item.filePath))
    .length;
  const evidenceCount = topK.filter((item) => item.evidence.hasEvidence).length;
  const locationOnlyEvidenceCount = topK.filter(
    (item) => item.evidence.isLocationOnly,
  ).length;
  const codeLikeEvidenceCount = topK.filter((item) => item.evidence.isCodeLike)
    .length;

  return {
    topKCount: topK.length,
    groundTruthHitCount,
    recallAtK:
      truthSet.size === 0 ? 0 : Number((groundTruthHitCount / truthSet.size).toFixed(4)),
    evidenceCoverage:
      topK.length === 0 ? 0 : Number((evidenceCount / topK.length).toFixed(4)),
    locationOnlyEvidenceCount,
    codeLikeEvidenceCount,
  };
}

function renderMarkdown(result: RagSampleExport): string {
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
    'Changed files are used here as a practical proxy ground truth. This export does not claim method-level accuracy or final research results.',
    '',
    '## Summary',
    '',
    `- Top-K count: ${result.summary.topKCount}`,
    `- Ground-truth hits in top-K: ${result.summary.groundTruthHitCount}`,
    `- Recall@K: ${result.summary.recallAtK}`,
    `- Evidence coverage: ${result.summary.evidenceCoverage}`,
    `- Location-only evidence count: ${result.summary.locationOnlyEvidenceCount}`,
    `- Code-like evidence count: ${result.summary.codeLikeEvidenceCount}`,
    '',
    '## Top-K',
    '',
    '| Rank | File | Type | Kind | Score | Signals | Evidence | Location-only | Code-like | Preview |',
    '| ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |',
  ];

  for (const item of result.topK) {
    lines.push(
      `| ${item.rank} | ${item.filePath} | ${item.artifactType} | ${item.universalKind ?? ''} | ${(
        item.finalScore ?? item.score ?? 0
      ).toFixed(4)} | ${item.retrievalSignals.join(', ')} | ${item.evidence.hasEvidence ? 'yes' : 'no'} | ${item.evidence.isLocationOnly ? 'yes' : 'no'} | ${item.evidence.isCodeLike ? 'yes' : 'no'} | ${item.evidence.excerptPreview.replace(/\|/g, '\\|')} |`,
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

async function readArtifactEvidencePreview(params: {
  prisma: PrismaService;
  snapshotId: string;
  artifactId: string;
}): Promise<string | undefined> {
  const chunk = await params.prisma.embeddingChunk.findFirst({
    where: {
      snapshotId: params.snapshotId,
      artifactId: params.artifactId,
    },
    orderBy: [{ tokenCount: 'desc' }, { stableChunkId: 'asc' }],
    select: {
      content: true,
    },
  });

  return chunk?.content ?? undefined;
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
  topKLimit: number;
}): Promise<RagSampleExport> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'CURRENT_HYBRID mode requires DATABASE_URL because it reads the current snapshot, artifacts, graph edges, and embedding chunks from PostgreSQL.',
    );
  }

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const retrievalService = new HybridRetrievalService(
      new EmbeddingChunkRepository(prisma),
      new FakeEmbeddingProvider(),
      new ArtifactRepository(prisma),
      new GraphRepository(prisma),
      prisma,
    );

    const retrievedArtifacts = await retrievalService.retrieve({
      projectId: params.projectId,
      repositoryId: params.repositoryId,
      snapshotId: params.snapshotId,
      changeRequest: params.evaluationCase.requirementText,
      maxResults: params.topKLimit,
      expandGraph: true,
    });

    const topK: RetrievedArtifactResultWithExtras[] = [];
    for (const [index, retrieved] of retrievedArtifacts.entries()) {
      const excerpt = await readArtifactEvidencePreview({
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
        evidence,
      });
    }

    return {
      runId: buildRunId('CURRENT_HYBRID', params.evaluationCase.id),
      generatedAt: new Date().toISOString(),
      mode: 'CURRENT_HYBRID',
      caseId: params.evaluationCase.id,
      repo: params.evaluationCase.repo,
      requirementText: params.evaluationCase.requirementText,
      groundTruthFiles: params.evaluationCase.groundTruth.files,
      topK,
      summary: computeSummary(params.evaluationCase.groundTruth.files, topK),
      warnings: [
        'CURRENT_HYBRID mode uses FakeEmbeddingProvider for deterministic local query embedding and does not call external network services.',
        'Changed files are proxy ground truth, not absolute truth.',
      ],
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const caseId = parseArg('--caseId');
  if (!caseId) {
    throw new Error('Missing required argument: --caseId <id>');
  }

  const projectId = parseArg('--projectId');
  const repositoryId = parseArg('--repositoryId');
  const snapshotId = parseArg('--snapshotId');
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

  const result = isCurrentHybridMode
    ? await runCurrentHybridMode({
        evaluationCase,
        projectId: projectId as string,
        repositoryId: repositoryId as string,
        snapshotId: snapshotId as string,
        topKLimit,
      })
    : await runCaseOnlyMode({
        evaluationCase,
        topKLimit,
      });

  writeJsonFile('evaluation/results/rag-samples.v0.json', result);
  writeFileSync(
    resolveOutputPath('evaluation/results/rag-samples.v0.md'),
    renderMarkdown(result),
    'utf8',
  );

  console.log(
    `Wrote RAG sample export to evaluation/results/rag-samples.v0.json (${result.mode})`,
  );
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
