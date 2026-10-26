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

  it('searches artifact names, canonical keys, and repository-relative paths on the server', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const repository = new ArtifactRepository({ codeArtifact: { findMany } } as any);
    const searchTerms = ['Method89', 'service:src/method-89.ts:Method89', 'src/method-89.ts'];

    for (const search of searchTerms) {
      await repository.searchBySnapshot('snapshot-1', { limit: 50, offset: 0, search });
      expect(findMany).toHaveBeenLastCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          snapshotId: 'snapshot-1',
          OR: [
            { artifactKey: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
            { filePath: { contains: search, mode: 'insensitive' } },
          ],
        }),
      }));
    }
  });

  it('distinguishes the last retrievable page from exhausted search results', async () => {
    const rows = Array.from({ length: 51 }, (_, index) => ({ id: String(index) }));
    const findMany = jest.fn().mockResolvedValue(rows);
    const repository = new ArtifactRepository({ codeArtifact: { findMany } } as any);

    const result = await repository.searchBySnapshot('snapshot-1', { limit: 50, offset: 500 });

    expect(result.items).toHaveLength(50);
    expect(result).toMatchObject({ hasMore: false, limitReached: true, limit: 50, offset: 500 });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 500, take: 51 }));
  });
});
