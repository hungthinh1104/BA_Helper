import { BuildMultiRepoImpactMatrixReadModel } from './build-multi-repo-impact-matrix.read-model';
import { NotFoundException } from '@nestjs/common';

describe('BuildMultiRepoImpactMatrixReadModel', () => {
  it('aggregates metrics correctly', async () => {
    const runRepo = {
      findById: jest.fn().mockResolvedValue({
        id: 'run-1',
        requirementRevision: { title: 'Test Request' },
      }),
    };

    const prisma = {
      impactAnalysis: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ana-1',
            status: 'COMPLETED',
            snapshot: {
              repositoryId: 'repo-1',
              profile: { domain: 'BOOKING', language: 'TYPESCRIPT', framework: 'NESTJS' },
              repository: { canonicalUrl: 'https://github.com/org/Booking-API' },
            },
            traceabilityLinks: [
              { artifactId: 'art-1', linkType: 'AFFECTED', artifact: { universalKind: 'API_ENDPOINT' } },
              { artifactId: 'art-2', linkType: 'AFFECTED', artifact: { universalKind: 'API_ENDPOINT' } },
              { artifactId: 'art-3', linkType: 'AFFECTED', artifact: { universalKind: 'DOMAIN_SERVICE' } },
            ],
            insights: [
              { insightType: 'UNKNOWN' },
              { insightType: 'CLAIM', certainty: 'CONFLICTING' },
              { insightType: 'QA_SCENARIO' },
            ],
            reviewDecisions: [{ decision: 'ACCEPTED' }],
          },
          {
            id: 'ana-2',
            status: 'WAITING_FOR_REVIEW',
            snapshot: {
              repositoryId: 'repo-2',
              profile: null, // missing profile
              repository: { canonicalUrl: 'https://github.com/org/Payment-API' },
            },
            traceabilityLinks: [],
            insights: [],
            reviewDecisions: [],
          },
        ]),
      },
    } as any;

    const useCase = new BuildMultiRepoImpactMatrixReadModel(prisma, runRepo as any);
    const result = await useCase.execute('run-1');

    expect(result.runId).toBe('run-1');
    expect(result.requirementTitle).toBe('Test Request');
    expect(result.rows).toHaveLength(2);

    const bookingRow = result.rows[0];
    expect(bookingRow.domain).toBe('BOOKING');
    expect(bookingRow.artifactCounts.API_ENDPOINT).toBe(2);
    expect(bookingRow.artifactCounts.DOMAIN_SERVICE).toBe(1);
    expect(bookingRow.unknownCount).toBe(1);
    expect(bookingRow.conflictingCount).toBe(1);
    expect(bookingRow.riskCount).toBe(2);
    expect(bookingRow.qaScenarioCount).toBe(1);
    expect(bookingRow.evidenceCount).toBe(3);
    expect(bookingRow.latestReviewDecision).toBe('ACCEPTED');
    expect(bookingRow.blockingReason).toBe('NONE');

    const paymentRow = result.rows[1];
    expect(paymentRow.domain).toBe('UNKNOWN');
    expect(paymentRow.language).toBe('UNKNOWN');
    expect(paymentRow.framework).toBe('UNKNOWN');
    expect(paymentRow.artifactCounts.API_ENDPOINT).toBe(0);
    expect(paymentRow.evidenceCount).toBe(0);
    expect(paymentRow.riskCount).toBe(0);
    expect(paymentRow.latestReviewDecision).toBeNull();
    // In waiting for review, blocking reason is WAITING_FOR_REVIEW
    expect(paymentRow.blockingReason).toBe('WAITING_FOR_REVIEW');

    expect(result.summary.totalRepositories).toBe(2);
    expect(result.summary.domainsImpacted).toEqual(['BOOKING']);
    expect(result.summary.totalArtifacts).toBe(3);
    expect(result.summary.totalRisks).toBe(2);
    expect(result.summary.totalQaScenarios).toBe(1);
    expect(result.summary.acceptedRepos).toBe(1);
    expect(result.summary.blockedRepos).toBe(1);
  });

  it('throws not found if run missing', async () => {
    const runRepo = { findById: jest.fn().mockResolvedValue(null) };
    const useCase = new BuildMultiRepoImpactMatrixReadModel({} as any, runRepo as any);
    
    await expect(useCase.execute('run-X')).rejects.toThrow(NotFoundException);
  });
});
