import {
  developerStudyDatasetSchema,
  isCompletionReady,
  studyConditions,
  studyTaskFamilies,
  type DeveloperStudyDataset,
  type StudyCondition,
  type StudyTaskFamily,
} from './developer-study.schema';

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function meanRubricScore(
  rows: DeveloperStudyDataset['observations'],
  dimension: keyof DeveloperStudyDataset['observations'][number]['correctnessRubric'],
): number | null {
  return average(rows.flatMap((row) => {
    const score = row.correctnessRubric[dimension];
    return score === null ? [] : [score];
  }));
}

function getTaskFamily(dataset: DeveloperStudyDataset, taskId: string): StudyTaskFamily | undefined {
  return dataset.tasks.find((task) => task.taskId === taskId)?.taskFamily;
}

function buildTaskMetrics(dataset: DeveloperStudyDataset, condition: StudyCondition, family: StudyTaskFamily) {
  const rows = dataset.observations.filter((row) =>
    row.condition === condition && getTaskFamily(dataset, row.taskId) === family);
  const completed = rows.filter((row) => row.completionStatus === 'COMPLETED' && row.taskCorrect !== null);
  return {
    observationCount: rows.length,
    completedCount: completed.length,
    abandonedCount: rows.filter((row) => row.completionStatus === 'ABANDONED').length,
    taskCorrectRate: ratio(completed.filter((row) => row.taskCorrect).length, completed.length),
    meanElapsedSeconds: average(completed.map((row) => row.elapsedSeconds)),
    meanRubricScores: {
      behaviorAccuracy: meanRubricScore(rows, 'behaviorAccuracy'),
      sourceEvidence: meanRubricScore(rows, 'sourceEvidence'),
      testSemantics: meanRubricScore(rows, 'testSemantics'),
      uncertaintyRecognition: meanRubricScore(rows, 'uncertaintyRecognition'),
      changeSafety: meanRubricScore(rows, 'changeSafety'),
    },
  };
}

function buildConditionMetrics(dataset: DeveloperStudyDataset, condition: StudyCondition) {
  const rows = dataset.observations.filter((row) => row.condition === condition);
  const completed = rows.filter((row) => row.completionStatus === 'COMPLETED' && row.taskCorrect !== null);
  const reviewedClaims = rows.reduce((sum, row) => sum + row.claimsReviewed, 0);
  const unsupportedClaims = rows.reduce((sum, row) => sum + row.unsupportedClaims.length, 0);
  const highConfidenceIncorrect = rows.reduce((sum, row) => sum + row.incorrectConfidentConclusions, 0);
  const calibratedRows = completed.filter((row) => row.confidenceRating !== null);
  return {
    observationCount: rows.length,
    completedCount: completed.length,
    abandonedCount: rows.filter((row) => row.completionStatus === 'ABANDONED').length,
    completionRate: ratio(completed.length, rows.length),
    taskCorrectRate: ratio(completed.filter((row) => row.taskCorrect).length, completed.length),
    meanElapsedSeconds: average(completed.map((row) => row.elapsedSeconds)),
    timeToCorrectAnswerSeconds: average(completed.filter((row) => row.taskCorrect)
      .map((row) => row.elapsedSeconds)),
    confidenceCalibrationGap: average(calibratedRows.map((row) =>
      Math.abs((row.confidenceRating ?? 0) / 5 - Number(row.taskCorrect)))),
    unsupportedClaimRate: ratio(unsupportedClaims, reviewedClaims),
    incorrectConfidentConclusionRate: ratio(highConfidenceIncorrect, reviewedClaims),
    evidenceIdentificationCount: average(rows.map((row) => row.evidenceIdentifications.length)),
    navigationActions: average(rows.map((row) => row.navigationActions)),
    usefulnessRating: average(rows.flatMap((row) =>
      row.usefulnessRating === null ? [] : [row.usefulnessRating])),
    voluntaryReuseRate: ratio(
      rows.filter((row) => row.voluntaryReuse === true).length,
      rows.filter((row) => row.voluntaryReuse !== null).length,
    ),
    rubricScores: {
      behaviorAccuracy: meanRubricScore(rows, 'behaviorAccuracy'),
      sourceEvidence: meanRubricScore(rows, 'sourceEvidence'),
      testSemantics: meanRubricScore(rows, 'testSemantics'),
      uncertaintyRecognition: meanRubricScore(rows, 'uncertaintyRecognition'),
      changeSafety: meanRubricScore(rows, 'changeSafety'),
    },
    taskFamilies: Object.fromEntries(studyTaskFamilies.map((family) => [
      family,
      buildTaskMetrics(dataset, condition, family),
    ])) as Record<StudyTaskFamily, ReturnType<typeof buildTaskMetrics>>,
  };
}

function missingConditionTaskCells(dataset: DeveloperStudyDataset): string[] {
  return studyConditions.flatMap((condition) => studyTaskFamilies
    .filter((family) => !dataset.observations.some((row) =>
      row.condition === condition && getTaskFamily(dataset, row.taskId) === family))
    .map((family) => condition + '/' + family));
}

export function buildDeveloperStudyScorecard(input: unknown) {
  const dataset = developerStudyDatasetSchema.parse(input);
  const missingCells = missingConditionTaskCells(dataset);
  const caseCount = new Set(dataset.observations.map((row) => row.caseId)).size;
  const sessionCount = new Set(dataset.observations.map((row) => row.participantSessionCode)).size;
  const collectionStatus = dataset.observations.length === 0
    ? 'NOT_COLLECTED'
    : isCompletionReady(dataset) ? 'COLLECTED' : 'INCOMPLETE';

  return {
    schemaVersion: dataset.schemaVersion,
    studyStatus: dataset.studyStatus,
    groundTruthReviewStatus: dataset.groundTruthReviewStatus,
    collectionStatus,
    observationCount: dataset.observations.length,
    caseCount,
    sessionCount,
    conditionTaskCellCount: new Set(dataset.observations.map((row) =>
      row.condition + ':' + getTaskFamily(dataset, row.taskId))).size,
    missingConditionTaskCells: missingCells,
    limitations: collectionStatus === 'NOT_COLLECTED'
      ? ['No participant observations were supplied; product value is unvalidated.']
      : collectionStatus === 'INCOMPLETE'
        ? ['Study coverage is incomplete. Missing condition/task cells: ' + (missingCells.join(', ') || 'none') +
          '; distinct cases=' + caseCount + ', sessions=' + sessionCount + '.']
        : ['Collected task-level measurements do not establish causal product value or generalization.'],
    conditions: Object.fromEntries(studyConditions.map((condition) => [
      condition,
      buildConditionMetrics(dataset, condition),
    ])) as Record<StudyCondition, ReturnType<typeof buildConditionMetrics>>,
  };
}
