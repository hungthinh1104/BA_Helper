import { ArtifactController } from './artifact.controller';

const snapshotId = '00000000-0000-4000-8000-000000000001';
const artifactId = '00000000-0000-4000-8000-000000000002';

describe('ArtifactController comprehension projection', () => {
  it('enforces snapshot read permission before returning the bounded projection', async () => {
    const actor = { id: '00000000-0000-4000-8000-000000000003', email: 'reviewer@example.com', role: 'REVIEWER' } as const;
    const permissions = { assertCanReadSnapshot: jest.fn().mockResolvedValue(undefined) } as any;
    const projection = {
      selectedCode: { id: artifactId, artifactKey: 'service:run', name: 'Service.run', artifactType: 'SERVICE_METHOD',
        universalKind: 'DOMAIN_SERVICE', filePath: 'src/service.ts', startLine: 1, endLine: 3 },
      codeEvidence: { source: { id: null, evidenceKind: 'PRODUCTION_SOURCE', sourceType: 'CODE', artifactId,
        provenanceKey: null, filePath: 'src/service.ts', startLine: 1, endLine: 3, excerpt: 'return true;', commitSha: 'commit-1' },
        parameters: [], returnType: null, conditions: [], exceptionHandlers: [], dependencies: [], staticCalls: [] }, relatedScenarios: [], limitations: [],
      snapshotContext: { repositoryId: '00000000-0000-4000-8000-000000000004', snapshotId, commitSha: 'commit-1',
        analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', basis: 'STATIC_SOURCE_REFERENCE', runtimeObservations: 'NOT_IMPORTED' },
      limits: { maxCallDepth: 4, maxScenarios: 50, maxRelationships: 80 }, truncated: false,
    };
    const comprehension = { execute: jest.fn().mockResolvedValue(projection) } as any;
    const controller = new ArtifactController({} as any, comprehension, permissions);

    const result = await controller.comprehensionProjection(snapshotId, artifactId, undefined, undefined, actor);

    expect(permissions.assertCanReadSnapshot).toHaveBeenCalledWith(actor, snapshotId);
    expect(comprehension.execute).toHaveBeenCalledWith(snapshotId, artifactId,
      { scenarioLimit: undefined, scenarioOffset: undefined });
    expect(result.selectedCode.id).toBe(artifactId);
  });

  it('does not invoke the use case when snapshot permission fails', async () => {
    const permissions = { assertCanReadSnapshot: jest.fn().mockRejectedValue(new Error('forbidden')) } as any;
    const comprehension = { execute: jest.fn() } as any;
    const controller = new ArtifactController({} as any, comprehension, permissions);

    await expect(controller.comprehensionProjection(snapshotId, artifactId, undefined, undefined, {} as any)).rejects.toThrow('forbidden');
    expect(comprehension.execute).not.toHaveBeenCalled();
  });

  it('passes bounded scenario pagination through the read-only projection', async () => {
    const permissions = { assertCanReadSnapshot: jest.fn().mockResolvedValue(undefined) } as any;
    const comprehension = { execute: jest.fn().mockResolvedValue({}) } as any;
    const controller = new ArtifactController({} as any, comprehension, permissions);

    await expect(controller.comprehensionProjection(snapshotId, artifactId, '7', '4', {} as any)).rejects.toThrow();

    expect(comprehension.execute).toHaveBeenCalledWith(snapshotId, artifactId, { scenarioLimit: 7, scenarioOffset: 4 });
  });
});
