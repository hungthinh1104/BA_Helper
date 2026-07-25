import {
  buildProductValidationScorecard,
  findCliInputArgument,
  productValidationDatasetSchema,
} from './product-validation-scorecard';

const completeCase = {
  caseId: 'cancel-paid-booking',
  repository: {
    url: 'https://github.com/example/public-nest-app',
    commitSha: '0123456789abcdef0123456789abcdef01234567',
  },
  requirement: 'Allow users to cancel paid bookings and receive a refund.',
  reviewerRole: 'TECHNICAL_BA' as const,
  measurements: {
    manualAnalysisMinutes: 90,
    assistedAnalysisMinutes: 30,
    criticalArtifactsExpected: 5,
    criticalArtifactsFound: 5,
    artifactsReviewed: 10,
    falsePositiveArtifacts: 2,
    unknownsReviewed: 4,
    usefulUnknowns: 3,
    qaScenariosReviewed: 6,
    acceptedQaScenarios: 5,
    evidenceItemsReviewed: 8,
    reviewerConfirmedEvidenceItems: 7,
    rerunOrDriftReviewed: true,
    rerunOrDriftUseful: true,
  },
  notes: 'Reviewed against the pinned public commit.',
};

describe('product validation scorecard', () => {
  it('accepts the pnpm argument separator used by the documented command', () => {
    expect(
      findCliInputArgument([
        '--',
        'tests/product-validation/dataset.template.json',
      ]),
    ).toBe('tests/product-validation/dataset.template.json');
  });

  it('aggregates the Phase 4 BA/QC metrics using weighted counts', () => {
    const scorecard = buildProductValidationScorecard({
      datasetVersion: 1,
      collectedAt: '2026-07-25',
      cases: [
        completeCase,
        {
          ...completeCase,
          caseId: 'prevent-double-refund',
          reviewerRole: 'QC' as const,
          measurements: {
            ...completeCase.measurements,
            manualAnalysisMinutes: 60,
            assistedAnalysisMinutes: 45,
            criticalArtifactsExpected: 3,
            criticalArtifactsFound: 2,
            artifactsReviewed: 5,
            falsePositiveArtifacts: 1,
            unknownsReviewed: 2,
            usefulUnknowns: 1,
            qaScenariosReviewed: 4,
            acceptedQaScenarios: 3,
            evidenceItemsReviewed: 4,
            reviewerConfirmedEvidenceItems: 3,
            rerunOrDriftReviewed: false,
            rerunOrDriftUseful: null,
          },
        },
      ],
    });

    expect(scorecard.status).toBe('INSUFFICIENT_CASES');
    expect(scorecard.metrics).toEqual({
      manualAnalysisMinutes: 150,
      assistedAnalysisMinutes: 75,
      analysisTimeReductionRate: 0.5,
      criticalArtifactRecall: 0.875,
      falsePositiveReviewBurden: 0.2,
      usefulUnknownRate: 2 / 3,
      acceptedQaScenarioRate: 0.8,
      reviewerConfirmedEvidenceRate: 10 / 12,
      rerunOrDriftUsefulnessRate: 1,
    });
  });

  it('becomes ready for a product decision only with three complete real cases', () => {
    const scorecard = buildProductValidationScorecard({
      datasetVersion: 1,
      collectedAt: '2026-07-25',
      cases: [
        completeCase,
        { ...completeCase, caseId: 'case-2' },
        { ...completeCase, caseId: 'case-3' },
      ],
    });

    expect(scorecard.status).toBe('READY_FOR_PRODUCT_DECISION');
    expect(scorecard.caseCount).toBe(3);
    expect(scorecard.reviewerRoles).toEqual(['TECHNICAL_BA']);
  });

  it('rejects inconsistent counts and non-public GitHub repositories', () => {
    expect(() =>
      productValidationDatasetSchema.parse({
        datasetVersion: 1,
        collectedAt: '2026-07-25',
        cases: [
          {
            ...completeCase,
            repository: {
              ...completeCase.repository,
              url: 'https://gitlab.com/example/private-app',
            },
            measurements: {
              ...completeCase.measurements,
              criticalArtifactsFound: 6,
              rerunOrDriftReviewed: false,
              rerunOrDriftUseful: true,
            },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects duplicate case identifiers', () => {
    expect(() =>
      productValidationDatasetSchema.parse({
        datasetVersion: 1,
        collectedAt: '2026-07-25',
        cases: [completeCase, completeCase],
      }),
    ).toThrow(/caseId values must be unique/);
  });
});
