import { GetMatrixRowDetailUseCase } from './get-matrix-row-detail.usecase';

const evidenceLink = (evidenceId: string) => ({
  evidenceId,
  evidence: {
    id: evidenceId,
    snapshotId: 'snapshot-1',
    artifactId: 'artifact-1',
    requirementRevisionId: null,
    artifact: { snapshotId: 'snapshot-1' },
  },
});

describe('GetMatrixRowDetailUseCase', () => {
  it('maps metadata risk insights to matrix risk refs and artifact related risk ids', async () => {
    const prisma = {
      impactAnalysis: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'analysis-1',
          snapshotId: 'snapshot-1',
          requirementRevisionId: 'revision-1',
          status: 'WAITING_FOR_REVIEW',
          snapshot: {
            id: 'snapshot-1',
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
                snapshotId: 'snapshot-1',
                artifactKey: 'service-method:payment.service.refund',
                name: 'PaymentService.refund',
                universalKind: 'DOMAIN_SERVICE',
                artifactType: 'SERVICE_METHOD',
                filePath: 'src/payment/payment.service.ts',
                startLine: 10,
                endLine: 20,
              },
              retrievalMetadata: {
                method: 'HYBRID',
                signals: ['VECTOR', 'KIND'],
                score: { final: 0.84 },
                diagnostics: {
                  version: 'retrieval-diagnostics@0.1.0',
                  lexicalScoreNorm: 0.62,
                  vectorScoreNorm: 0.81,
                  graphBoostNorm: 0.2,
                  kindBoostNorm: 0.1,
                  domainBoostNorm: 0.15,
                  matchedIntentLabels: ['API', 'SERVICE'],
                  universalKind: 'API_ENDPOINT',
                  repositoryProfile: { domain: 'BOOKING' },
                  finalScore: 0.84,
                },
              },
              evidenceLinks: [
                evidenceLink('evidence-1'),
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
              evidenceLinks: [evidenceLink('evidence-1')],
            },
            {
              id: 'insight-qa-1',
              insightType: 'QA_SCENARIO',
              certainty: 'INFERRED',
              metadata: {},
              title: 'Duplicate cancel does not double refund',
              description: 'Given: cancelled\nWhen: cancelled again\nThen: one refund',
              evidenceLinks: [evidenceLink('evidence-1')],
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
    expect(result.impactedArtifacts[0].retrievalDiagnostics).toMatchObject({
      version: 'retrieval-diagnostics@0.1.0',
      vectorScoreNorm: 0.81,
    });
    expect(result.impactedArtifacts[0].evidenceItems[0].retrievalSignals).toEqual(['VECTOR', 'KIND']);
  });
});
