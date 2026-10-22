import type { PrismaService } from '@ba-helper/backend-runtime';
import { RequirementRepository } from './requirement.repository';

describe('RequirementRepository.findByProject', () => {
  it('loads only the newest revision and counts historical revisions in the database', async () => {
    const findMany = jest.fn(async () => []);
    const prisma = {
      requirement: { findMany },
    } as unknown as PrismaService;
    const repository = new RequirementRepository(prisma);

    await repository.findByProject('project-id');

    expect(findMany).toHaveBeenCalledWith({
      where: { projectId: 'project-id' },
      select: {
        id: true,
        _count: { select: { revisions: true } },
        revisions: {
          select: {
            id: true,
            title: true,
            rawText: true,
            readinessStatus: true,
            validationIssues: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  });
});
