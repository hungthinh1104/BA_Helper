import { CreateImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/create-impact-analysis.usecase';

class StubImpactRepo {
  created: Array<{ coverageWarning?: string | null; acceptedPartialCoverage: boolean }> = [];

  findByRequestKey = async () => null;
  findByComposite = async () => null;
  createQueued = async (params: { acceptedPartialCoverage: boolean; coverageWarning?: string | null }) => {
    this.created.push(params);
    return {
      id: 'analysis-1',
      requirementRevisionId: 'rev-1',
      snapshotId: 'snap-1',
      sourceTargetId: 'target-1',
    };
  };
}

class StubRequirementRepo {
  findRevisionById = async () => ({
    id: 'rev-1',
    requirementId: 'req-1',
    readinessStatus: 'READY_FOR_ANALYSIS',
  });
}

class StubPrisma {
  requirement = {
    findUnique: async () => ({
      id: 'req-1',
      projectId: 'project-1',
    }),
  };
  requirementRevision = {
    findUnique: async () => ({
      id: 'rev-1',
      requirementId: 'req-1',
      readinessStatus: 'READY_FOR_ANALYSIS',
      requirement: {
        projectId: 'project-1',
      },
    }),
  };
  repositorySnapshot = {
    findUnique: async () => ({
      id: 'snap-1',
      repositoryId: 'repo-1',
      commitSha: 'abc',
      coverageStatus: 'PARTIAL',
      repository: {
        projectId: 'project-1',
      },
    }),
  };
  repositoryTarget = {
    findUnique: async () => ({
      id: 'target-1',
      repositoryId: 'repo-1',
      resolvedRefType: 'COMMIT',
      latestObservedCommitSha: 'abc',
    }),
  };
}

class StubEventLog {
  recordEvent = async () => undefined;
}

class StubQueue {
  enqueueImpactAnalysis = async () => undefined;
}

describe('CreateImpactAnalysisUseCase partial snapshot', () => {
  it('adds coverage warning when partial snapshot is accepted', async () => {
    const impactRepo = new StubImpactRepo();
    const useCase = new CreateImpactAnalysisUseCase(
      impactRepo as any,
      new StubRequirementRepo() as any,
      new StubPrisma() as any,
      new StubEventLog() as any,
      new StubQueue() as any,
    );

    await useCase.execute({
      requirementRevisionId: 'rev-1',
      snapshotId: 'snap-1',
      sourceTargetId: 'target-1',
      requestKey: 'req-1',
      allowPartialSnapshot: true,
    });

    expect(impactRepo.created[0]?.acceptedPartialCoverage).toBe(true);
    expect(impactRepo.created[0]?.coverageWarning).toBe(
      'Partial snapshot accepted; coverage may be incomplete.',
    );
  });
});
