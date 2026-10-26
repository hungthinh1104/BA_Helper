import { auditSourceEvidence, evaluatePublicTestTraces, evaluateTraceRepository, scoreReferenceSet } from './public-test-trace.evaluator';
import { createHash } from 'node:crypto';
import type { GraphEdge, ScanArtifact, ScanResult } from '@ba-helper/analyzer';
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

  it('scores a test target by canonical file path and qualified symbol when names collide', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'ba-trace-qualified-target-'));
    try {
      const sources = new Map([
        ['src/first/thing.service.ts', 'export class ThingService { act(): void {} }\n'],
        ['src/second/thing.service.ts', 'export class ThingService { act(): void {} }\n'],
        ['src/first/thing.service.spec.ts', [
          "import { ThingService } from './thing.service';",
          "describe('ThingService', () => {",
          '  let service: ThingService;',
          '  beforeEach(() => { service = new ThingService(); });',
          "  it('acts on the first service', () => { service.act(); });",
          '});',
          '',
        ].join('\n')],
      ]);
      for (const [relativePath, source] of sources) {
        mkdirSync(path.dirname(path.join(root, relativePath)), { recursive: true });
        writeFileSync(path.join(root, relativePath), source);
      }
      const repository = {
        id: 'duplicate-symbols', repository: 'local/duplicate-symbols', commitSha: 'a'.repeat(40),
        files: [...sources].map(([filePath, source]) => ({
          path: filePath,
          blobSha: createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source).digest('hex'),
        })),
        cases: [{ filePath: 'src/first/thing.service.spec.ts', suitePath: ['ThingService'],
          title: 'acts on the first service', targetSymbols: ['ThingService.act'],
          targetArtifacts: [{ filePath: 'src/first/thing.service.ts', symbolName: 'ThingService.act' }] }],
        calls: [],
      };

      const testPath = 'src/first/thing.service.spec.ts';
      const testArtifact: ScanArtifact = { stableId: 'test', type: 'JEST_TEST_CASE', filePath: testPath,
        symbolName: 'ThingService > acts on the first service', startLine: 5, endLine: 5,
        excerpt: 'service.act();', testCase: { framework: 'jest', suitePath: ['ThingService'],
          title: 'acts on the first service', modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: testPath } };
      const firstTarget: ScanArtifact = { stableId: 'first', type: 'SERVICE_METHOD',
        filePath: 'src/first/thing.service.ts', symbolName: 'ThingService.act', startLine: 1,
        endLine: 1, excerpt: 'act(): void {}' };
      const duplicateTarget: ScanArtifact = { ...firstTarget, stableId: 'second',
        filePath: 'src/second/thing.service.ts' };
      const outsideTest: ScanArtifact = { ...testArtifact, stableId: 'outside-test',
        filePath: 'src/other/thing.service.spec.ts', testCase: { ...testArtifact.testCase!, title: 'outside scope' } };
      const scan = { analyzerVersion: 'test', artifacts: [testArtifact, outsideTest, firstTarget, duplicateTarget],
        coverage: {} } as unknown as ScanResult;
      const edge = (target: ScanArtifact): GraphEdge => ({ stableId: `test-${target.stableId}`, type: 'TESTS',
        from: 'test', to: target.stableId, confidence: 1,
        provenance: { resolver: 'TS_AST_DIRECT_CALL', locations: [{ sourcePath: testPath, startLine: 5, endLine: 5 }] } });
      const outsideEdge: GraphEdge = { ...edge(duplicateTarget), stableId: 'outside-edge', from: 'outside-test',
        provenance: { resolver: 'TS_AST_DIRECT_CALL', locations: [{ sourcePath: outsideTest.filePath, startLine: 5, endLine: 5 }] } };
      const result = evaluateTraceRepository(root, repository, { scan, graph: { edges: [edge(firstTarget), outsideEdge] } });

      expect(result.tests).toMatchObject({ expected: 1, truePositive: 1, falsePositive: 0, falseNegative: 0 });
      expect(result.identityAmbiguities).toEqual([]);
      expect(result.evidence.issues).toEqual([]);

      const wrongTarget = evaluateTraceRepository(root, repository,
        { scan, graph: { edges: [edge(duplicateTarget)] } });
      expect(wrongTarget.tests).toMatchObject({ truePositive: 0, falsePositive: 1, falseNegative: 1 });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
