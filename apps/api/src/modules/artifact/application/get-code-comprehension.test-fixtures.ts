import { createArtifactIdentity } from '@ba-helper/shared';
import { GetCodeComprehensionUseCase } from './get-code-comprehension.usecase';

export const snapshotId = '00000000-0000-4000-8000-000000000001';
export const selectedId = '00000000-0000-4000-8000-000000000002';
export const callerId = '00000000-0000-4000-8000-000000000003';
export const testId = '00000000-0000-4000-8000-000000000004';
export const dependencyId = '00000000-0000-4000-8000-000000000005';
export const repositoryId = '00000000-0000-4000-8000-000000000006';
export const entityId = '00000000-0000-4000-8000-000000000007';

export function artifact(id: string, type: string, name: string, metadata: unknown = null) {
  return { id, snapshotId, artifactKey: `${type.toLowerCase()}:${name}`, name, artifactType: type,
    universalKind: type === 'JEST_TEST_CASE' ? 'TEST_CASE' : 'DOMAIN_SERVICE', filePath: `${name}.ts`,
    startLine: 1, endLine: 12, language: 'typescript', contentHash: 'sha256:artifact', metadata,
    createdAt: new Date(), updatedAt: new Date() };
}

export function artifactKey(id: string) {
  if (id === selectedId) return 'service_method:Service.run';
  if (id === callerId) return 'service_method:Controller.handle';
  if (id === testId) return 'jest_test_case:runs';
  if (id === dependencyId) return 'service_method:Dependency.run';
  if (id === entityId) return 'entity:Booking';
  return `service_method:${id}`;
}

export function artifactFile(id: string) {
  if (id === selectedId) return 'Service.run.ts';
  if (id === callerId) return 'Controller.handle.ts';
  if (id === testId) return 'runs.ts';
  if (id === dependencyId) return 'Dependency.run.ts';
  if (id === entityId) return 'Booking.ts';
  return `${id}.ts`;
}

export function edge(id: string, fromArtifactId: string, toArtifactId: string,
  type: 'CALLS' | 'TESTS' | 'REFERENCES') {
  return { id, snapshotId, fromArtifactId, toArtifactId, type, confidence: 1,
    metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: type === 'REFERENCES' ? 'TS_AST_ENTITY_REFERENCE' : 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey(fromArtifactId)}`,
      locations: [{ sourcePath: artifactFile(fromArtifactId), startLine: 5, endLine: 5 }] },
    createdAt: new Date() };
}

export function evidence(id: string, artifactId: string, sourceType: 'CODE' | 'TEST') {
  return { id, provenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey(artifactId)}`, sourceType,
    snapshotId, artifactId, requirementRevisionId: null, sourcePath: artifactFile(artifactId),
    startLine: 1, endLine: 12, excerpt: sourceType === 'CODE' ? 'return dependency.run();' : 'it(\'runs\', () => service.run());',
    contentHash: 'sha256:evidence', isRedacted: false, redactionMetadata: null, createdAt: new Date() };
}

export function scenarioHarness(count: number, invalidIndex?: number, invalidBefore = 0) {
  const selected = artifact(selectedId, 'SERVICE_METHOD', 'Service.run');
  const tests = Array.from({ length: count }, (_, index) => {
    const item = artifact(`00000000-0000-4000-8000-${String(10000 + index).padStart(12, '0')}`,
      'JEST_TEST_CASE', `case-${String(index).padStart(3, '0')}`);
    return { ...item, metadata: { testCase: { framework: 'jest', suitePath: ['Service'],
      title: item.name, modifier: 'NORMAL', declaredModifier: 'NORMAL',
      parentFileArtifactKey: createArtifactIdentity('test', item.filePath, 'file'), behaviorEvidence: [] } } };
  });
  const edges = tests.map((test, index) => ({
    id: `00000000-0000-4000-8000-${String(20000 + index).padStart(12, '0')}`,
    snapshotId, fromArtifactId: test.id, toArtifactId: selectedId, type: 'TESTS', confidence: 1,
    metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: index === invalidIndex || index < invalidBefore ? 'missing-provenance' :
        `snapshot:${snapshotId}:artifact:${test.artifactKey}`,
      locations: [{ sourcePath: test.filePath, startLine: 5, endLine: 5 }] }, createdAt: new Date(),
  }));
  const allArtifacts = [selected, ...tests];
  const evidences = allArtifacts.map((item, index) => ({
    id: `00000000-0000-4000-8000-${String(30000 + index).padStart(12, '0')}`,
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
  return new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidenceRepository);
}
