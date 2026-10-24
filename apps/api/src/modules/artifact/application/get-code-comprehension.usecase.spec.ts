import { GetCodeComprehensionUseCase } from './get-code-comprehension.usecase';
import { findCallPath } from './get-code-comprehension.mapper';

const snapshotId = '00000000-0000-4000-8000-000000000001';
const selectedId = '00000000-0000-4000-8000-000000000002';
const callerId = '00000000-0000-4000-8000-000000000003';
const testId = '00000000-0000-4000-8000-000000000004';
const dependencyId = '00000000-0000-4000-8000-000000000005';
const repositoryId = '00000000-0000-4000-8000-000000000006';

function artifact(id: string, type: string, name: string, metadata: unknown = null) {
  return { id, snapshotId, artifactKey: `${type.toLowerCase()}:${name}`, name, artifactType: type,
    universalKind: type === 'JEST_TEST_CASE' ? 'TEST_CASE' : 'DOMAIN_SERVICE', filePath: `${name}.ts`,
    startLine: 1, endLine: 12, language: 'typescript', contentHash: 'sha256:artifact', metadata,
    createdAt: new Date(), updatedAt: new Date() };
}

function edge(id: string, fromArtifactId: string, toArtifactId: string, type: 'CALLS' | 'TESTS') {
  return { id, snapshotId, fromArtifactId, toArtifactId, type, confidence: 1,
    metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${fromArtifactId}`,
      locations: [{ sourcePath: `${type.toLowerCase()}.spec.ts`, startLine: 5, endLine: 5 }] },
    createdAt: new Date() };
}

function evidence(id: string, artifactId: string, sourceType: 'CODE' | 'TEST') {
  return { id, provenanceKey: `snapshot:${snapshotId}:artifact:${artifactId}`, sourceType,
    snapshotId, artifactId, requirementRevisionId: null, sourcePath: `${sourceType.toLowerCase()}.ts`,
    startLine: 1, endLine: 12, excerpt: sourceType === 'CODE' ? 'return dependency.run();' : 'it(\'runs\', () => service.run());',
    contentHash: 'sha256:evidence', isRedacted: false, redactionMetadata: null, createdAt: new Date() };
}

describe('GetCodeComprehensionUseCase', () => {
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

  it('returns bounded code-first evidence and a static test-to-code path', async () => {
    const claim = { kind: 'ACTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'service.run()',
      sourceLocation: { relativePath: 'test.ts', startOffset: 1, endOffset: 15, startLine: 5, startColumn: 1,
        endLine: 5, endColumn: 15 }, commitSha: 'commit-1',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${testId}` } as const;
    const mismatchedClaim = { ...claim, sourceText: 'service.unverified()', commitSha: 'different-commit',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${testId}:foreign` } as const;
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
      parentFileArtifactKey: 'test:test.ts#file', behaviorEvidence: [claim, mismatchedClaim],
    } });
    const dependency = artifact(dependencyId, 'SERVICE_METHOD', 'Dependency.run');
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(selected),
      listBySnapshotAndIds: jest.fn().mockResolvedValue([selected, caller, test, dependency]),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue([edge('00000000-0000-4000-8000-000000000020', selectedId, dependencyId, 'CALLS')]),
      listIncomingBySnapshotAndTargets: jest.fn().mockImplementation((_snapshot: string, targets: string[], types: string[]) =>
        types[0] === 'CALLS'
          ? targets.includes(selectedId) ? [edge('00000000-0000-4000-8000-000000000021', callerId, selectedId, 'CALLS')] : []
          : [edge('00000000-0000-4000-8000-000000000022', testId, callerId, 'TESTS')]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([
      evidence('00000000-0000-4000-8000-000000000010', selectedId, 'CODE'),
      evidence('00000000-0000-4000-8000-000000000011', testId, 'TEST'),
    ]) } as any;

    const useCase = new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository);
    const result = await useCase.execute(snapshotId, selectedId);

    expect(result.selectedCode.name).toBe('Service.run');
    expect(result.codeEvidence.staticCalls).toHaveLength(1);
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
    expect(artifacts.listBySnapshotAndArtifactKeys).toHaveBeenCalledWith(snapshotId, ['test:test.ts#file']);
    expect(result.relatedScenarios[0].trace?.relationships.map(item => item.type)).toEqual(['TESTS', 'CALLS']);
    expect(result.snapshotContext).toMatchObject({ repositoryId, snapshotId, commitSha: 'commit-1', runtimeObservations: 'NOT_IMPORTED' });
    expect(result.limitations.map(item => item.code)).toContain('RUNTIME_OBSERVATIONS_NOT_IMPORTED');
    expect(Buffer.byteLength(JSON.stringify(result), 'utf8')).toBeLessThan(1_000_000);
    expect(graph.listOutgoingBySnapshotAndSources).toHaveBeenCalledTimes(1);
    expect(graph.listIncomingBySnapshotAndTargets).toHaveBeenCalledTimes(3);
    expect(artifacts.listBySnapshotAndIds).toHaveBeenCalledTimes(1);
    expect(artifacts.listBySnapshotAndArtifactKeys).toHaveBeenCalledTimes(1);
    expect(evidenceRepository.listByArtifactIds).toHaveBeenCalledTimes(1);

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
    const prisma = { repositorySnapshot: { findUnique: jest.fn().mockResolvedValue({ id: snapshotId,
      repositoryId, commitSha: 'commit-1', analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] }) } } as any;
    const artifacts = { findBySnapshotAndId: jest.fn().mockResolvedValue(artifact(selectedId, 'SERVICE_METHOD', 'Service.run')),
      listBySnapshotAndIds: jest.fn().mockResolvedValue([]),
      listBySnapshotAndArtifactKeys: jest.fn().mockResolvedValue([]) } as any;
    const graph = { listOutgoingBySnapshotAndSources: jest.fn().mockResolvedValue(calls),
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]) } as any;
    const evidenceRepository = { listByArtifactIds: jest.fn().mockResolvedValue([]) } as any;

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
      listIncomingBySnapshotAndTargets: jest.fn().mockResolvedValue([]) } as any;
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
