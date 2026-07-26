import { GetMatrixRowDetailUseCase } from './get-matrix-row-detail.usecase';

describe('GetMatrixRowDetailUseCase', () => {
  it('maps metadata risk insights to matrix risk refs and artifact related risk ids', async () => {
    const prisma = {
      impactAnalysis: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'analysis-1',
          status: 'WAITING_FOR_REVIEW',
          snapshot: {
            profile: { domain: 'BOOKING' },
          },
          sourceTarget: {
            repository: { canonicalUrl: 'https://github.com/acme/booking-demo.git' },
          },
          reviewDecisions: [{ decision: 'ACCEPTED' }],
          traceabilityLinks: [
            {
              linkType: 'AFFECTED',
              linkBasis: 'EVIDENCED',
              artifact: {
                id: 'artifact-1',
                artifactKey: 'service-method:payment.service.refund',
                name: 'PaymentService.refund',
                universalKind: 'DOMAIN_SERVICE',
                artifactType: 'SERVICE_METHOD',
                filePath: 'src/payment/payment.service.ts',
                startLine: 10,
                endLine: 20,
              },
              evidenceLinks: [
                {
                  evidence: {
                    id: 'evidence-1',
                    excerpt: 'refund(command)',
                    sourcePath: 'src/payment/payment.service.ts',
                    startLine: 10,
                    endLine: 20,
                  },
                },
              ],
            },
          ],
          insights: [
            {
              id: 'insight-risk-1',
              insightType: 'CLAIM',
              certainty: 'INFERRED',
              metadata: { kind: 'RISK' },
              title: 'Duplicate refund risk',
              description: 'Duplicate cancellation may double refund.',
              evidenceLinks: [{ evidenceId: 'evidence-1' }],
            },
            {
              id: 'insight-qa-1',
              insightType: 'QA_SCENARIO',
              certainty: 'INFERRED',
              metadata: {},
              title: 'Duplicate cancel does not double refund',
              description: 'Given: cancelled\nWhen: cancelled again\nThen: one refund',
              evidenceLinks: [{ evidenceId: 'evidence-1' }],
            },
          ],
        }),
      },
    };

    const result = await new GetMatrixRowDetailUseCase(prisma as any).execute(
      'run-1',
      'analysis-1',
    );

    expect(result.risks).toEqual([
      expect.objectContaining({
        insightId: 'insight-risk-1',
        insightType: 'CLAIM',
        relatedEvidenceIds: ['evidence-1'],
      }),
    ]);
    expect(result.impactedArtifacts[0].relatedRisks).toEqual(['insight-risk-1']);
    expect(result.impactedArtifacts[0].relatedQaScenarios).toEqual(['insight-qa-1']);
  });
});
