import type {
  BaselinePrediction,
  BaselineRun,
  EvaluationCase,
} from '../types';

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length >= 3);
}

function scoreOverlap(queryTokens: string[], candidateText: string): number {
  const candidateTokens = new Set(tokenize(candidateText));
  return queryTokens.reduce(
    (score, token) => score + (candidateTokens.has(token) ? 1 : 0),
    0,
  );
}

export function runKeywordBaseline(cases: EvaluationCase[]): BaselineRun {
  const predictions: BaselinePrediction[] = cases.map((evaluationCase) => {
    const queryTokens = tokenize(evaluationCase.requirementText);
    const ranked = evaluationCase.candidateArtifacts
      .map((artifact) => ({
        artifact,
        score: scoreOverlap(
          queryTokens,
          `${artifact.filePath} ${artifact.artifactName} ${artifact.excerpt}`,
        ),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);

    const rankedFiles = ranked.map((item) => item.artifact.filePath);

    return {
      caseId: evaluationCase.id,
      predictedFiles: rankedFiles.slice(0, 5),
      rankedFiles,
      evidenceBackedPredictedFiles: rankedFiles.slice(0, 5),
      reviewItems: rankedFiles.slice(0, 5).length,
      notes:
        evaluationCase.candidateArtifacts.length === 0
          ? 'No candidateArtifacts provided for offline lexical scoring.'
          : undefined,
    };
  });

  return {
    baselineId: 'keyword-baseline',
    mode: 'deterministic',
    status: 'COMPLETED',
    predictions,
    notes:
      'Deterministic lexical overlap between requirement text and candidate file path, artifact name, and excerpt.',
  };
}
