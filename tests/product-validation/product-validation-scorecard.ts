import { z } from 'zod';

const countSchema = z.number().int().nonnegative();
const durationSchema = z.number().finite().nonnegative();
const studyConditionSchema = z.enum([
  'EXISTING_WORKFLOW',
  'TEXTUAL_EVIDENCE',
  'VISUAL_TEST_TRACE',
]);
const studyTaskSchema = z.enum([
  'EXPLAIN_BEHAVIOR',
  'UNDERSTAND_TESTED_BEHAVIOR',
  'PREDICT_NEW_SCENARIO',
  'VERIFY_EVIDENCE',
  'IDENTIFY_UNCERTAINTY',
]);

const measurementsSchema = z
  .object({
    manualAnalysisMinutes: durationSchema,
    assistedAnalysisMinutes: durationSchema,
    criticalArtifactsExpected: countSchema,
    criticalArtifactsFound: countSchema,
    artifactsReviewed: countSchema,
    falsePositiveArtifacts: countSchema,
    unknownsReviewed: countSchema,
    usefulUnknowns: countSchema,
    qaScenariosReviewed: countSchema,
    acceptedQaScenarios: countSchema,
    evidenceItemsReviewed: countSchema,
    reviewerConfirmedEvidenceItems: countSchema,
    rerunOrDriftReviewed: z.boolean(),
    rerunOrDriftUseful: z.boolean().nullable(),
  })
  .superRefine((value, context) => {
    const boundedCounts: Array<[keyof typeof value, keyof typeof value]> = [
      ['criticalArtifactsFound', 'criticalArtifactsExpected'],
      ['falsePositiveArtifacts', 'artifactsReviewed'],
      ['usefulUnknowns', 'unknownsReviewed'],
      ['acceptedQaScenarios', 'qaScenariosReviewed'],
      ['reviewerConfirmedEvidenceItems', 'evidenceItemsReviewed'],
    ];

    for (const [numerator, denominator] of boundedCounts) {
      if (Number(value[numerator]) > Number(value[denominator])) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [numerator],
          message: `${numerator} cannot exceed ${denominator}`,
        });
      }
    }

    if (value.rerunOrDriftReviewed !== (value.rerunOrDriftUseful !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rerunOrDriftUseful'],
        message:
          'rerunOrDriftUseful must be boolean only when rerunOrDriftReviewed is true',
      });
    }
  });

const validationCaseSchema = z.object({
  caseId: z.string().trim().min(1),
  analysisId: z.string().uuid(),
  reviewedReportSnapshotId: z.string().uuid(),
  reviewedAt: z.string().datetime({ offset: true }),
  repository: z.object({
    url: z
      .string()
      .url()
      .regex(/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/, 'must be a public GitHub repository URL'),
    commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
  }),
  requirement: z.string().trim().min(1),
  reviewerRole: z.enum(['TECHNICAL_BA', 'QC']),
  measurements: measurementsSchema,
  notes: z.string().trim().max(2_000).optional(),
});

const studyObservationSchema = z
  .object({
    observationId: z.string().trim().min(1).max(120),
    reviewerSessionId: z.string().regex(/^[A-Za-z0-9._:-]{1,120}$/),
    caseId: z.string().trim().min(1),
    task: studyTaskSchema,
    condition: studyConditionSchema,
    repositoryCommitSha: z.string().regex(/^[a-f0-9]{40}$/i),
    toolCommitSha: z.string().regex(/^[a-f0-9]{40}$/i),
    observedAt: z.string().datetime({ offset: true }),
    elapsedSeconds: durationSchema,
    taskCorrect: z.boolean(),
    confidenceRating: z.number().finite().min(1).max(5),
    navigationActions: countSchema,
    claimsReviewed: countSchema,
    incorrectConfidentConclusions: countSchema,
    usefulnessRating: z.number().finite().min(1).max(5).nullable(),
    voluntaryReuse: z.boolean().nullable(),
  })
  .superRefine((value, context) => {
    if (value.incorrectConfidentConclusions > value.claimsReviewed) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['incorrectConfidentConclusions'],
        message: 'incorrectConfidentConclusions cannot exceed claimsReviewed',
      });
    }
  });

export const productValidationDatasetSchema = z
  .object({
    datasetVersion: z.literal(1),
    collectedAt: z.string().date(),
    tool: z.object({
      commitSha: z.string().regex(/^[a-f0-9]{40}$/i),
      appVersion: z.string().trim().min(1),
    }),
    cases: z.array(validationCaseSchema).min(1),
    studyObservations: z.array(studyObservationSchema).max(2_000).default([]),
  })
  .superRefine((value, context) => {
    const uniqueFields = [
      'caseId',
      'analysisId',
      'reviewedReportSnapshotId',
    ] as const;
    for (const field of uniqueFields) {
      const values = value.cases.map((item) => item[field]);
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cases'],
          message: `${field} values must be unique`,
        });
      }
    }

    const caseById = new Map(value.cases.map((item) => [item.caseId, item]));
    const observationIds = new Set<string>();
    const sessionTasks = new Set<string>();
    for (const observation of value.studyObservations) {
      if (!caseById.has(observation.caseId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['studyObservations'],
          message: `Study observation ${observation.observationId} references an unknown caseId.`,
        });
        continue;
      }
      const reviewedCase = caseById.get(observation.caseId)!;
      if (reviewedCase.repository.commitSha.toLowerCase() !== observation.repositoryCommitSha.toLowerCase()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['studyObservations'],
          message: `Study observation ${observation.observationId} is not pinned to its case repository commit.`,
        });
      }
      if (value.tool.commitSha.toLowerCase() !== observation.toolCommitSha.toLowerCase()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['studyObservations'],
          message: `Study observation ${observation.observationId} is not pinned to the dataset tool commit.`,
        });
      }
      if (observationIds.has(observation.observationId)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyObservations'],
          message: 'study observation IDs must be unique' });
      }
      observationIds.add(observation.observationId);
      const sessionTask = `${observation.reviewerSessionId}:${observation.task}`;
      if (sessionTasks.has(sessionTask)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['studyObservations'],
          message: 'A reviewer session cannot repeat the same task across conditions.' });
      }
      sessionTasks.add(sessionTask);
    }
  });

export type ProductValidationDataset = z.infer<
  typeof productValidationDatasetSchema
>;
export type StudyCondition = z.infer<typeof studyConditionSchema>;
export type StudyTask = z.infer<typeof studyTaskSchema>;

export function findCliInputArgument(arguments_: string[]): string | undefined {
  return findCliInputArguments(arguments_)[0];
}

export function findCliInputArguments(arguments_: string[]): string[] {
  return arguments_.filter((argument) => argument !== '--');
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

const STUDY_CONDITIONS: StudyCondition[] = [
  'EXISTING_WORKFLOW', 'TEXTUAL_EVIDENCE', 'VISUAL_TEST_TRACE',
];
const STUDY_TASKS: StudyTask[] = [
  'EXPLAIN_BEHAVIOR', 'UNDERSTAND_TESTED_BEHAVIOR', 'PREDICT_NEW_SCENARIO',
  'VERIFY_EVIDENCE', 'IDENTIFY_UNCERTAINTY',
];
const MIN_STUDY_CASES = 3;
const MIN_STUDY_SESSIONS = 3;

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function buildStudyConditionScorecard(
  observations: ProductValidationDataset['studyObservations'],
  condition: StudyCondition,
) {
  const rows = observations.filter((item) => item.condition === condition);
  const correct = rows.filter((item) => item.taskCorrect).length;
  const confidenceCalibrationGaps = rows.map((item) => Math.abs(
    item.confidenceRating / 5 - (item.taskCorrect ? 1 : 0),
  ));
  return {
    observationCount: rows.length,
    taskCorrectRate: ratio(correct, rows.length),
    correctBehaviorExplanationRate: ratio(
      rows.filter((item) => item.task === 'EXPLAIN_BEHAVIOR' && item.taskCorrect).length,
      rows.filter((item) => item.task === 'EXPLAIN_BEHAVIOR').length,
    ),
    testedBehaviorUnderstandingRate: ratio(
      rows.filter((item) => item.task === 'UNDERSTAND_TESTED_BEHAVIOR' && item.taskCorrect).length,
      rows.filter((item) => item.task === 'UNDERSTAND_TESTED_BEHAVIOR').length,
    ),
    unseenScenarioPredictionAccuracy: ratio(
      rows.filter((item) => item.task === 'PREDICT_NEW_SCENARIO' && item.taskCorrect).length,
      rows.filter((item) => item.task === 'PREDICT_NEW_SCENARIO').length,
    ),
    sourceEvidenceIdentificationAccuracy: ratio(
      rows.filter((item) => item.task === 'VERIFY_EVIDENCE' && item.taskCorrect).length,
      rows.filter((item) => item.task === 'VERIFY_EVIDENCE').length,
    ),
    unsupportedConclusionRate: ratio(
      rows.reduce((sum, item) => sum + item.incorrectConfidentConclusions, 0),
      rows.reduce((sum, item) => sum + item.claimsReviewed, 0),
    ),
    confidenceCalibrationGap: average(confidenceCalibrationGaps),
    timeToCorrectUnderstandingSeconds: average(rows.filter((item) => item.taskCorrect)
      .map((item) => item.elapsedSeconds)),
    navigationActions: average(rows.map((item) => item.navigationActions)),
    usefulnessRating: average(rows.flatMap((item) => item.usefulnessRating === null ? [] : [item.usefulnessRating])),
    voluntaryReuseRate: ratio(
      rows.filter((item) => item.voluntaryReuse === true).length,
      rows.filter((item) => item.voluntaryReuse !== null).length,
    ),
  };
}

function hasMeasuredCaseData(dataset: ProductValidationDataset): boolean {
  return dataset.cases.some(({ measurements }) => Object.entries(measurements)
    .some(([key, value]) => key !== 'rerunOrDriftUseful' && key !== 'rerunOrDriftReviewed' && Number(value) > 0)
    || measurements.rerunOrDriftReviewed);
}

function missingStudyCells(observations: ProductValidationDataset['studyObservations']): string[] {
  return STUDY_CONDITIONS.flatMap((condition) => STUDY_TASKS
    .filter((task) => !observations.some((observation) =>
      observation.condition === condition && observation.task === task))
    .map((task) => `${condition}/${task}`));
}

function studyCellCount(observations: ProductValidationDataset['studyObservations']): number {
  return new Set(observations.map((observation) => `${observation.condition}/${observation.task}`)).size;
}

function studyCaseCount(observations: ProductValidationDataset['studyObservations']): number {
  return new Set(observations.map((observation) => observation.caseId)).size;
}

function studySessionCount(observations: ProductValidationDataset['studyObservations']): number {
  return new Set(observations.map((observation) => observation.reviewerSessionId)).size;
}

export function buildProductValidationScorecard(input: unknown) {
  const dataset = productValidationDatasetSchema.parse(input);
  const totals = dataset.cases.reduce(
    (result, item) => {
      const measurement = item.measurements;
      result.manualMinutes += measurement.manualAnalysisMinutes;
      result.assistedMinutes += measurement.assistedAnalysisMinutes;
      result.criticalExpected += measurement.criticalArtifactsExpected;
      result.criticalFound += measurement.criticalArtifactsFound;
      result.artifactsReviewed += measurement.artifactsReviewed;
      result.falsePositives += measurement.falsePositiveArtifacts;
      result.unknownsReviewed += measurement.unknownsReviewed;
      result.usefulUnknowns += measurement.usefulUnknowns;
      result.qaReviewed += measurement.qaScenariosReviewed;
      result.qaAccepted += measurement.acceptedQaScenarios;
      result.evidenceReviewed += measurement.evidenceItemsReviewed;
      result.evidenceConfirmed +=
        measurement.reviewerConfirmedEvidenceItems;
      if (measurement.rerunOrDriftReviewed) {
        result.rerunsReviewed += 1;
        result.rerunsUseful += Number(measurement.rerunOrDriftUseful);
      }
      return result;
    },
    {
      manualMinutes: 0,
      assistedMinutes: 0,
      criticalExpected: 0,
      criticalFound: 0,
      artifactsReviewed: 0,
      falsePositives: 0,
      unknownsReviewed: 0,
      usefulUnknowns: 0,
      qaReviewed: 0,
      qaAccepted: 0,
      evidenceReviewed: 0,
      evidenceConfirmed: 0,
      rerunsReviewed: 0,
      rerunsUseful: 0,
    },
  );
  const missingCells = missingStudyCells(dataset.studyObservations);
  const measuredStudyCaseCount = studyCaseCount(dataset.studyObservations);
  const measuredStudySessionCount = studySessionCount(dataset.studyObservations);
  const studyStatus = dataset.studyObservations.length === 0
    ? ('NOT_COLLECTED' as const)
    : missingCells.length === 0 && measuredStudyCaseCount >= MIN_STUDY_CASES &&
        measuredStudySessionCount >= MIN_STUDY_SESSIONS
      ? ('COLLECTED' as const)
      : ('INCOMPLETE' as const);

  return {
    datasetVersion: dataset.datasetVersion,
    collectedAt: dataset.collectedAt,
    status: dataset.cases.length < 3
      ? ('INSUFFICIENT_CASES' as const)
      : hasMeasuredCaseData(dataset)
        ? ('READY_FOR_PRODUCT_DECISION' as const)
        : ('INSUFFICIENT_OBSERVATIONS' as const),
    caseCount: dataset.cases.length,
    reviewerRoles: [...new Set(dataset.cases.map((item) => item.reviewerRole))].sort(),
    metrics: {
      manualAnalysisMinutes: totals.manualMinutes,
      assistedAnalysisMinutes: totals.assistedMinutes,
      analysisTimeReductionRate: ratio(
        totals.manualMinutes - totals.assistedMinutes,
        totals.manualMinutes,
      ),
      criticalArtifactRecall: ratio(
        totals.criticalFound,
        totals.criticalExpected,
      ),
      falsePositiveReviewBurden: ratio(
        totals.falsePositives,
        totals.artifactsReviewed,
      ),
      usefulUnknownRate: ratio(
        totals.usefulUnknowns,
        totals.unknownsReviewed,
      ),
      acceptedQaScenarioRate: ratio(totals.qaAccepted, totals.qaReviewed),
      reviewerConfirmedEvidenceRate: ratio(
        totals.evidenceConfirmed,
        totals.evidenceReviewed,
      ),
      rerunOrDriftUsefulnessRate: ratio(
        totals.rerunsUseful,
        totals.rerunsReviewed,
      ),
    },
    study: {
      status: studyStatus,
      observationCount: dataset.studyObservations.length,
      caseCount: measuredStudyCaseCount,
      sessionCount: measuredStudySessionCount,
      conditionTaskCellCount: studyCellCount(dataset.studyObservations),
      conditions: Object.fromEntries(STUDY_CONDITIONS.map((condition) => [
        condition, buildStudyConditionScorecard(dataset.studyObservations, condition),
      ])) as Record<StudyCondition, ReturnType<typeof buildStudyConditionScorecard>>,
      limitations: studyStatus === 'NOT_COLLECTED'
        ? ['No participant observations were supplied; product value is unvalidated.']
        : studyStatus === 'INCOMPLETE'
          ? [`Study coverage is incomplete: ${missingCells.length ? `missing condition/task cells ${missingCells.slice(0, 10).join(', ')}${missingCells.length > 10 ? ', ...' : ''}; ` : ''}observations=${dataset.studyObservations.length}, cases=${measuredStudyCaseCount}, sessions=${measuredStudySessionCount}.`]
          : ['Study observations are task-level measurements and do not establish causal product-market fit.'],
    },
  };
}

type Scorecard = ReturnType<typeof buildProductValidationScorecard>;
type RateMetric = Exclude<
  keyof Scorecard['metrics'],
  'manualAnalysisMinutes' | 'assistedAnalysisMinutes'
>;

const HIGHER_IS_BETTER: RateMetric[] = [
  'analysisTimeReductionRate',
  'criticalArtifactRecall',
  'usefulUnknownRate',
  'acceptedQaScenarioRate',
  'reviewerConfirmedEvidenceRate',
  'rerunOrDriftUsefulnessRate',
];

const LOWER_IS_BETTER: RateMetric[] = ['falsePositiveReviewBurden'];

function scopeMismatchReasons(
  candidate: ProductValidationDataset,
  baseline: ProductValidationDataset,
): string[] {
  if (candidate.cases.length !== baseline.cases.length) {
    return ['Candidate and baseline must contain the same number of cases.'];
  }

  const baselineById = new Map(
    baseline.cases.map((item) => [item.caseId, item]),
  );
  const reasons: string[] = [];

  for (const candidateCase of candidate.cases) {
    const baselineCase = baselineById.get(candidateCase.caseId);
    const sameScope =
      baselineCase &&
      baselineCase.repository.url === candidateCase.repository.url &&
      baselineCase.repository.commitSha === candidateCase.repository.commitSha &&
      baselineCase.requirement === candidateCase.requirement &&
      baselineCase.reviewerRole === candidateCase.reviewerRole &&
      baselineCase.measurements.manualAnalysisMinutes ===
        candidateCase.measurements.manualAnalysisMinutes &&
      baselineCase.measurements.criticalArtifactsExpected ===
        candidateCase.measurements.criticalArtifactsExpected;

    if (!sameScope) {
      reasons.push(
        `Case ${candidateCase.caseId} does not match the baseline scope.`,
      );
    }
  }

  return reasons;
}

export function compareProductValidationDatasets(
  candidateInput: unknown,
  baselineInput: unknown,
  options: { rateTolerance?: number } = {},
) {
  const candidate = productValidationDatasetSchema.parse(candidateInput);
  const baseline = productValidationDatasetSchema.parse(baselineInput);
  const candidateScorecard = buildProductValidationScorecard(candidate);
  const baselineScorecard = buildProductValidationScorecard(baseline);
  const reasons = scopeMismatchReasons(candidate, baseline);

  if (candidate.tool.commitSha === baseline.tool.commitSha) {
    reasons.push(
      'Candidate and baseline must identify different tool commits.',
    );
  }
  if (candidate.collectedAt < baseline.collectedAt) {
    reasons.push('Candidate collection date must not precede the baseline.');
  }

  if (
    candidateScorecard.status !== 'READY_FOR_PRODUCT_DECISION' ||
    baselineScorecard.status !== 'READY_FOR_PRODUCT_DECISION'
  ) {
    reasons.push('Candidate and baseline each require at least three cases with measured observations.');
  }

  const rateTolerance = options.rateTolerance ?? 0.01;
  const metrics = [...HIGHER_IS_BETTER, ...LOWER_IS_BETTER].map((metric) => {
    const candidateValue = candidateScorecard.metrics[metric];
    const baselineValue = baselineScorecard.metrics[metric];
    const rawDelta =
      candidateValue === null || baselineValue === null
        ? null
        : candidateValue - baselineValue;
    const improvementDelta =
      rawDelta === null
        ? null
        : LOWER_IS_BETTER.includes(metric)
          ? -rawDelta
          : rawDelta;
    const tolerance =
      metric === 'criticalArtifactRecall' ? 0 : rateTolerance;

    if ((candidateValue === null) !== (baselineValue === null)) {
      reasons.push(`${metric} is not observable in both datasets.`);
    }

    return {
      metric,
      baseline: baselineValue,
      candidate: candidateValue,
      delta: rawDelta,
      outcome:
        improvementDelta === null
          ? ('NOT_OBSERVED' as const)
          : improvementDelta > tolerance
            ? ('IMPROVED' as const)
            : improvementDelta < -tolerance
              ? ('REGRESSED' as const)
              : ('UNCHANGED' as const),
    };
  });
  const improvements = metrics
    .filter((item) => item.outcome === 'IMPROVED')
    .map((item) => item.metric);
  const regressions = metrics
    .filter((item) => item.outcome === 'REGRESSED')
    .map((item) => item.metric);

  return {
    decision:
      reasons.length > 0
        ? ('INCONCLUSIVE' as const)
        : regressions.length > 0 || improvements.length === 0
          ? ('DEFER' as const)
          : ('PROMOTE' as const),
    rateTolerance,
    candidateTool: candidate.tool,
    baselineTool: baseline.tool,
    candidateCaseCount: candidate.cases.length,
    baselineCaseCount: baseline.cases.length,
    candidateCollectedAt: candidate.collectedAt,
    baselineCollectedAt: baseline.collectedAt,
    candidateStudyStatus: candidateScorecard.study.status,
    baselineStudyStatus: baselineScorecard.study.status,
    candidateStudyObservationCount: candidate.studyObservations.length,
    baselineStudyObservationCount: baseline.studyObservations.length,
    candidateStudyCellCount: studyCellCount(candidate.studyObservations),
    baselineStudyCellCount: studyCellCount(baseline.studyObservations),
    candidateStudyCaseCount: studyCaseCount(candidate.studyObservations),
    baselineStudyCaseCount: studyCaseCount(baseline.studyObservations),
    candidateStudySessionCount: studySessionCount(candidate.studyObservations),
    baselineStudySessionCount: studySessionCount(baseline.studyObservations),
    improvements,
    regressions,
    reasons,
    metrics,
  };
}
