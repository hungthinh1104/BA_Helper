import { z } from 'zod';

const countSchema = z.number().int().nonnegative();
const durationSchema = z.number().finite().nonnegative();

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

export const productValidationDatasetSchema = z
  .object({
    datasetVersion: z.literal(1),
    collectedAt: z.string().date(),
    cases: z.array(validationCaseSchema).min(1),
  })
  .superRefine((value, context) => {
    const ids = value.cases.map((item) => item.caseId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cases'],
        message: 'caseId values must be unique',
      });
    }
  });

export type ProductValidationDataset = z.infer<
  typeof productValidationDatasetSchema
>;

export function findCliInputArgument(arguments_: string[]): string | undefined {
  return findCliInputArguments(arguments_)[0];
}

export function findCliInputArguments(arguments_: string[]): string[] {
  return arguments_.filter((argument) => argument !== '--');
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
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

  return {
    datasetVersion: dataset.datasetVersion,
    collectedAt: dataset.collectedAt,
    status:
      dataset.cases.length >= 3
        ? ('READY_FOR_PRODUCT_DECISION' as const)
        : ('INSUFFICIENT_CASES' as const),
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

  if (
    candidateScorecard.status !== 'READY_FOR_PRODUCT_DECISION' ||
    baselineScorecard.status !== 'READY_FOR_PRODUCT_DECISION'
  ) {
    reasons.push('Candidate and baseline each require at least three cases.');
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
    candidateCollectedAt: candidate.collectedAt,
    baselineCollectedAt: baseline.collectedAt,
    improvements,
    regressions,
    reasons,
    metrics,
  };
}
