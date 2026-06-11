import { ListRepositorySnapshotsUseCase } from './list-repository-snapshots.usecase';
import { PrismaService } from '../../prisma/prisma.service';

describe('ListRepositorySnapshotsUseCase', () => {
  let prisma: jest.Mocked<PrismaService>;
  let useCase: ListRepositorySnapshotsUseCase;

  beforeEach(() => {
    prisma = {
      repositorySnapshot: {
        findMany: jest.fn(),
      },
    } as any;
    useCase = new ListRepositorySnapshotsUseCase(prisma);
  });

  it('queries database with correct filters and bounding', async () => {
    (prisma.repositorySnapshot.findMany as jest.Mock).mockResolvedValueOnce([]);

    await useCase.execute({ projectId: 'proj-1', repositoryId: 'repo-1' });

    expect(prisma.repositorySnapshot.findMany).toHaveBeenCalledWith({
      where: {
        repositoryId: 'repo-1',
        repository: { projectId: 'proj-1' },
        coverageStatus: { in: ['READY', 'PARTIAL'] },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 20,
      include: {
        profile: true,
        _count: { select: { artifacts: true } },
      },
    });
  });

  it('caps limit at max 50', async () => {
    (prisma.repositorySnapshot.findMany as jest.Mock).mockResolvedValueOnce([]);

    await useCase.execute({ projectId: 'proj-1', repositoryId: 'repo-1', limit: 1000 });

    expect(prisma.repositorySnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });

  it('maps returned entities correctly', async () => {
    (prisma.repositorySnapshot.findMany as jest.Mock).mockResolvedValueOnce([
      {
        id: 'snap-1',
        commitSha: 'c1',
        createdAt: new Date('2026-06-11T00:00:00Z'),
        coverageStatus: 'READY',
        analyzerVersion: '0.1.0',
        profile: {
          profileVersion: '1.0.0',
        },
        _count: { artifacts: 42 },
      },
    ]);

    const result = await useCase.execute({ projectId: 'p1', repositoryId: 'r1' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: 'snap-1',
      commitSha: 'c1',
      createdAt: '2026-06-11T00:00:00.000Z',
      coverageStatus: 'READY',
      analyzerVersion: '0.1.0',
      profileVersion: '1.0.0',
      artifactCount: 42,
    });
  });
});
