import { CreateMultiRepoImpactAnalysesUseCase } from './create-multi-repo-impact-analyses.usecase';
import { DomainPackRegistry } from '../../../domain-pack/application/domain-pack.registry';

describe('CreateMultiRepoImpactAnalysesUseCase domain pack selection', () => {
  it('copies run-level explicit healthcare selection to all child analyses', async () => {
    const createImpactAnalysis = {
      execute: jest.fn(async (params) => ({
        id: `analysis-${params.snapshotId}`,
        multiRepoRunId: 'run-1',
        status: 'QUEUED',
      })),
    };
    const impactAnalyses = {
      attachToMultiRepoRun: jest.fn(),
    };
    const runs = {
      findByProjectRequestKey: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'run-1' }),
    };
    const requirements = {
      findRevisionById: jest.fn().mockResolvedValue({
        id: 'rev-1',
        requirementId: 'req-1',
        readinessStatus: 'READY_FOR_ANALYSIS',
      }),
    };
    const prisma = {
      requirement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'req-1',
          projectId: 'project-1',
        }),
      },
      repository: {
        findUnique: jest.fn(async ({ where }: { where: { id: string } }) => ({
          id: where.id,
          projectId: 'project-1',
          canonicalUrl: `https://github.com/example/${where.id}`,
          targets: [
            {
              id: `target-${where.id}`,
              latestObservedCommitSha: `commit-${where.id}`,
            },
          ],
        })),
      },
      repositorySnapshot: {
        findFirst: jest.fn(async ({ where }: { where: { repositoryId: string } }) => ({
          id: `snapshot-${where.repositoryId}`,
          repositoryId: where.repositoryId,
        })),
      },
    };

    const useCase = new CreateMultiRepoImpactAnalysesUseCase(
      createImpactAnalysis as any,
      impactAnalyses as any,
      runs as any,
      prisma as any,
      requirements as any,
      new DomainPackRegistry(),
    );

    await useCase.execute({
      actorId: 'user-1',
      projectId: 'project-1',
      requirementRevisionId: 'rev-1',
      repositoryIds: ['repo-a', 'repo-b'],
      requestKey: '00000000-0000-4000-8000-000000000001',
      allowPartialSnapshot: false,
      domainPackId: 'healthcare',
    });

    expect(createImpactAnalysis.execute).toHaveBeenCalledTimes(2);
    for (const call of createImpactAnalysis.execute.mock.calls) {
      expect(call[0]).toMatchObject({
        domainPackId: 'healthcare',
        selectedDomainPack: {
          requestedDomainPackId: 'healthcare',
          resolvedDomainPackId: 'healthcare',
          resolvedDomainPackVersion: '0.1.0',
          resolvedDomainPackStatus: 'PARTIAL',
          selectedBy: 'EXPLICIT',
          resolvedAt: expect.any(String),
        },
      });
    }
  });
});
