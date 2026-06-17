import {
  buildBm25DocumentText,
  computeBm25Idf,
  rankBm25Artifacts,
} from './bm25-baseline';
import { tokenizeKeywordText } from './keyword-baseline';
import type { EvaluationCase } from '../types';

function buildCase(overrides: Partial<EvaluationCase> = {}): EvaluationCase {
  return {
    id: 'case-001',
    repo: 'owner/repo',
    baseSha: 'abc123',
    requirementText: 'Fix refund booking validation error',
    groundTruth: {
      files: ['src/payment/refund.service.ts'],
    },
    candidateArtifacts: [
      {
        artifactKey: 'file:src/payment/refund.service.ts',
        filePath: 'src/payment/refund.service.ts',
        artifactName: 'refundService',
        artifactType: 'SERVICE_FILE',
        excerpt: 'Handle refund booking validation error state.',
      },
      {
        artifactKey: 'file:src/inventory/inventory.service.ts',
        filePath: 'src/inventory/inventory.service.ts',
        artifactName: 'inventoryService',
        artifactType: 'SERVICE_FILE',
        excerpt: 'Synchronize stock balances and warehouse levels.',
      },
    ],
    ...overrides,
  };
}

describe('bm25 baseline', () => {
  it('matches keyword baseline token normalization', () => {
    const artifact = {
      artifactKey: 'file:src/payment/refund-service.ts',
      filePath: 'src/payment/refund-service.ts',
      artifactName: 'refundService',
      artifactType: 'SERVICE_FILE',
      universalKind: 'DOMAIN_SERVICE',
      excerpt: 'HandleRefund validation_error',
    };

    expect(tokenizeKeywordText(buildBm25DocumentText(artifact))).toEqual([
      'file',
      'src',
      'payment',
      'refund',
      'service',
      'src',
      'payment',
      'refund',
      'service',
      'refund',
      'service',
      'service',
      'file',
      'domain',
      'service',
      'handle',
      'refund',
      'validation',
    ]);
  });

  it('computes deterministic non-negative idf', () => {
    expect(computeBm25Idf({ documentCount: 10, documentFrequency: 10 })).toBeGreaterThanOrEqual(0);
    expect(computeBm25Idf({ documentCount: 10, documentFrequency: 2 })).toBe(
      computeBm25Idf({ documentCount: 10, documentFrequency: 2 }),
    );
  });

  it('rewards higher term frequency when all else is equal', () => {
    const results = rankBm25Artifacts({
      evaluationCase: buildCase({
        requirementText: 'refund refund validation',
        candidateArtifacts: [
          {
            artifactKey: 'file:src/payment/refund.service.ts',
            filePath: 'src/payment/refund.service.ts',
            artifactName: 'refundService',
            artifactType: 'SERVICE_FILE',
            excerpt: 'refund refund validation',
          },
          {
            artifactKey: 'file:src/payment/payment.service.ts',
            filePath: 'src/payment/payment.service.ts',
            artifactName: 'paymentService',
            artifactType: 'SERVICE_FILE',
            excerpt: 'refund validation',
          },
        ],
      }),
    });

    expect(results[0]?.artifactKey).toBe('file:src/payment/refund.service.ts');
  });

  it('allows a shorter focused document to beat a longer noisy document', () => {
    const results = rankBm25Artifacts({
      evaluationCase: buildCase({
        requirementText: 'refund validation',
        candidateArtifacts: [
          {
            artifactKey: 'file:src/payment/refund.service.ts',
            filePath: 'src/payment/refund.service.ts',
            artifactName: 'refundService',
            artifactType: 'SERVICE_FILE',
            excerpt: 'refund validation',
          },
          {
            artifactKey: 'file:src/payment/noisy.service.ts',
            filePath: 'src/payment/noisy.service.ts',
            artifactName: 'noisyService',
            artifactType: 'SERVICE_FILE',
            excerpt:
              'refund validation extra unrelated warehouse inventory booking logistics shipping random token set',
          },
        ],
      }),
    });

    expect(results[0]?.artifactKey).toBe('file:src/payment/refund.service.ts');
  });

  it('uses deterministic tie-break by artifactKey then filePath', () => {
    const results = rankBm25Artifacts({
      evaluationCase: buildCase({
        requirementText: 'refund',
        candidateArtifacts: [
          {
            artifactKey: 'file:b',
            filePath: 'src/b.ts',
            artifactName: 'refundThing',
            artifactType: 'SERVICE_FILE',
            excerpt: 'refund',
          },
          {
            artifactKey: 'file:a',
            filePath: 'src/a.ts',
            artifactName: 'refundThing',
            artifactType: 'SERVICE_FILE',
            excerpt: 'refund',
          },
        ],
      }),
    });

    expect(results.map((result) => result.artifactKey)).toEqual(['file:a', 'file:b']);
  });

  it('does not use ground truth during ranking', () => {
    const candidateArtifacts = [
      {
        artifactKey: 'file:src/a.ts',
        filePath: 'src/a.ts',
        artifactName: 'refundService',
        artifactType: 'SERVICE_FILE',
        excerpt: 'refund validation',
      },
      {
        artifactKey: 'file:src/b.ts',
        filePath: 'src/b.ts',
        artifactName: 'paymentService',
        artifactType: 'SERVICE_FILE',
        excerpt: 'booking payment',
      },
    ];

    const first = rankBm25Artifacts({
      evaluationCase: buildCase({
        groundTruth: { files: ['src/a.ts'] },
        candidateArtifacts,
      }),
    });
    const second = rankBm25Artifacts({
      evaluationCase: buildCase({
        groundTruth: { files: ['src/b.ts'] },
        candidateArtifacts,
      }),
    });

    expect(first).toEqual(second);
  });
});
