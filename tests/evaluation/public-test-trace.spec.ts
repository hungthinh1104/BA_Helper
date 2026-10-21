import { auditSourceEvidence, evaluatePublicTestTraces, scoreReferenceSet } from './public-test-trace.evaluator';
import type { GraphEdge, ScanArtifact } from '@ba-helper/analyzer';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

describe('independent public NestJS static trace corpus', () => {
  it('does not turn missing denominators into perfect precision or recall', () => {
    expect(scoreReferenceSet([], []).precision).toBeNull();
    expect(scoreReferenceSet([], []).recall).toBeNull();
    expect(scoreReferenceSet([], []).f1).toBeNull();
    expect(scoreReferenceSet(['a'], []).recall).toBe(0);
    expect(scoreReferenceSet(['a'], []).f1).toBe(0);
  });

  it('counts false positives, misses and duplicate observations explicitly', () => {
    expect(scoreReferenceSet(['a', 'b'], ['a', 'a', 'c'])).toEqual({
      expected: 2, predicted: 2, truePositive: 1, falsePositive: 1, falseNegative: 1,
      precision: 0.5, recall: 0.5, f1: 0.5, missing: ['b'], unexpected: ['c'],
    });
  });

  it('rejects trace evidence outside the source artifact and its direct call site', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ba-trace-evidence-'));
    try {
      const sourcePath = 'src/payment.service.ts';
      const source = [
        'export class PaymentService {',
        '  refund() {}',
        '}',
        'export class BookingService {',
        '  cancel() { this.payment.refund(); }',
        '}',
      ].join('\n');
      mkdirSync(path.dirname(path.join(root, sourcePath)), { recursive: true });
      writeFileSync(path.join(root, sourcePath), source);
      const from: ScanArtifact = { stableId: 'from', type: 'SERVICE_METHOD', filePath: sourcePath,
        symbolName: 'BookingService.cancel', startLine: 5, endLine: 5, excerpt: 'cancel() { this.payment.refund(); }' };
      const to: ScanArtifact = { stableId: 'to', type: 'SERVICE_METHOD', filePath: sourcePath,
        symbolName: 'PaymentService.refund', startLine: 2, endLine: 2, excerpt: 'refund() {}' };
      const edge: GraphEdge = { stableId: 'edge', type: 'CALLS', from: 'from', to: 'to', confidence: 1,
        provenance: { resolver: 'TS_AST_DIRECT_CALL', locations: [{ sourcePath, startLine: 5, endLine: 5 }] } };
      const repository = { files: [{ path: sourcePath, blobSha: '0'.repeat(40) }] } as Parameters<typeof auditSourceEvidence>[1];
      const artifactMap = new Map([['from', from], ['to', to]]);

      expect(auditSourceEvidence(root, repository, [edge], artifactMap)).toMatchObject({
        checkedRelationships: 1, supportedRelationships: 1, issues: [],
      });
      edge.provenance!.locations[0].startLine = 2;
      edge.provenance!.locations[0].endLine = 2;
      expect(auditSourceEvidence(root, repository, [edge], artifactMap)).toMatchObject({
        checkedRelationships: 1, supportedRelationships: 0,
        issues: [expect.objectContaining({ reason: 'LOCATION_OUTSIDE_ARTIFACT_RANGE' })],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('matches source-authored ground truth and upstream blob pins across all selected cases', () => {
    const result = evaluatePublicTestTraces();
    expect(result.repositories).toHaveLength(3);
    expect(result.totals.cases.expected).toBe(22);
    expect(result.totals.calls.expected).toBe(10);
    expect(result.totals.tests.expected).toBe(24);
    expect(result.status).toBe('PASS');
    expect(result.totals.tests.precision).toBe(1);
    expect(result.totals.tests.recall).toBe(1);
    expect(result.totals.tests.f1).toBe(1);
    expect(result.evidence.integrityRate).toBe(1);
    expect(result.evidence.issues).toEqual([]);
    expect(result.identityAmbiguities).toEqual([]);
    expect(result.independentHumanReview).toBe(false);
  });
});
