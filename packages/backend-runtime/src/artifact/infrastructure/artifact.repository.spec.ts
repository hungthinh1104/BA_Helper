import { ArtifactRepository } from './artifact.repository';

describe('ArtifactRepository bounded discovery', () => {
  it('overfetches one row to report hasMore without loading the snapshot', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const findMany = jest.fn().mockResolvedValue(rows);
    const repository = new ArtifactRepository({ codeArtifact: { findMany } } as any);

    const result = await repository.searchBySnapshot('snapshot-1', {
      limit: 1, offset: 5, search: 'Booking', artifactTypes: ['SERVICE_METHOD'],
    });

    expect(result).toEqual({ items: [rows[0]], hasMore: true, limit: 1, offset: 5 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ snapshotId: 'snapshot-1', artifactType: { in: ['SERVICE_METHOD'] } }),
      skip: 5, take: 2,
      orderBy: [{ artifactType: 'asc' }, { artifactKey: 'asc' }, { id: 'asc' }],
    }));
  });
});
