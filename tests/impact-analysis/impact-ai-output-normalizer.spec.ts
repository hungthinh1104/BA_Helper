import { AiOutputError } from '@ba-helper/application';
import { normalizeImpactAiOutput } from '../../packages/application/src/impact-analysis/application/steps/impact-ai-output-normalizer';
import type { ImpactAnalysisAiResponse } from '../../packages/application/src/impact-analysis/ai/ai.schema';
import type { ImpactEvidenceCollectionResult } from '../../packages/application/src/impact-analysis/domain/impact-analysis-step.types';

const baseInsight = {
  insightKey: 'claim:cancel-refund',
  insightType: 'CLAIM' as const,
  certainty: 'EVIDENCED' as const,
  confidence: 0.8,
  title: 'Cancellation triggers refund.',
  description: 'Cancellation triggers refund.',
  evidenceKeys: ['service-method:payment.service.refund'],
};

describe('normalizeImpactAiOutput', () => {
  it('downgrades EVIDENCED output when evidence cannot be resolved', () => {
    const result = normalizeImpactAiOutput({
      impactAnalysisId: 'analysis-1',
      response: responseWith({
        ...baseInsight,
        evidenceKeys: ['missing-artifact'],
      }),
      evidenceResult: evidenceResult(),
    });

    expect(result.insightInputs).toEqual([
      expect.objectContaining({
        insightKey: 'claim:cancel-refund',
        certainty: 'UNKNOWN',
        metadata: expect.objectContaining({
          evidenceIntegrity: 'EVIDENCED_DOWNGRADED_NO_PERSISTED_EVIDENCE',
          originalCertainty: 'EVIDENCED',
        }),
      }),
    ]);
    expect(result.insightEvidenceMap).toEqual([]);
  });

  it('downgrades INFERRED output without contextual evidence', () => {
    const result = normalizeImpactAiOutput({
      impactAnalysisId: 'analysis-1',
      response: responseWith({
        ...baseInsight,
        insightKey: 'risk:refund-policy',
        certainty: 'INFERRED',
        evidenceKeys: [],
      }),
      evidenceResult: evidenceResult(),
    });

    expect(result.insightInputs[0]).toEqual(
      expect.objectContaining({
        certainty: 'UNKNOWN',
        metadata: expect.objectContaining({
          evidenceIntegrity: 'INFERRED_DOWNGRADED_NO_CONTEXTUAL_EVIDENCE',
        }),
      }),
    );
  });

  it('forces QUESTION output to UNKNOWN certainty even when it cites evidence', () => {
    const result = normalizeImpactAiOutput({
      impactAnalysisId: 'analysis-1',
      response: responseWith({
        ...baseInsight,
        insightKey: 'question:who-may-cancel',
        insightType: 'QUESTION',
        certainty: 'EVIDENCED',
        evidenceKeys: ['api:booking.controller.cancel'],
      }),
      evidenceResult: evidenceResult(),
    });

    expect(result.insightInputs[0]).toEqual(
      expect.objectContaining({
        insightType: 'QUESTION',
        certainty: 'UNKNOWN',
        confidence: null,
      }),
    );
    expect(result.insightEvidenceMap).toEqual([
      { insightKey: 'question:who-may-cancel', artifactKeys: ['api:booking.controller.cancel'] },
    ]);
  });

  it('rejects duplicate insight keys after merging legacy unknowns', () => {
    expect(() =>
      normalizeImpactAiOutput({
        impactAnalysisId: 'analysis-1',
        response: {
          insights: [baseInsight],
          unknowns: [
            {
              insightKey: baseInsight.insightKey,
              description: 'Duplicate unknown.',
              reasoning: 'Duplicate key.',
            },
          ],
        },
        evidenceResult: evidenceResult(),
      }),
    ).toThrow(AiOutputError);
  });

  it('downgrades malformed QA scenarios to UNKNOWN', () => {
    const result = normalizeImpactAiOutput({
      impactAnalysisId: 'analysis-1',
      response: responseWith({
        ...baseInsight,
        insightKey: 'qa:duplicate-cancel',
        insightType: 'QA_SCENARIO',
        certainty: 'INFERRED',
        title: 'Duplicate cancel.',
        description: 'Verify duplicate cancel.',
        evidenceKeys: ['service-method:payment.service.refund'],
      }),
      evidenceResult: evidenceResult(),
    });

    expect(result.insightInputs[0]).toEqual(
      expect.objectContaining({
        insightType: 'UNKNOWN',
        certainty: 'UNKNOWN',
        metadata: expect.objectContaining({
          qaIntegrity: 'QA_SCENARIO_DOWNGRADED_NOT_TESTABLE',
          originalInsightType: 'QA_SCENARIO',
        }),
      }),
    );
  });

  it('preserves risk metadata and links resolvable contextual evidence', () => {
    const result = normalizeImpactAiOutput({
      impactAnalysisId: 'analysis-1',
      response: responseWith({
        ...baseInsight,
        insightKey: 'risk:refund-policy-gap',
        certainty: 'INFERRED',
        kind: 'risk',
        severity: 'HIGH',
        category: 'refund-policy',
        evidenceKeys: ['service-method:payment.service.refund'],
      }),
      evidenceResult: evidenceResult(),
    });

    expect(result.insightInputs[0]).toEqual(
      expect.objectContaining({
        certainty: 'INFERRED',
        metadata: expect.objectContaining({
          kind: 'risk',
          severity: 'HIGH',
          category: 'refund-policy',
        }),
      }),
    );
    expect(result.insightEvidenceMap).toEqual([
      {
        insightKey: 'risk:refund-policy-gap',
        artifactKeys: ['service-method:payment.service.refund'],
      },
    ]);
  });
});

function responseWith(
  insight: ImpactAnalysisAiResponse['insights'][number],
): ImpactAnalysisAiResponse {
  return {
    insights: [insight],
    unknowns: [],
  };
}

function evidenceResult(): ImpactEvidenceCollectionResult {
  const artifacts = [
    {
      id: 'a1',
      artifactKey: 'api:booking.controller.cancel',
      artifactType: 'API_ROUTE',
      name: 'BookingController.cancel',
      filePath: 'src/booking/booking.controller.ts',
      startLine: 1,
      endLine: 5,
    },
    {
      id: 'a2',
      artifactKey: 'service-method:payment.service.refund',
      artifactType: 'SERVICE_METHOD',
      name: 'PaymentService.refund',
      filePath: 'src/payment/payment.service.ts',
      startLine: 1,
      endLine: 5,
    },
  ];
  const evidence = [
    { id: 'e1', artifactId: 'a1', excerpt: 'api:booking.controller.cancel' },
    { id: 'e2', artifactId: 'a2', excerpt: 'service-method:payment.service.refund' },
  ];

  return {
    retrievedArtifacts: [],
    artifactByKey: new Map(artifacts.map((artifact) => [artifact.artifactKey, artifact])),
    evidenceById: new Map(evidence.map((item) => [item.artifactId, item])),
    evidenceByKey: new Map([
      ['api:booking.controller.cancel', evidence[0]],
      ['service-method:payment.service.refund', evidence[1]],
    ]),
    traceabilityLinks: [],
    retrievalMetadata: {
      strategy: 'HYBRID',
      maxArtifacts: 12,
      artifactCount: 0,
      vectorSignalCount: 0,
    },
  };
}
