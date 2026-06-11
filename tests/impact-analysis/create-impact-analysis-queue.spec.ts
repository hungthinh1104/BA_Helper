import { CreateImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/create-impact-analysis.usecase';

class StubImpactRepo {
  findByRequestKey = async () => null;
  findByComposite = async () => null;
  createQueued = async () => ({
    id: 'analysis-1',
    requirementRevisionId: 'rev-1',
    snapshotId: 'snap-1',
  });
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
      coverageStatus: 'READY',
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
  queued: string[] = [];

  enqueueImpactAnalysis = async (analysisId: string) => {
    this.queued.push(analysisId);
  };
}

describe('CreateImpactAnalysisUseCase', () => {
  it('enqueues impact analysis job after creation', async () => {
    const queue = new StubQueue();
    const useCase = new CreateImpactAnalysisUseCase(
      new StubImpactRepo() as any,
      new StubRequirementRepo() as any,
      new StubPrisma() as any,
      new StubEventLog() as any,
      queue as any,
    );

    await useCase.execute({
      requirementRevisionId: 'rev-1',
      snapshotId: 'snap-1',
      sourceTargetId: 'target-1',
      requestKey: 'req-1',
      allowPartialSnapshot: false,
    });

    expect(queue.queued).toEqual(['analysis-1']);
  });
});
