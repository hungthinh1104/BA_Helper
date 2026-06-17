import {
  rankKeywordArtifacts,
  runKeywordBaselineDetailed,
  tokenizeKeywordText,
} from './keyword-baseline';
import type { EvaluationCase } from '../types';

function buildCase(overrides: Partial<EvaluationCase> = {}): EvaluationCase {
  return {
    id: 'case-001',
    repo: 'owner/repo',
    baseSha: 'abc123',
    requirementText: 'Allow users to cancel paid bookings and receive refunds.',
    groundTruth: {
      files: ['src/booking/booking.service.ts'],
    },
    candidateArtifacts: [
      {
        artifactKey: 'service:booking.cancelBooking',
        filePath: 'src/booking/booking.service.ts',
        artifactName: 'cancelBooking',
        artifactType: 'SERVICE_METHOD',
        universalKind: 'DOMAIN_SERVICE',
      },
      {
        artifactKey: 'service:inventory.syncInventory',
        filePath: 'src/inventory/inventory.service.ts',
        artifactName: 'syncInventory',
        artifactType: 'SERVICE_METHOD',
        universalKind: 'DOMAIN_SERVICE',
      },
    ],
    ...overrides,
  };
}

describe('keyword-baseline tokenization', () => {
  it('splits camelCase tokens', () => {
    expect(tokenizeKeywordText('cancelBooking refundPayment')).toEqual([
      'cancel',
      'booking',
      'refund',
      'payment',
    ]);
  });

  it('splits snake_case tokens', () => {
    expect(tokenizeKeywordText('cancel_booking refund_payment')).toEqual([
      'cancel',
      'booking',
      'refund',
      'payment',
    ]);
  });

  it('splits path segments and punctuation', () => {
    expect(
      tokenizeKeywordText('src/payment/refund.service.ts (POST /refunds/:id)'),
    ).toEqual(['src', 'payment', 'refund', 'service', 'post', 'refunds']);
  });

  it('removes stopwords and short tokens', () => {
    expect(
      tokenizeKeywordText('Allow users to fix the refund flow in an API'),
    ).toEqual(['users', 'fix', 'refund', 'api']);
  });
});

describe('keyword-baseline ranking', () => {
  it('uses deterministic tie-breakers by artifactKey then filePath', () => {
    const evaluationCase = buildCase({
      candidateArtifacts: [
        {
          artifactKey: 'service:alpha.cancelBooking',
          filePath: 'src/zeta/booking.service.ts',
          artifactName: 'cancelBooking',
          artifactType: 'SERVICE_METHOD',
        },
        {
          artifactKey: 'service:beta.cancelBooking',
          filePath: 'src/alpha/booking.service.ts',
          artifactName: 'cancelBooking',
          artifactType: 'SERVICE_METHOD',
        },
      ],
    });

    const results = rankKeywordArtifacts({ evaluationCase });

    expect(results.map((result) => result.artifactKey)).toEqual([
      'service:alpha.cancelBooking',
      'service:beta.cancelBooking',
    ]);
  });

  it('does not use ground truth during ranking', () => {
    const candidateArtifacts = [
      {
        artifactKey: 'service:booking.cancelBooking',
        filePath: 'src/booking/booking.service.ts',
        artifactName: 'cancelBooking',
        artifactType: 'SERVICE_METHOD',
      },
      {
        artifactKey: 'service:payment.refundPayment',
        filePath: 'src/payment/payment.service.ts',
        artifactName: 'refundPayment',
        artifactType: 'SERVICE_METHOD',
      },
    ];

    const first = rankKeywordArtifacts({
      evaluationCase: buildCase({
        groundTruth: {
          files: ['src/booking/booking.service.ts'],
        },
        candidateArtifacts,
      }),
    });
    const second = rankKeywordArtifacts({
      evaluationCase: buildCase({
        groundTruth: {
          files: ['src/payment/payment.service.ts'],
        },
        candidateArtifacts,
      }),
    });

    expect(first).toEqual(second);
  });

  it('ranks the relevant artifact above an unrelated artifact when tokens overlap', () => {
    const evaluationCase = buildCase({
      requirementText: 'Add refund cancellation handling for booking.',
      candidateArtifacts: [
        {
          artifactKey: 'service:inventory.syncInventory',
          filePath: 'src/inventory/inventory.service.ts',
          artifactName: 'syncInventory',
          artifactType: 'SERVICE_METHOD',
          excerpt: 'Synchronize stock balances for warehouse inventory.',
        },
        {
          artifactKey: 'service:payment.refundBooking',
          filePath: 'src/payment/refund.service.ts',
          artifactName: 'refundBooking',
          artifactType: 'SERVICE_METHOD',
          excerpt: 'Handle booking refund cancellation and refund state updates.',
        },
      ],
    });

    const [first] = rankKeywordArtifacts({ evaluationCase });

    expect(first?.artifactKey).toBe('service:payment.refundBooking');
    expect(first?.matchedTokens).toEqual(
      expect.arrayContaining(['refund', 'booking', 'cancellation']),
    );
  });

  it('builds per-case summaries without using non-topK files', () => {
    const run = runKeywordBaselineDetailed({
      cases: [
        buildCase({
          candidateArtifacts: [
            {
              artifactKey: 'service:booking.cancelBooking',
              filePath: 'src/booking/booking.service.ts',
              artifactName: 'cancelBooking',
              artifactType: 'SERVICE_METHOD',
            },
            {
              artifactKey: 'service:payment.refundPayment',
              filePath: 'src/payment/payment.service.ts',
              artifactName: 'refundPayment',
              artifactType: 'SERVICE_METHOD',
            },
          ],
        }),
      ],
      topK: 1,
      generatedAt: '2026-06-17T00:00:00.000Z',
    });

    expect(run.cases[0]?.summary).toEqual({
      groundTruthHitCount: 1,
      recallAt10: 1,
      missedGroundTruthFiles: [],
      unexpectedTopKFiles: [],
    });
  });
});
