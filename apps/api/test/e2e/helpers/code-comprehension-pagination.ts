import type { PrismaService } from '@ba-helper/backend-runtime';
import crypto from 'node:crypto';
import { createArtifactIdentity } from '@ba-helper/shared';

const testSourcePath = 'test/pagination.spec.ts';
const callerSourcePath = 'src/pagination-caller.ts';

export async function createPersistedScenarioPageCorpus(
  prisma: PrismaService,
  snapshotId: string,
  selectedArtifactId: string,
  totalCases: number,
): Promise<string[]> {
  const original = await prisma.codeArtifact.findFirstOrThrow({
    where: { snapshotId, artifactType: 'JEST_TEST_CASE' },
  });
  const originalTitle = 'cancels a paid booking';
  const callerId = '33333333-3333-4333-8333-000000000001';
  const callerKey = createArtifactIdentity('service', callerSourcePath, 'PaginationCaller.run');
  const parentFileArtifactKey = createArtifactIdentity('test', testSourcePath, 'file');
  const tests = Array.from({ length: Math.max(0, totalCases - 1) }, (_, index) => {
    const title = `persisted-case-${String(index).padStart(3, '0')}`;
    const id = `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`;
    return { id, title, artifactKey: createArtifactIdentity('test', testSourcePath, title) };
  });
  const allTests = [{ id: original.id, title: originalTitle, artifactKey: original.artifactKey }, ...tests];

  await prisma.codeArtifact.create({ data: {
    id: callerId, snapshotId, artifactKey: callerKey, name: 'PaginationCaller.run', artifactType: 'SERVICE_METHOD',
    universalKind: 'DOMAIN_SERVICE', filePath: callerSourcePath, startLine: 1, endLine: 5,
    language: 'typescript', contentHash: 'sha256:pagination-caller',
  } });
  await prisma.codeArtifact.createMany({ data: tests.map(test => ({
    id: test.id, snapshotId, artifactKey: test.artifactKey, name: test.title,
    artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: testSourcePath,
    startLine: 1, endLine: 8, language: 'typescript', contentHash: `sha256:${test.title}`,
    metadata: { testCase: { framework: 'jest', suitePath: ['Pagination'], title: test.title,
      modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey, behaviorEvidence: [] } },
  })) });

  await prisma.evidence.create({ data: {
    id: crypto.randomUUID(), provenanceKey: `snapshot:${snapshotId}:artifact:${callerKey}`,
    sourceType: 'CODE', snapshotId, artifactId: callerId, sourcePath: callerSourcePath,
    startLine: 1, endLine: 5, excerpt: 'return service.cancel(id);', contentHash: 'sha256:pagination-caller-evidence',
  } });
  await prisma.evidence.createMany({ data: tests.map(test => ({
    id: crypto.randomUUID(), provenanceKey: `snapshot:${snapshotId}:artifact:${test.artifactKey}`,
    sourceType: 'TEST', snapshotId, artifactId: test.id, sourcePath: testSourcePath,
    startLine: 1, endLine: 8, excerpt: 'it("case", () => service.cancel(id));', contentHash: `sha256:${test.title}-evidence`,
  })) });

  await prisma.dependencyEdge.createMany({ data: [
    { id: crypto.randomUUID(), snapshotId, fromArtifactId: callerId, toArtifactId: selectedArtifactId,
      type: 'CALLS', confidence: 1, metadata: edgeMetadata(snapshotId, callerSourcePath, callerKey) },
    { id: crypto.randomUUID(), snapshotId, fromArtifactId: original.id, toArtifactId: callerId,
      type: 'TESTS', confidence: 1, metadata: edgeMetadata(snapshotId, 'test/booking.spec.ts', original.artifactKey) },
    ...tests.flatMap(test => [selectedArtifactId, callerId].map(targetArtifactId => ({
      id: crypto.randomUUID(), snapshotId, fromArtifactId: test.id, toArtifactId: targetArtifactId,
      type: 'TESTS' as const, confidence: 1, metadata: edgeMetadata(snapshotId, testSourcePath, test.artifactKey),
    }))),
  ] });

  return allTests.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
    .map(test => test.title);
}

function edgeMetadata(snapshotId: string, sourcePath: string, artifactKey: string) {
  return { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
    evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${artifactKey}`,
    locations: [{ sourcePath, startLine: 5, endLine: 5 }] };
}
