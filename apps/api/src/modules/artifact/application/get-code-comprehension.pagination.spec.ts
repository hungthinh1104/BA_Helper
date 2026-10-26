import { createArtifactIdentity } from '@ba-helper/shared';
import { artifact, repositoryId, scenarioHarness, selectedId, snapshotId } from './get-code-comprehension.test-fixtures';
import { GetCodeComprehensionUseCase } from './get-code-comprehension.usecase';

describe('GetCodeComprehensionUseCase scenario pagination', () => {
  it.each([0, 1, 49, 50, 51, 199, 200, 201])(
    'pages %i proven scenarios without repeating or losing retrievable cases', async (count) => {
      const useCase = scenarioHarness(count);
      const observed: string[] = [];
      for (let offset = 0; offset <= count; offset += 50) {
        const result = await useCase.execute(snapshotId, selectedId, { scenarioLimit: 50, scenarioOffset: offset });
        observed.push(...result.relatedScenarios.map(item => item.testCase?.title ?? 'missing'));
        expect(result.scenarioPagination.hasMore).toBe(offset + 50 < count);
        expect(result.truncated).toBe(false);
        if (!result.scenarioPagination.hasMore) break;
      }
      expect(observed).toEqual(Array.from({ length: count }, (_, index) =>
        `case-${String(index).padStart(3, '0')}`));
    });

  it('continues past an invalid edge and reports the omitted evidence', async () => {
    const result = await scenarioHarness(51, 24).execute(snapshotId, selectedId);
    expect(result.relatedScenarios).toHaveLength(50);
    expect(result.scenarioPagination.hasMore).toBe(false);
    expect(result.relatedScenarios.map(item => item.testCase?.title)).toContain('case-050');
    expect(result.relatedScenarios.map(item => item.testCase?.title)).not.toContain('case-024');
    expect(result.limitations.map(item => item.code)).toContain('EDGE_PROVENANCE_UNRESOLVED');
  });

  it('reports the candidate scan budget before asserting absence of later valid relationships', async () => {
    const result = await scenarioHarness(5001, undefined, 5000).execute(snapshotId, selectedId);
    expect(result.relatedScenarios).toEqual([]);
    expect(result.scenarioPagination.hasMore).toBe(false);
    expect(result.truncated).toBe(true);
    expect(result.limitations.map(item => item.code)).toContain('SCENARIO_SOURCE_SCAN_LIMIT');
    expect(result.limitations.map(item => item.code)).not.toContain('NO_SUPPORTED_TEST_REFERENCE');
    const omitted = result.limitations.filter(item => item.code === 'EDGE_PROVENANCE_UNRESOLVED');
    expect(omitted).toHaveLength(1);
    expect(omitted[0]).toMatchObject({ count: 5000, payload: { sampleEdgeIds: expect.any(Array) } });
    expect(omitted[0].payload?.sampleEdgeIds).toHaveLength(3);
  });

  it('does not report a scan limit when the candidate index ends exactly at the budget', async () => {
    const result = await scenarioHarness(5000, undefined, 5000).execute(snapshotId, selectedId);

    expect(result.limitations.map(item => item.code)).not.toContain('SCENARIO_SOURCE_SCAN_LIMIT');
    expect(result.limitations.map(item => item.code)).toContain('NO_SUPPORTED_TEST_REFERENCE');
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
});
