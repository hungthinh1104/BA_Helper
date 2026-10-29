import { GraphRepository } from './graph.repository';

describe('GraphRepository bounded reads', () => {
  it('uses deterministic ordering and a caller supplied take for reverse traversal', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new GraphRepository({ dependencyEdge: { findMany } } as any);

    await repository.listIncomingBySnapshotAndTargets('snapshot-1', ['target-2', 'target-1'], ['CALLS'], 81);

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        snapshotId: 'snapshot-1', fromArtifact: { snapshotId: 'snapshot-1' }, toArtifact: { snapshotId: 'snapshot-1' },
        toArtifactId: { in: ['target-2', 'target-1'] }, type: { in: ['CALLS'] },
      },
      orderBy: [{ toArtifactId: 'asc' }, { fromArtifactId: 'asc' }, { id: 'asc' }], take: 81,
    }));
  });

  it('pages distinct Jest source identities in stable order before loading their edges', async () => {
    const groupBy = jest.fn().mockResolvedValue([{ fromArtifactId: 'test-2' }, { fromArtifactId: 'test-3' }]);
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new GraphRepository({ dependencyEdge: { groupBy, findMany } } as any);

    expect(await repository.listIncomingTestSourceIds('snapshot-1', ['target-2', 'target-1'], 'test-1', 2))
      .toEqual(['test-2', 'test-3']);
    expect(groupBy).toHaveBeenCalledWith({
      by: ['fromArtifactId'],
      where: { snapshotId: 'snapshot-1', fromArtifact: { snapshotId: 'snapshot-1' }, toArtifact: { snapshotId: 'snapshot-1' },
        type: 'TESTS', toArtifactId: { in: ['target-2', 'target-1'] },
        fromArtifactId: { gt: 'test-1' } },
      orderBy: { fromArtifactId: 'asc' }, take: 2,
    });

    await repository.listTestEdgesBySourcesAndTargets('snapshot-1', ['test-2', 'test-3'], ['target-1', 'target-2']);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { snapshotId: 'snapshot-1', fromArtifact: { snapshotId: 'snapshot-1' }, toArtifact: { snapshotId: 'snapshot-1' },
        type: 'TESTS', fromArtifactId: { in: ['test-2', 'test-3'] },
        toArtifactId: { in: ['target-1', 'target-2'] } },
      orderBy: [{ fromArtifactId: 'asc' }, { toArtifactId: 'asc' }, { id: 'asc' }], take: 4,
    }));
  });
});
