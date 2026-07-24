import { CreateMultiRepoImpactAnalysesUseCase } from './create-multi-repo-impact-analyses.usecase';
import { DomainPackRegistry } from '@ba-helper/backend-runtime';

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
    expect(runs.create).toHaveBeenCalledWith(expect.objectContaining({
      selectedDomainPack: {
        requestedDomainPackId: 'healthcare',
        resolvedDomainPackId: 'healthcare',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'PARTIAL',
        selectedBy: 'EXPLICIT',
        resolvedAt: expect.any(String),
      },
    }));
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

  it('copies run-level explicit ecommerce selection as canonical metadata to all child analyses', async () => {
    const context = createUseCaseContext();

    await context.useCase.execute({
      actorId: 'user-1',
      projectId: 'project-1',
      requirementRevisionId: 'rev-1',
      repositoryIds: ['repo-a', 'repo-b'],
      requestKey: '00000000-0000-4000-8000-000000000002',
      allowPartialSnapshot: false,
      domainPackId: 'ECOMMERCE',
    });

    expect(context.runs.create).toHaveBeenCalledWith(expect.objectContaining({
      selectedDomainPack: expect.objectContaining({
        requestedDomainPackId: 'ecommerce',
        resolvedDomainPackId: 'ecommerce',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'PARTIAL',
        selectedBy: 'EXPLICIT',
      }),
    }));
    for (const call of context.createImpactAnalysis.execute.mock.calls) {
      expect(call[0]).toMatchObject({
        domainPackId: 'ECOMMERCE',
        selectedDomainPack: {
          requestedDomainPackId: 'ecommerce',
          resolvedDomainPackId: 'ecommerce',
          resolvedDomainPackVersion: '0.1.0',
          resolvedDomainPackStatus: 'PARTIAL',
          selectedBy: 'EXPLICIT',
          resolvedAt: expect.any(String),
        },
      });
    }
  });

  it('accepts retry with equivalent explicit domain alias and casing', async () => {
    const context = createUseCaseContext({
      existingRun: {
        id: 'run-1',
        requirementRevisionId: 'rev-1',
        requestedDomainPackId: 'ECOMMERCE@0.1.0',
        resolvedDomainPackId: 'ECOMMERCE@0.1.0',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'partial',
        domainPackSelectedBy: 'manual_config',
        domainPackResolvedAt: new Date('2026-06-27T00:00:00.000Z'),
        analyses: [
          { snapshot: { repositoryId: 'repo-a' }, metadata: null },
          { snapshot: { repositoryId: 'repo-b' }, metadata: null },
        ],
      },
    });

    await expect(context.useCase.execute({
      actorId: 'user-1',
      projectId: 'project-1',
      requirementRevisionId: 'rev-1',
      repositoryIds: ['repo-a', 'repo-b'],
      requestKey: '00000000-0000-4000-8000-000000000003',
      allowPartialSnapshot: false,
      domainPackId: 'ecommerce',
    })).resolves.toMatchObject({ runId: 'run-1' });

    expect(context.runs.create).not.toHaveBeenCalled();
    expect(context.createImpactAnalysis.execute).toHaveBeenCalledTimes(2);
  });

  it('rejects retry with a different explicit domain pack', async () => {
    const context = createUseCaseContext({
      existingRun: {
        id: 'run-1',
        requirementRevisionId: 'rev-1',
        requestedDomainPackId: 'healthcare',
        resolvedDomainPackId: 'healthcare',
        resolvedDomainPackVersion: '0.1.0',
        resolvedDomainPackStatus: 'PARTIAL',
        domainPackSelectedBy: 'EXPLICIT',
        domainPackResolvedAt: new Date('2026-06-27T00:00:00.000Z'),
        analyses: [
          { snapshot: { repositoryId: 'repo-a' }, metadata: null },
          { snapshot: { repositoryId: 'repo-b' }, metadata: null },
        ],
      },
    });

    await expect(context.useCase.execute({
      actorId: 'user-1',
      projectId: 'project-1',
      requirementRevisionId: 'rev-1',
      repositoryIds: ['repo-a', 'repo-b'],
      requestKey: '00000000-0000-4000-8000-000000000004',
      allowPartialSnapshot: false,
      domainPackId: 'ecommerce',
    })).rejects.toMatchObject({ code: 'REQUEST_KEY_MISMATCH' });

    expect(context.createImpactAnalysis.execute).not.toHaveBeenCalled();
  });
});

function createUseCaseContext(params: { existingRun?: any } = {}) {
  const createImpactAnalysis = {
    execute: jest.fn(async (input) => ({
      id: `analysis-${input.snapshotId}`,
      multiRepoRunId: 'run-1',
      status: 'QUEUED',
    })),
  };
  const impactAnalyses = {
    attachToMultiRepoRun: jest.fn(),
  };
  const runs = {
    findByProjectRequestKey: jest.fn().mockResolvedValue(params.existingRun ?? null),
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

  return {
    createImpactAnalysis,
    impactAnalyses,
    runs,
    requirements,
    prisma,
    useCase: new CreateMultiRepoImpactAnalysesUseCase(
      createImpactAnalysis as any,
      impactAnalyses as any,
      runs as any,
      prisma as any,
      requirements as any,
      new DomainPackRegistry(),
    ),
  };
}
