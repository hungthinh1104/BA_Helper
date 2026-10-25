import { GetCodeComprehensionUseCase } from './get-code-comprehension.usecase';
import { findCallPath } from './get-code-comprehension.mapper';
import { validateStaticEntityUse } from './validate-static-entity-use';
import { createArtifactIdentity } from '@ba-helper/shared';

const snapshotId = '00000000-0000-4000-8000-000000000001';
const selectedId = '00000000-0000-4000-8000-000000000002';
const callerId = '00000000-0000-4000-8000-000000000003';
const testId = '00000000-0000-4000-8000-000000000004';
const dependencyId = '00000000-0000-4000-8000-000000000005';
const repositoryId = '00000000-0000-4000-8000-000000000006';
const entityId = '00000000-0000-4000-8000-000000000007';

function artifact(id: string, type: string, name: string, metadata: unknown = null) {
  return { id, snapshotId, artifactKey: `${type.toLowerCase()}:${name}`, name, artifactType: type,
    universalKind: type === 'JEST_TEST_CASE' ? 'TEST_CASE' : 'DOMAIN_SERVICE', filePath: `${name}.ts`,
    startLine: 1, endLine: 12, language: 'typescript', contentHash: 'sha256:artifact', metadata,
    createdAt: new Date(), updatedAt: new Date() };
}

function artifactKey(id: string) {
  if (id === selectedId) return 'service_method:Service.run';
  if (id === callerId) return 'service_method:Controller.handle';
  if (id === testId) return 'jest_test_case:runs';
  if (id === dependencyId) return 'service_method:Dependency.run';
  if (id === entityId) return 'entity:Booking';
  return `service_method:${id}`;
}

function artifactFile(id: string) {
  if (id === selectedId) return 'Service.run.ts';
  if (id === callerId) return 'Controller.handle.ts';
  if (id === testId) return 'runs.ts';
  if (id === dependencyId) return 'Dependency.run.ts';
  if (id === entityId) return 'Booking.ts';
  return `${id}.ts`;
}

function edge(id: string, fromArtifactId: string, toArtifactId: string, type: 'CALLS' | 'TESTS' | 'REFERENCES') {
  return { id, snapshotId, fromArtifactId, toArtifactId, type, confidence: 1,
    metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: type === 'REFERENCES' ? 'TS_AST_ENTITY_REFERENCE' : 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey(fromArtifactId)}`,
      locations: [{ sourcePath: artifactFile(fromArtifactId), startLine: 5, endLine: 5 }] },
    createdAt: new Date() };
}

function evidence(id: string, artifactId: string, sourceType: 'CODE' | 'TEST') {
  return { id, provenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey(artifactId)}`, sourceType,
    snapshotId, artifactId, requirementRevisionId: null, sourcePath: artifactFile(artifactId),
    startLine: 1, endLine: 12, excerpt: sourceType === 'CODE' ? 'return dependency.run();' : 'it(\'runs\', () => service.run());',
    contentHash: 'sha256:evidence', isRedacted: false, redactionMetadata: null, createdAt: new Date() };
}

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

  it('does not advertise another page when a bounded edge scan contains only repeated test cases', async () => {
    const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run');
    const callers = Array.from({ length: 80 }, (_, index) => artifact(
      `00000000-0000-4000-8000-${String(1000 + index).padStart(12, '0')}`,
      'SERVICE_METHOD', `Caller${index}`));
    const tests = Array.from({ length: 7 }, (_, index) => {
      const item = artifact(`00000000-0000-4000-8000-${String(2000 + index).padStart(12, '0')}`,
        'JEST_TEST_CASE', `case-${index}`);
      return { ...item, metadata: { testCase: { framework: 'jest', suitePath: ['Service'],
        title: `case-${index}`, modifier: 'NORMAL', declaredModifier: 'NORMAL',
        parentFileArtifactKey: createArtifactIdentity('test', item.filePath, 'file'), behaviorEvidence: [] } } };
    });
    const makeEdge = (id: number, from: typeof selected, to: typeof selected, type: 'CALLS' | 'TESTS') => ({
      id: `00000000-0000-4000-8000-${String(3000 + id).padStart(12, '0')}`,
      snapshotId, fromArtifactId: from.id, toArtifactId: to.id, type, confidence: 1,
      metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
        evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${from.artifactKey}`,
        locations: [{ sourcePath: from.filePath, startLine: 5, endLine: 5 }] }, createdAt: new Date(),
    });
    const calls = callers.map((caller, index) => makeEdge(index, caller, selected, 'CALLS'));
    const testEdges = callers.flatMap((caller, callerIndex) => tests.map((test, testIndex) =>
      makeEdge(100 + callerIndex * tests.length + testIndex, test, caller, 'TESTS')));
    const allArtifacts = [selected, ...callers, ...tests];
    const evidences = allArtifacts.map((item, index) => ({
      id: `00000000-0000-4000-8000-${String(4000 + index).padStart(12, '0')}`,
      snapshotId, artifactId: item.id, provenanceKey: `snapshot:${snapshotId}:artifact:${item.artifactKey}`,
      sourceType: item.artifactType === 'JEST_TEST_CASE' ? 'TEST' : 'CODE', sourcePath: item.filePath,
      startLine: 1, endLine: 12, excerpt: 'source declaration', contentHash: 'sha256:evidence',
      requirementRevisionId: null, isRedacted: false, redactionMetadata: null, createdAt: new Date(),
    }));
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockResolvedValue(allArtifacts),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue([]),
      listIncomingBySnapshotAndTargets: jest.fn().mockImplementation((_snapshot: string, targets: string[],
        types: string[], take: number) => types[0] === 'CALLS'
        ? targets.includes(selectedId) ? calls.slice(0, take) : [] : []),
      listIncomingTestSourceIds: jest.fn().mockResolvedValue(tests.map(test => test.id)),
      listTestEdgesBySourcesAndTargets: jest.fn().mockResolvedValue(testEdges) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue(evidences) } as any;

    const useCase = new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository);
    const result = await useCase.execute(snapshotId, selectedId);

    expect(result.relatedScenarios).toHaveLength(7);
    expect(result.scenarioPagination.hasMore).toBe(false);
    const middle = await useCase.execute(snapshotId, selectedId, { scenarioOffset: 3, scenarioLimit: 2 });
    expect(middle.relatedScenarios.map(scenario => scenario.testCase?.title)).toEqual(['case-3', 'case-4']);
    expect(middle.scenarioPagination.hasMore).toBe(true);
    const last = await useCase.execute(snapshotId, selectedId, { scenarioOffset: 5, scenarioLimit: 2 });
    expect(last.relatedScenarios.map(scenario => scenario.testCase?.title)).toEqual(['case-5', 'case-6']);
    expect(last.scenarioPagination.hasMore).toBe(false);
  });

  it('reports validated scenarios beyond the maximum offset without advertising an unreachable page', async () => {
    const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run');
    const tests = Array.from({ length: 502 }, (_, index) => {
      const item = artifact(`00000000-0000-4000-8000-${String(5000 + index).padStart(12, '0')}`,
        'JEST_TEST_CASE', `case-${index}`);
      return { ...item, metadata: { testCase: { framework: 'jest', suitePath: ['Service'],
        title: `case-${index}`, modifier: 'NORMAL', declaredModifier: 'NORMAL',
        parentFileArtifactKey: createArtifactIdentity('test', item.filePath, 'file'), behaviorEvidence: [] } } };
    });
    const edges = tests.map((test, index) => ({
      id: `00000000-0000-4000-8000-${String(6000 + index).padStart(12, '0')}`,
      snapshotId, fromArtifactId: test.id, toArtifactId: selectedId, type: 'TESTS', confidence: 1,
      metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
        evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${test.artifactKey}`,
        locations: [{ sourcePath: test.filePath, startLine: 5, endLine: 5 }] }, createdAt: new Date(),
    }));
    const allArtifacts = [selected, ...tests];
    const evidences = allArtifacts.map((item, index) => ({
      id: `00000000-0000-4000-8000-${String(7000 + index).padStart(12, '0')}`,
      snapshotId, artifactId: item.id, provenanceKey: `snapshot:${snapshotId}:artifact:${item.artifactKey}`,
      sourceType: item.artifactType === 'JEST_TEST_CASE' ? 'TEST' : 'CODE', sourcePath: item.filePath,
      startLine: 1, endLine: 12, excerpt: 'source declaration', contentHash: 'sha256:evidence',
      requirementRevisionId: null, isRedacted: false, redactionMetadata: null, createdAt: new Date(),
    }));
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockImplementation((_snapshot: string, ids: string[]) =>
        allArtifacts.filter(item => ids.includes(item.id))),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue([]),
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]),
      listIncomingTestSourceIds: jest.fn().mockImplementation((_snapshot: string, _targets: string[],
        afterId: string | undefined, take: number) => tests.filter(item => !afterId || item.id > afterId)
        .slice(0, take).map(item => item.id)),
      listTestEdgesBySourcesAndTargets: jest.fn().mockImplementation((_snapshot: string, ids: string[]) =>
        edges.filter(item => ids.includes(item.fromArtifactId))) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockImplementation(
      ({ artifactIds }: { artifactIds: string[] }) => evidences.filter(item => artifactIds.includes(item.artifactId))) } as any;

    const result = await new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository)
      .execute(snapshotId, selectedId, { scenarioOffset: 500, scenarioLimit: 1 });

    expect(result.relatedScenarios.map(item => item.testCase?.title)).toEqual(['case-500']);
    expect(result.scenarioPagination.hasMore).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.limitations.map(item => item.code)).toContain('SCENARIO_OFFSET_LIMIT');
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
