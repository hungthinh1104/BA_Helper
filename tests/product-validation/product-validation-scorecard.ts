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
  return arguments_.find((argument) => argument !== '--');
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
