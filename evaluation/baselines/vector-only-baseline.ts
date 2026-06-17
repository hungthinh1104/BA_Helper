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

function vectorize(tokens: string[]): Map<string, number> {
  const vector = new Map<string, number>();
  for (const token of tokens) {
    vector.set(token, (vector.get(token) ?? 0) + 1);
  }
  return vector;
}

function cosineSimilarity(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (const [, value] of left) {
    leftMagnitude += value * value;
  }

  for (const [token, value] of right) {
    rightMagnitude += value * value;
    dot += (left.get(token) ?? 0) * value;
  }

  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

export function runVectorOnlyBaseline(cases: EvaluationCase[]): BaselineRun {
  const predictions: BaselinePrediction[] = cases.map((evaluationCase) => {
    const queryVector = vectorize(tokenize(evaluationCase.requirementText));
    const ranked = evaluationCase.candidateArtifacts
      .map((artifact) => ({
        artifact,
        score: cosineSimilarity(
          queryVector,
          vectorize(
            tokenize(
              `${artifact.filePath} ${artifact.artifactName} ${artifact.excerpt}`,
            ),
          ),
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
      evidenceBackedPredictedFiles: [],
      reviewItems: rankedFiles.slice(0, 5).length,
      notes:
        evaluationCase.candidateArtifacts.length === 0
          ? 'No candidateArtifacts provided for offline vector-only scoring.'
          : undefined,
    };
  });

  return {
    baselineId: 'vector-only-baseline',
    mode: 'deterministic',
    status: 'COMPLETED',
    predictions,
    notes:
      'Deterministic sparse token-vector cosine similarity baseline. This is an offline retrieval baseline, not a hosted embedding provider benchmark.',
  };
}
