import type { PrismaService } from '@ba-helper/backend-runtime';
import { QaTraceRepository } from './qa-trace.repository';
import { artifact, edge, evidence, testCase } from '../application/qa/qa-trace.test-fixtures';

describe('QaTraceRepository', () => {
  function setup() {
    const target = artifact('refund'), middle = artifact('cancel'), test = testCase();
    const call = { ...edge('call', middle, target), fromArtifact: middle, toArtifact: target };
    const tests = { ...edge('tests', test, middle, 'TESTS'), fromArtifact: test, toArtifact: middle };
    const snapshot = { id: 'snapshot', commitSha: 'commit', analyzerVersion: 'analyzer@0.5.0',
      coverageStatus: 'READY', diagnostics: [] };
    const tx = {
      impactAnalysis: { findUnique: jest.fn().mockResolvedValue({ id: 'analysis', snapshotId: snapshot.id, snapshot }) },
      codeArtifact: { findMany: jest.fn().mockResolvedValue([target]) },
      dependencyEdge: { findMany: jest.fn().mockResolvedValueOnce([call]).mockResolvedValueOnce([tests]) },
      evidence: { findMany: jest.fn().mockResolvedValue([evidence(test), evidence(middle)]) },
    };
    const prisma = { $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)) };
    return { repository: new QaTraceRepository(prisma as unknown as PrismaService), tx, prisma, target, middle, test, call };
  }

  it('uses a consistent read and scopes impacted artifacts, upstream edges and evidence to one snapshot', async () => {
    const { repository, tx, prisma } = setup();
    const result = await repository.read('analysis');
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    expect(tx.codeArtifact.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      snapshotId: 'snapshot', traceabilityLinks: { some: { impactAnalysisId: 'analysis' } },
    }, take: 1001 }));
    expect(tx.dependencyEdge.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: {
      snapshotId: 'snapshot', fromArtifact: { snapshotId: 'snapshot' }, toArtifact: { snapshotId: 'snapshot' },
      toArtifactId: { in: ['refund'] }, type: { in: ['TESTS', 'CALLS'] },
    } }));
    expect(tx.dependencyEdge.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where:
      expect.objectContaining({ toArtifactId: { in: ['cancel'] } }) }));
    expect(tx.evidence.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      snapshotId: 'snapshot', provenanceKey: { in: expect.arrayContaining([
        'snapshot:snapshot:artifact:service:cancel', 'snapshot:snapshot:artifact:test-case:src/test.spec.ts::identity',
      ]) },
    } }));
    expect(result?.impactedArtifactIds).toEqual(['refund']);
    expect(result?.artifacts.map(a => a.id).sort()).toEqual(['cancel', 'refund', 'test']);
    expect(result?.edges).toHaveLength(2);
  });

  it('does not query snapshot data when the analysis is absent', async () => {
    const { repository, tx } = setup();
    tx.impactAnalysis.findUnique.mockResolvedValue(null);
    expect(await repository.read('absent')).toBeNull();
    expect(tx.codeArtifact.findMany).not.toHaveBeenCalled();
    expect(tx.dependencyEdge.findMany).not.toHaveBeenCalled();
  });

  it('caps impacted rows and edge reads with an overflow signal', async () => {
    const { repository, tx, call } = setup();
    tx.codeArtifact.findMany.mockResolvedValue(Array.from({ length: 1001 }, (_, i) => artifact(`target-${i}`)));
    tx.dependencyEdge.findMany.mockReset().mockResolvedValue(Array.from({ length: 5001 }, (_, i) => ({ ...call, id: `edge-${i}` })));
    const result = await repository.read('analysis');
    expect(result?.impactedArtifactIds).toHaveLength(1000);
    expect(result?.edges).toHaveLength(5000);
    expect(result?.limitations).toEqual(expect.arrayContaining(['IMPACTED_ARTIFACT_LIMIT', 'EDGE_LIMIT']));
    expect(tx.dependencyEdge.findMany).toHaveBeenCalledTimes(1);
    expect(tx.dependencyEdge.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5001 }));
  });

  it('terminates cyclic frontiers', async () => {
    const { repository, tx, call } = setup();
    tx.dependencyEdge.findMany.mockReset().mockImplementation(async args => {
      const id = args.where.toArtifactId.in[0] as string;
      const from = artifact(id === 'refund' ? 'cancel' : 'refund');
      return [{ ...call, fromArtifactId: from.id, fromArtifact: from }];
    });
    await repository.read('analysis');
    expect(tx.dependencyEdge.findMany).toHaveBeenCalledTimes(2);
  });

  it('probes no farther than four calls and exposes a deeper caller frontier', async () => {
    const { repository, tx } = setup();
    let index = 0;
    tx.dependencyEdge.findMany.mockReset().mockImplementation(async args => {
      const target = artifact(args.where.toArtifactId.in[0]);
      const from = artifact(`upstream-${index++}`);
      return [{ ...edge(`call-${index}`, from, target), fromArtifact: from, toArtifact: target }];
    });
    const result = await repository.read('analysis');
    expect(tx.dependencyEdge.findMany).toHaveBeenCalledTimes(5);
    expect(result?.limitations).toContain('CALL_DEPTH_LIMIT');
  });
});
