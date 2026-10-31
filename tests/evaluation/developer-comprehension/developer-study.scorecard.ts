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

const PRIMARY_TASK_LIMIT_SECONDS = 1_800;

function primaryTimeToCorrect(row: DeveloperStudyDataset['observations'][number]): number {
  return row.completionStatus === 'COMPLETED' && row.taskCorrect === true
    ? Math.min(row.elapsedSeconds, PRIMARY_TASK_LIMIT_SECONDS)
    : PRIMARY_TASK_LIMIT_SECONDS;
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
    primaryTimeToCorrectSeconds: average(rows.map(primaryTimeToCorrect)),
    criticalImpactRecall: average(rows.flatMap((row) =>
      row.criticalImpactRecall == null ? [] : [row.criticalImpactRecall])),
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
    primaryTimeToCorrectSeconds: average(rows.map(primaryTimeToCorrect)),
    timeToCorrectAnswerSeconds: average(completed.filter((row) => row.taskCorrect)
      .map((row) => row.elapsedSeconds)),
    phaseTimesSeconds: {
      setup: average(rows.flatMap((row) => row.phaseTimes ? [row.phaseTimes.setupSeconds] : [])),
      scan: average(rows.flatMap((row) => row.phaseTimes ? [row.phaseTimes.scanSeconds] : [])),
      investigation: average(rows.flatMap((row) => row.phaseTimes ? [row.phaseTimes.investigationSeconds] : [])),
      verification: average(rows.flatMap((row) => row.phaseTimes ? [row.phaseTimes.verificationSeconds] : [])),
      rework: average(rows.flatMap((row) => row.phaseTimes ? [row.phaseTimes.reworkSeconds] : [])),
    },
    criticalImpactRecall: average(rows.flatMap((row) =>
      row.criticalImpactRecall == null ? [] : [row.criticalImpactRecall])),
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

function familyMetric(dataset: DeveloperStudyDataset, condition: StudyCondition, family: StudyTaskFamily,
  metric: 'primaryTime' | 'correctness' | 'criticalImpactRecall' | 'unsupportedConfidentClaimRate'): number | null {
  const rows = dataset.observations.filter((row) =>
    row.condition === condition && getTaskFamily(dataset, row.taskId) === family);
  if (metric === 'primaryTime') return average(rows.map(primaryTimeToCorrect));
  if (metric === 'criticalImpactRecall') return average(rows.flatMap((row) =>
    row.criticalImpactRecall == null ? [] : [row.criticalImpactRecall]));
  if (metric === 'correctness') {
    const completed = rows.filter((row) => row.completionStatus === 'COMPLETED' && row.taskCorrect !== null);
    return ratio(completed.filter((row) => row.taskCorrect).length, completed.length);
  }
  const claimsReviewed = rows.reduce((sum, row) => sum + row.claimsReviewed, 0);
  const incorrectConfident = rows.reduce((sum, row) => sum + row.incorrectConfidentConclusions, 0);
  return ratio(incorrectConfident, claimsReviewed);
}

function equalFamilyMetric(dataset: DeveloperStudyDataset, condition: StudyCondition,
  metric: 'primaryTime' | 'correctness' | 'criticalImpactRecall' | 'unsupportedConfidentClaimRate') {
  const familyValues = studyTaskFamilies.map((family) => familyMetric(dataset, condition, family, metric));
  return familyValues.every((value): value is number => value !== null)
    ? average(familyValues)
    : null;
}

function buildPracticalValueAssessment(dataset: DeveloperStudyDataset) {
  const metrics = Object.fromEntries(studyConditions.map((condition) => [condition, {
    equallyWeightedPrimaryTimeToCorrectSeconds: equalFamilyMetric(dataset, condition, 'primaryTime'),
    equallyWeightedCorrectnessRate: equalFamilyMetric(dataset, condition, 'correctness'),
    equallyWeightedCriticalImpactRecall: equalFamilyMetric(dataset, condition, 'criticalImpactRecall'),
    equallyWeightedUnsupportedConfidentClaimRate: equalFamilyMetric(dataset, condition, 'unsupportedConfidentClaimRate'),
  }])) as Record<StudyCondition, {
    equallyWeightedPrimaryTimeToCorrectSeconds: number | null;
    equallyWeightedCorrectnessRate: number | null;
    equallyWeightedCriticalImpactRecall: number | null;
    equallyWeightedUnsupportedConfidentClaimRate: number | null;
  }>;
  const visual = metrics.VISUAL_TEST_TRACE;
  const compare = (baseline: StudyCondition, minimumReduction: number) => {
    const reference = metrics[baseline];
    const timeReduction = reference.equallyWeightedPrimaryTimeToCorrectSeconds !== null &&
      reference.equallyWeightedPrimaryTimeToCorrectSeconds > 0 &&
      visual.equallyWeightedPrimaryTimeToCorrectSeconds !== null
      ? (reference.equallyWeightedPrimaryTimeToCorrectSeconds - visual.equallyWeightedPrimaryTimeToCorrectSeconds) /
        reference.equallyWeightedPrimaryTimeToCorrectSeconds
      : null;
    const correctnessNotLower = visual.equallyWeightedCorrectnessRate !== null &&
      reference.equallyWeightedCorrectnessRate !== null
      ? visual.equallyWeightedCorrectnessRate >= reference.equallyWeightedCorrectnessRate : null;
    const criticalImpactRecallNotLower = visual.equallyWeightedCriticalImpactRecall !== null &&
      reference.equallyWeightedCriticalImpactRecall !== null
      ? visual.equallyWeightedCriticalImpactRecall >= reference.equallyWeightedCriticalImpactRecall : null;
    const unsupportedConfidentClaimsNotHigher = visual.equallyWeightedUnsupportedConfidentClaimRate !== null &&
      reference.equallyWeightedUnsupportedConfidentClaimRate !== null
      ? visual.equallyWeightedUnsupportedConfidentClaimRate <= reference.equallyWeightedUnsupportedConfidentClaimRate : null;
    return {
      baseline,
      minimumTimeReduction: minimumReduction,
      observedTimeReduction: timeReduction,
      timeThresholdMet: timeReduction === null ? null : timeReduction >= minimumReduction,
      correctnessNotLower,
      criticalImpactRecallNotLower,
      unsupportedConfidentClaimsNotHigher,
    };
  };
  const comparisons = {
    versusExistingWorkflow: compare('EXISTING_WORKFLOW', 0.15),
    versusTextualEvidence: compare('TEXTUAL_EVIDENCE', 0.10),
  };
  const checks = Object.values(comparisons).flatMap((comparison) => [
    comparison.timeThresholdMet,
    comparison.correctnessNotLower,
    comparison.criticalImpactRecallNotLower,
    comparison.unsupportedConfidentClaimsNotHigher,
  ]);
  const status = checks.some((check) => check === null)
    ? 'NOT_EVALUABLE'
    : checks.every((check) => check === true) ? 'THRESHOLDS_MET' : 'THRESHOLDS_NOT_MET';
  return {
    status,
    primaryTimeLimitSeconds: PRIMARY_TASK_LIMIT_SECONDS,
    taskFamilyWeighting: 'EQUAL',
    metrics,
    comparisons,
    limitations: ['Small exploratory pilot; estimates are descriptive and do not establish causal or generalizable value.'],
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
    practicalValueAssessment: buildPracticalValueAssessment(dataset),
  };
}
