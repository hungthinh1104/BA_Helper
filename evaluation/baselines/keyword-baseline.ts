import type {
  BaselinePrediction,
  BaselineRun,
  EvaluationCase,
  EvaluationCandidateArtifact,
} from '../types';

const DEFAULT_TOP_K = 10;

const STOPWORDS = new Set([
  'about',
  'after',
  'allow',
  'allows',
  'also',
  'and',
  'are',
  'before',
  'being',
  'between',
  'build',
  'change',
  'changes',
  'create',
  'ensure',
  'error',
  'errors',
  'feature',
  'files',
  'flow',
  'for',
  'from',
  'have',
  'into',
  'method',
  'more',
  'must',
  'not',
  'only',
  'paid',
  'path',
  'paths',
  'requirement',
  'should',
  'that',
  'the',
  'their',
  'then',
  'this',
  'through',
  'under',
  'uses',
  'using',
  'with',
]);

const FIELD_WEIGHTS = {
  artifactName: 3,
  artifactKey: 2.5,
  filePath: 2,
  artifactType: 1.5,
  universalKind: 1.25,
  excerpt: 0.5,
} as const;

export type KeywordFieldName = keyof typeof FIELD_WEIGHTS;

export type KeywordBaselineResult = {
  rank: number;
  artifactKey: string;
  filePath: string;
  artifactType: string;
  score: number;
  matchedTokens: string[];
  retrievalReason: string;
};

export type KeywordBaselineCaseResult = {
  caseId: string;
  repo: string;
  requirementText: string;
  groundTruthFiles: string[];
  results: KeywordBaselineResult[];
  summary: {
    groundTruthHitCount: number;
    recallAt10: number;
    missedGroundTruthFiles: string[];
    unexpectedTopKFiles: string[];
  };
};

export type KeywordBaselineOutput = {
  runId: string;
  generatedAt: string;
  method: 'keyword-baseline-v0';
  topK: number;
  cases: KeywordBaselineCaseResult[];
  warnings: string[];
};

type RankedArtifact = {
  artifact: EvaluationCandidateArtifact;
  score: number;
  matchedTokens: string[];
  matchedFieldsByToken: Map<string, KeywordFieldName[]>;
};

function splitCamelCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

function normalizeInput(input: string): string {
  return splitCamelCase(input)
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .toLowerCase();
}

export function tokenizeKeywordText(input: string): string[] {
  return normalizeInput(input)
    .split(/\s+/)
    .filter((token) => token.length >= 3)
    .filter((token) => !STOPWORDS.has(token));
}

function uniqueTokens(input: string | undefined): Set<string> {
  return new Set(tokenizeKeywordText(input ?? ''));
}

function buildArtifactFieldTokens(artifact: EvaluationCandidateArtifact): Record<KeywordFieldName, Set<string>> {
  return {
    artifactName: uniqueTokens(artifact.artifactName),
    artifactKey: uniqueTokens(artifact.artifactKey),
    filePath: uniqueTokens(artifact.filePath),
    artifactType: uniqueTokens(artifact.artifactType),
    universalKind: uniqueTokens(artifact.universalKind),
    excerpt: uniqueTokens(artifact.excerpt),
  };
}

function scoreArtifact(
  queryTokens: string[],
  artifact: EvaluationCandidateArtifact,
): RankedArtifact {
  const fieldTokens = buildArtifactFieldTokens(artifact);
  const matchedFieldsByToken = new Map<string, KeywordFieldName[]>();
  let score = 0;

  for (const token of queryTokens) {
    const matchedFields: KeywordFieldName[] = [];
    for (const fieldName of Object.keys(FIELD_WEIGHTS) as KeywordFieldName[]) {
      if (fieldTokens[fieldName].has(token)) {
        score += FIELD_WEIGHTS[fieldName];
        matchedFields.push(fieldName);
      }
    }

    if (matchedFields.length > 0) {
      matchedFieldsByToken.set(token, matchedFields);
    }
  }

  return {
    artifact,
    score: Number(score.toFixed(4)),
    matchedTokens: [...matchedFieldsByToken.keys()],
    matchedFieldsByToken,
  };
}

function compareRankedArtifacts(left: RankedArtifact, right: RankedArtifact): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (left.artifact.artifactKey !== right.artifact.artifactKey) {
    return left.artifact.artifactKey.localeCompare(right.artifact.artifactKey);
  }

  return left.artifact.filePath.localeCompare(right.artifact.filePath);
}

function formatRetrievalReason(
  matchedTokens: string[],
  matchedFieldsByToken: Map<string, KeywordFieldName[]>,
): string {
  if (matchedTokens.length === 0) {
    return 'keyword overlap: none';
  }

  const parts = matchedTokens.map((token) => {
    const fields = matchedFieldsByToken.get(token) ?? [];
    return `${token}(${fields.join(',')})`;
  });

  return `keyword overlap: ${parts.join('; ')}`;
}

export function rankKeywordArtifacts(params: {
  evaluationCase: EvaluationCase;
  topK?: number;
}): KeywordBaselineResult[] {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const queryTokens = tokenizeKeywordText(params.evaluationCase.requirementText);

  return params.evaluationCase.candidateArtifacts
    .map((artifact) => scoreArtifact(queryTokens, artifact))
    .filter((item) => item.score > 0)
    .sort(compareRankedArtifacts)
    .slice(0, topK)
    .map((item, index) => ({
      rank: index + 1,
      artifactKey: item.artifact.artifactKey,
      filePath: item.artifact.filePath,
      artifactType: item.artifact.artifactType,
      score: item.score,
      matchedTokens: item.matchedTokens,
      retrievalReason: formatRetrievalReason(
        item.matchedTokens,
        item.matchedFieldsByToken,
      ),
    }));
}

function buildCaseSummary(params: {
  evaluationCase: EvaluationCase;
  results: KeywordBaselineResult[];
  topK: number;
}): KeywordBaselineCaseResult['summary'] {
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

export function runKeywordBaselineDetailed(params: {
  cases: EvaluationCase[];
  topK?: number;
  generatedAt?: string;
  runId?: string;
}): KeywordBaselineOutput {
  const topK = params.topK ?? DEFAULT_TOP_K;
  const warnings: string[] = [];

  const cases = params.cases.map((evaluationCase) => {
    const results = rankKeywordArtifacts({ evaluationCase, topK });
    if (results.length === 0) {
      warnings.push(
        `No keyword-overlap results for case ${evaluationCase.id}; output is empty for topK=${topK}.`,
      );
    }

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
    runId: params.runId ?? `keyword-baseline-v0-${topK}`,
    generatedAt: params.generatedAt ?? new Date().toISOString(),
    method: 'keyword-baseline-v0',
    topK,
    cases,
    warnings,
  };
}

export function runKeywordBaseline(cases: EvaluationCase[]): BaselineRun {
  const detailedRun = runKeywordBaselineDetailed({ cases, topK: DEFAULT_TOP_K });
  const predictions: BaselinePrediction[] = detailedRun.cases.map((caseResult) => {
    const rankedFiles = caseResult.results.map((result) => result.filePath);
    return {
      caseId: caseResult.caseId,
      predictedFiles: rankedFiles.slice(0, 5),
      rankedFiles,
      evidenceBackedPredictedFiles: [],
      reviewItems: rankedFiles.slice(0, 5).length,
      notes:
        caseResult.results.length === 0
          ? 'No candidate artifacts had deterministic keyword overlap with the requirement text.'
          : undefined,
    };
  });

  return {
    baselineId: 'keyword-baseline',
    mode: 'deterministic',
    status: 'COMPLETED',
    notes:
      'Deterministic keyword-overlap baseline using requirement text against artifact key, file path, artifact name, artifact type, universal kind, and excerpt.',
    predictions,
  };
}
