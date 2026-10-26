import { GetCodeComprehensionUseCase } from './get-code-comprehension.usecase';
import { findCallPath } from './get-code-comprehension.mapper';
import { validateStaticEntityUse } from './validate-static-entity-use';
import { artifact, artifactFile, artifactKey, callerId, dependencyId, edge, entityId, evidence, repositoryId,
  selectedId, snapshotId, testId } from './get-code-comprehension.test-fixtures';

describe('GetCodeComprehensionUseCase', () => {
  it('accepts entity dependencies only with a matching source artifact and evidence', () => {
    const valid = edge('00000000-0000-4000-8000-000000000050', selectedId, entityId, 'REFERENCES');
    const artifacts = new Map([[selectedId, artifact(selectedId, 'SERVICE_METHOD', 'Service.run')],
      [entityId, artifact(entityId, 'ENTITY', 'Booking')],
      [dependencyId, artifact(dependencyId, 'SERVICE_METHOD', 'Dependency.run')]]);
    const source = evidence('00000000-0000-4000-8000-000000000051', selectedId, 'CODE');
    const evidences = new Map([[source.provenanceKey, source]]);

    expect(validateStaticEntityUse(valid as any, snapshotId, artifacts as any, evidences as any)).toBe(true);
    expect(validateStaticEntityUse({ ...valid, toArtifactId: dependencyId } as any,
      snapshotId, artifacts as any, evidences as any)).toBe(false);
    expect(validateStaticEntityUse(valid as any, snapshotId, artifacts as any, new Map())).toBe(false);
    const route = artifact(selectedId, 'API_ROUTE', 'Controller.register');
    const routeKey = `snapshot:${snapshotId}:artifact:${route.artifactKey}`;
    const routeEdge = { ...valid, metadata: { ...valid.metadata, evidenceProvenanceKey: routeKey,
      locations: [{ sourcePath: route.filePath, startLine: 5, endLine: 5 }] } };
    const routeEvidence = { ...source, provenanceKey: routeKey, sourcePath: route.filePath };
    expect(validateStaticEntityUse(routeEdge as any, snapshotId,
      new Map([...artifacts, [selectedId, route]]) as any, new Map([[routeKey, routeEvidence]]) as any)).toBe(true);
  });

  it('does not revisit cyclic callers while resolving a bounded path', () => {
    const cycle = edge('00000000-0000-4000-8000-000000000030', callerId, selectedId, 'CALLS');
    const back = edge('00000000-0000-4000-8000-000000000031', selectedId, callerId, 'CALLS');
    const outgoing = new Map([
      [callerId, [cycle]],
      [selectedId, [back]],
    ]);

    expect(findCallPath(callerId, selectedId, outgoing, 4)).toEqual([cycle]);
    expect(findCallPath(callerId, '00000000-0000-4000-8000-000000000099', outgoing, 4)).toBeUndefined();
  });

  it('deduplicates multiple TESTS edges from one test and keeps the shortest proven path', () => {
    const useCase = new GetCodeComprehensionUseCase({} as any, {} as any, {} as any, {} as any);
    const testToCaller = edge('00000000-0000-4000-8000-000000000040', testId, callerId, 'TESTS');
    const testToSelected = edge('00000000-0000-4000-8000-000000000041', testId, selectedId, 'TESTS');
    const callerToSelected = edge('00000000-0000-4000-8000-000000000042', callerId, selectedId, 'CALLS');
    const selected = (useCase as any).selectScenarioEdges(
      [testToCaller, testToSelected], [callerToSelected], selectedId);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(testToSelected.id);
  });

  it('returns bounded code-first evidence and a static test-to-code path', async () => {
    const claim = { kind: 'ACTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'service.run()',
      sourceLocation: { relativePath: 'test.ts', startOffset: 1, endOffset: 15, startLine: 5, startColumn: 1,
        endLine: 5, endColumn: 15 }, commitSha: 'commit-1',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey(testId)}` } as const;
    const mismatchedClaim = { ...claim, sourceText: 'service.unverified()', commitSha: 'different-commit',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey(testId)}:foreign` } as const;
    const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run', { codeEvidence: {
      parameters: [{ name: 'input', typeText: 'CreateInput', sourceText: 'input: CreateInput', sourceLocation: {
        relativePath: 'Service.run.ts', startOffset: 20, endOffset: 36, startLine: 2, startColumn: 15, endLine: 2, endColumn: 31,
      } }],
      returnType: { text: 'Promise<Result>', sourceLocation: {
        relativePath: 'Service.run.ts', startOffset: 37, endOffset: 51, startLine: 2, startColumn: 32, endLine: 2, endColumn: 46,
      } },
      conditions: [{ kind: 'IF', sourceText: 'input.enabled', sourceLocation: {
        relativePath: 'Service.run.ts', startOffset: 70, endOffset: 83, startLine: 4, startColumn: 5, endLine: 4, endColumn: 18,
      } }],
      exceptionHandlers: [],
    } });
    const caller = artifact(callerId, 'SERVICE_METHOD', 'Controller.handle');
    const test = artifact(testId, 'JEST_TEST_CASE', 'runs', { testCase: {
      framework: 'jest', suitePath: ['Service'], title: 'runs', modifier: 'NORMAL', declaredModifier: 'NORMAL',
      parentFileArtifactKey: 'test:runs.ts#file', behaviorEvidence: [claim, mismatchedClaim],
    } });
    const dependency = artifact(dependencyId, 'SERVICE_METHOD', 'Dependency.run');
    const entity = artifact(entityId, 'ENTITY', 'Booking');
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockResolvedValue([selected, caller, test, dependency, entity]),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue([
      edge('00000000-0000-4000-8000-000000000020', selectedId, dependencyId, 'CALLS'),
      edge('00000000-0000-4000-8000-000000000023', selectedId, entityId, 'REFERENCES')]),
      listIncomingBySnapshotAndTargets: jest.fn().mockImplementation((_snapshot: string, targets: string[], types: string[]) =>
        types[0] === 'CALLS'
          ? targets.includes(selectedId) ? [edge('00000000-0000-4000-8000-000000000021', callerId, selectedId, 'CALLS')] : []
          : []),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue([testId]),
      listTestEdgesBySourcesAndTargets: jest.fn().mockResolvedValue([
        edge('00000000-0000-4000-8000-000000000022', testId, callerId, 'TESTS')]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([
      evidence('00000000-0000-4000-8000-000000000010', selectedId, 'CODE'),
      evidence('00000000-0000-4000-8000-000000000011', callerId, 'CODE'),
      evidence('00000000-0000-4000-8000-000000000012', testId, 'TEST'),
    ]) } as any;

    const useCase = new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository);
    const result = await useCase.execute(snapshotId, selectedId);

    expect(result.selectedCode.name).toBe('Service.run');
    expect(result.codeEvidence.staticCalls).toHaveLength(1);
    expect(result.codeEvidence.dependencies.map(item => item.name)).toContain('Booking');
    expect(result.codeEvidence.parameters[0].excerpt).toBe('input: CreateInput');
    expect(result.codeEvidence.returnType?.excerpt).toBe('Promise<Result>');
    expect(result.codeEvidence.conditions[0].excerpt).toBe('input.enabled');
    expect(result.relatedScenarios).toHaveLength(1);
    expect(result.relatedScenarios[0]).toMatchObject({
      testCase: { title: 'runs' }, invocations: [claim], trace: { relation: 'CALL_PATH' },
    });
    expect(result.relatedScenarios[0].testCase?.behaviorEvidence).toEqual([claim]);
    expect(result.relatedScenarios[0].unresolved.map(item => item.code)).toEqual(expect.arrayContaining([
      'TEST_CLAIM_COMMIT_MISMATCH', 'TEST_CLAIM_EVIDENCE_MISSING',
    ]));
    expect(result.scenarioPagination).toEqual({ limit: 50, offset: 0, hasMore: false });
    expect(result.relatedScenarios[0].trace?.artifacts.map(item => item.name)).toEqual([
      'runs', 'Controller.handle', 'Service.run',
    ]);
    expect(artifacts.listBySnapshotAndArtifactKeys).toHaveBeenCalledWith(snapshotId, ['test:runs.ts#file']);
    expect(result.relatedScenarios[0].trace?.relationships.map(item => item.type)).toEqual(['TESTS', 'CALLS']);
    expect(result.snapshotContext).toMatchObject({ repositoryId, snapshotId, commitSha: 'commit-1', runtimeObservations: 'NOT_IMPORTED' });
    expect(result.limitations.map(item => item.code)).toContain('RUNTIME_OBSERVATIONS_NOT_IMPORTED');
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(1_000_000);
    expect(graph.listOutgoingBySnapshotAndSources).toHaveBeenCalledTimes(1);
    expect(graph.listIncomingBySnapshotAndTargets).toHaveBeenCalledTimes(2);
    expect(graph.listIncomingTestSourceIds).toHaveBeenCalledTimes(1);
    expect(artifacts.listBySnapshotAndIds).toHaveBeenCalledTimes(2);
    expect(artifacts.listBySnapshotAndArtifactKeys).toHaveBeenCalledTimes(1);
    expect(evidenceRepository.listByArtifactIds).toHaveBeenCalledTimes(2);

    const second = await useCase.execute(snapshotId, selectedId);
    expect(second).toEqual(result);
    expect(graph.listOutgoingBySnapshotAndSources).toHaveBeenCalledTimes(1);
  });

  it('does not cross snapshot boundaries and does not invent missing source evidence', async () => {
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'PARTIAL', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(null) } as any;
    const useCase = new GetCodeComprehensionUseCase(prisma, artifacts, {} as any, {} as any);
    await expect(useCase.execute(snapshotId, selectedId)).rejects.toMatchObject({ code: 'ARTIFACT_NOT_FOUND' });
    expect(artifacts.findBySnapshotAndId).toHaveBeenCalledWith(snapshotId, selectedId);
  });

  it('bounds direct static calls at the contract limit and reports truncation', async () => {
    const calls = Array.from({ length: 51 }, (_, index) => {
      const suffix = String(100 + index).padStart(12, '0');
      return edge(`00000000-0000-4000-8000-${String(200 + index).padStart(12, '0')}`, selectedId,
        `00000000-0000-4000-8000-${suffix}`, 'CALLS');
    });
    const targets = calls.map(call => artifact(call.toArtifactId, 'SERVICE_METHOD', call.toArtifactId));
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(artifact(selectedId, 'SERVICE_METHOD', 'Service.run')),
      listBySnapshotAndIds: jest.fn().mockResolvedValue([artifact(selectedId, 'SERVICE_METHOD', 'Service.run'), ...targets]),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue(calls),
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue([]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([evidence(
      '00000000-0000-4000-8000-000000000010', selectedId, 'CODE')]) } as any;

    const result = await new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository).execute(snapshotId, selectedId);

    expect(result.codeEvidence.staticCalls).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.limitations.map(item => item.code)).toContain('COMPREHENSION_LIMIT');
  });

  it.each([[101, false], [102, true]])(
    'distinguishes %i direct edges from a real overflow', async (edgeCount, expectedTruncated) => {
      const outgoing = Array.from({ length: edgeCount }, (_, index) => edge(
        `00000000-0000-4000-8000-${String(300 + index).padStart(12, '0')}`, selectedId,
        `00000000-0000-4000-8000-${String(500 + index).padStart(12, '0')}`, 'CALLS'));
      const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run');
      const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
        repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
      const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
        listBySnapshotAndIds: jest.fn().mockResolvedValue([selected]),
        listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
      const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockImplementation(
        (_snapshot: string, _sources: string[], _types: string[], take: number) => outgoing.slice(0, take)),
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue([]) } as any;
      const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([evidence(
        '00000000-0000-4000-8000-000000000010', selectedId, 'CODE')]) } as any;

      const result = await new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository)
        .execute(snapshotId, selectedId);

      expect(graph.listOutgoingBySnapshotAndSources).toHaveBeenCalledWith(
        snapshotId, [selectedId], ['CALLS', 'REFERENCES'], 102);
      expect(result.truncated).toBe(expectedTruncated);
      expect(result.limitations.map(item => item.code).includes('COMPREHENSION_LIMIT')).toBe(expectedTruncated);
    },
  );

  it('reports when validated direct dependencies exceed the displayed relationship limit', async () => {
    const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run');
    const targets = Array.from({ length: 51 }, (_, index) => ({
      ...artifact(`00000000-0000-4000-8000-${String(1000 + index).padStart(12, '0')}`,
        'ENTITY', `Entity${index}`),
      universalKind: 'DATA_MODEL',
    }));
    const references = targets.map((target, index) => edge(
      `00000000-0000-4000-8000-${String(2000 + index).padStart(12, '0')}`,
      selectedId, target.id, 'REFERENCES'));
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockResolvedValue([selected, ...targets]),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue(references),
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue([]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([
      evidence('00000000-0000-4000-8000-000000000010', selectedId, 'CODE'),
    ]) } as any;

    const result = await new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository)
      .execute(snapshotId, selectedId);

    expect(result.codeEvidence.dependencies).toHaveLength(50);
    expect(result.truncated).toBe(true);
    expect(result.limitations.map(item => item.code)).toContain('COMPREHENSION_LIMIT');
  });

  it('reports a reverse-call truncation only after a caller beyond the relationship cap exists', async () => {
    const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run');
    const callers = Array.from({ length: 81 }, (_, index) => {
      const id = `00000000-0000-4000-8000-${String(4000 + index).padStart(12, '0')}`;
      return artifact(id, 'SERVICE_METHOD', id);
    });
    const incoming = callers.map((caller, index) => edge(
      `00000000-0000-4000-8000-${String(5000 + index).padStart(12, '0')}`,
      caller.id, selectedId, 'CALLS'));
    const allArtifacts = [selected, ...callers];
    const allEvidence = allArtifacts.map((item, index) => evidence(
      `00000000-0000-4000-8000-${String(6000 + index).padStart(12, '0')}`,
      item.id, 'CODE'));
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifactsRepository = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockImplementation((_snapshot: string, ids: string[]) =>
        allArtifacts.filter(item => ids.includes(item.id))),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue([]),
      listIncomingBySnapshotAndTargets: jest.fn().mockImplementation(
        (_snapshot: string, targets: string[], _types: string[], take: number) =>
          targets.includes(selectedId) ? incoming.slice(0, take) : []),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue([]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockImplementation(
      ({ artifactIds }: { artifactIds: string[] }) => allEvidence.filter(item => artifactIds.includes(item.artifactId))) } as any;

    const result = await new GetCodeComprehensionUseCase(prisma, artifactsRepository, graph, evidenceRepository)
      .execute(snapshotId, selectedId);

    expect(result.truncated).toBe(true);
    expect(result.limitations.map(item => item.code)).toContain('CALL_DEPTH_LIMIT');
    expect(graph.listIncomingBySnapshotAndTargets).toHaveBeenCalledWith(snapshotId, [selectedId], ['CALLS'], 81);
  });

  it('keeps production evidence visible and reports missing supported test references', async () => {
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run', { codeEvidence: {
      parameters: [], conditions: [], exceptionHandlers: [],
    } });
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockResolvedValue([selected]),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue([]),
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue([]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([evidence(
      '00000000-0000-4000-8000-000000000010', selectedId, 'CODE')]) } as any;

    const result = await new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository).execute(snapshotId, selectedId);

    expect(result.selectedCode.name).toBe('Service.run');
    expect(result.relatedScenarios).toEqual([]);
    expect(result.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NO_SUPPORTED_TEST_REFERENCE' }),
    ]));
  });
});
