import type { EvaluationCase, EvaluationCandidateArtifact } from '../types';
import { tokenizeKeywordText } from './keyword-baseline';

const DEFAULT_TOP_K = 10;
const K1 = 1.2;
const B = 0.75;

export type Bm25BaselineResult = {
  rank: number;
  artifactKey: string;
  filePath: string;
  artifactType: string;
  score: number;
  matchedTokens: string[];
  retrievalReason: string;
};

export type Bm25BaselineCaseResult = {
  caseId: string;
  repo: string;
  requirementText: string;
  groundTruthFiles: string[];
  results: Bm25BaselineResult[];
  summary: {
    groundTruthHitCount: number;
    recallAt10: number;
    missedGroundTruthFiles: string[];
    unexpectedTopKFiles: string[];
  };
};

export type Bm25BaselineOutput = {
  runId: string;
  generatedAt: string;
  method: 'bm25-baseline-v0';
  topK: number;
  cases: Bm25BaselineCaseResult[];
  warnings: string[];
};

type ArtifactDocument = {
  artifact: EvaluationCandidateArtifact;
  tokens: string[];
  tokenFrequencies: Map<string, number>;
  length: number;
};

type ScoredArtifact = {
  artifact: EvaluationCandidateArtifact;
  score: number;
  matchedTokens: string[];
};

export function buildBm25DocumentText(artifact: EvaluationCandidateArtifact): string {
  return [
    artifact.artifactKey,
    artifact.filePath,
    artifact.artifactName,
    artifact.artifactType,
    artifact.universalKind ?? '',
    artifact.excerpt ?? '',
  ].join(' ');
}

function buildTokenFrequencies(tokens: string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }
  return frequencies;
}

function buildArtifactDocument(artifact: EvaluationCandidateArtifact): ArtifactDocument {
  const tokens = tokenizeKeywordText(buildBm25DocumentText(artifact));
  return {
    artifact,
    tokens,
    tokenFrequencies: buildTokenFrequencies(tokens),
    length: tokens.length,
  };
}

export function computeBm25Idf(params: { documentCount: number; documentFrequency: number }): number {
  const value = Math.log(
    1 + (params.documentCount - params.documentFrequency + 0.5) / (params.documentFrequency + 0.5),
  );
  return Number(Math.max(value, 0).toFixed(6));
}

function computeTermScore(params: {
  termFrequency: number;
  idf: number;
  documentLength: number;
  averageDocumentLength: number;
}): number {
  if (params.termFrequency === 0 || params.idf === 0) {
    return 0;
  }

  const denominator =
    params.termFrequency +
    K1 * (1 - B + B * (params.documentLength / params.averageDocumentLength));

  return (
    params.idf * ((params.termFrequency * (K1 + 1)) / denominator)
  );
}

function compareScoredArtifacts(left: ScoredArtifact, right: ScoredArtifact): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.artifact.artifactKey !== right.artifact.artifactKey) {
    return left.artifact.artifactKey.localeCompare(right.artifact.artifactKey);
  }

  return left.artifact.filePath.localeCompare(right.artifact.filePath);
}

function buildCaseSummary(params: {
  evaluationCase: EvaluationCase;
  results: Bm25BaselineResult[];
  topK: number;
}): Bm25BaselineCaseResult['summary'] {
  const topKFiles = params.results.slice(0, params.topK).map((result) => result.filePath);
  const topKFileSet = new Set(topKFiles);
  const groundTruthFiles = params.evaluationCase.groundTruth.files;
  const hitFiles = groundTruthFiles.filter((filePath) => topKFileSet.has(filePath));
  const missedGroundTruthFiles = groundTruthFiles.filter(
    (filePath) => !topKFileSet.has(filePath),
  );
  const unexpectedTopKFiles = [...new Set(topKFiles)].filter(
    (filePath) => !groundTruthFiles.includes(filePath),
  );

  return {
    groundTruthHitCount: hitFiles.length,
    recallAt10:
      groundTruthFiles.length === 0
        ? 0
        : Number((hitFiles.length / groundTruthFiles.length).toFixed(4)),
    missedGroundTruthFiles,
    unexpectedTopKFiles,
  };
}

export function rankBm25Artifacts(params: {
  evaluationCase: EvaluationCase;
  topK?: number;
}): Bm25BaselineResult[] {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const queryTokens = [...new Set(tokenizeKeywordText(params.evaluationCase.requirementText))];
  const documents = params.evaluationCase.candidateArtifacts.map(buildArtifactDocument);
  const documentCount = documents.length;
  const averageDocumentLength =
    documentCount === 0
      ? 1
      : documents.reduce((sum, document) => sum + document.length, 0) / documentCount || 1;

  const documentFrequencyByToken = new Map<string, number>();
  for (const token of queryTokens) {
    let documentFrequency = 0;
    for (const document of documents) {
      if (document.tokenFrequencies.has(token)) {
        documentFrequency += 1;
      }
    }
    documentFrequencyByToken.set(token, documentFrequency);
  }

  return documents
    .map((document) => {
      let score = 0;
      const matchedTokens: string[] = [];

      for (const token of queryTokens) {
        const termFrequency = document.tokenFrequencies.get(token) ?? 0;
        if (termFrequency === 0) {
          continue;
        }
        matchedTokens.push(token);
        score += computeTermScore({
          termFrequency,
          idf: computeBm25Idf({
            documentCount,
            documentFrequency: documentFrequencyByToken.get(token) ?? 0,
          }),
          documentLength: document.length,
          averageDocumentLength,
        });
      }

      return {
        artifact: document.artifact,
        score: Number(score.toFixed(6)),
        matchedTokens,
      };
    })
    .filter((item) => item.score > 0)
    .sort(compareScoredArtifacts)
    .slice(0, topK)
    .map((item, index) => ({
      rank: index + 1,
      artifactKey: item.artifact.artifactKey,
      filePath: item.artifact.filePath,
      artifactType: item.artifact.artifactType,
      score: item.score,
      matchedTokens: item.matchedTokens,
      retrievalReason: 'BM25 lexical score over candidate artifact fields',
    }));
}

export function runBm25BaselineDetailed(params: {
  cases: EvaluationCase[];
  topK?: number;
  generatedAt?: string;
  runId?: string;
}): Bm25BaselineOutput {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const warnings = [
    'BM25 baseline is lexical only; it does not use embeddings, DB, LLM, or HybridRetrievalService.',
    'Changed files are proxy ground truth.',
    'File-level only.',
  ];

  const cases = params.cases.map((evaluationCase) => {
    const results = rankBm25Artifacts({ evaluationCase, topK });
    return {
      caseId: evaluationCase.id,
      repo: evaluationCase.repo,
      requirementText: evaluationCase.requirementText,
      groundTruthFiles: [...evaluationCase.groundTruth.files],
      results,
      summary: buildCaseSummary({
        evaluationCase,
        results,
        topK,
      }),
    };
  });

  return {
    runId: params.runId ?? `bm25-baseline-v0-${topK}`,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    method: 'bm25-baseline-v0',
    topK,
    cases,
    warnings,
  };
}
