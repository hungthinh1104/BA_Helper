import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import { codeComprehensionResponseSchema } from '@ba-helper/contracts';
import crypto from 'node:crypto';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

const commitSha = 'e2e-comprehension-commit';

describe('Code comprehension projection (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let snapshotId: string;
  let selectedArtifactId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
    const user = await prisma.user.create({
      data: { id: crypto.randomUUID(), email: 'comprehension-admin@ba-helper.local', name: 'Comprehension Admin', role: 'ADMIN' },
    });
    adminToken = jwtService.sign({ sub: user.id, email: user.email, role: user.role });
    const project = await prisma.project.create({ data: { name: 'Comprehension Project' } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: user.id, role: 'OWNER' } });
    const repository = await prisma.repository.create({
      data: { projectId: project.id, canonicalUrl: 'https://github.com/mock/comprehension-repo' },
    });
    const snapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: repository.id, commitSha, analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY', diagnostics: [] },
    });
    snapshotId = snapshot.id;
    selectedArtifactId = crypto.randomUUID();
    const testArtifactId = crypto.randomUUID();
    await prisma.codeArtifact.createMany({ data: [
      {
        id: selectedArtifactId, snapshotId, artifactKey: 'service:src/booking.service.ts:BookingService.cancel',
        name: 'BookingService.cancel', artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE',
        filePath: 'src/booking.service.ts', startLine: 10, endLine: 24, language: 'typescript', contentHash: 'sha256:service',
        metadata: { codeEvidence: { parameters: [{ name: 'bookingId', typeText: 'string', sourceText: 'bookingId: string',
          sourceLocation: location('src/booking.service.ts', 200, 220, 10, 32, 10, 52) }],
          returnType: { text: 'Promise<void>', sourceLocation: location('src/booking.service.ts', 221, 234, 10, 53, 10, 66) },
          conditions: [{ kind: 'IF', sourceText: 'booking.status !== Paid', sourceLocation: location('src/booking.service.ts', 250, 274, 12, 5, 12, 29) }], exceptionHandlers: [] } },
      },
      {
        id: testArtifactId, snapshotId, artifactKey: 'test:test/booking.spec.ts#cancel', name: 'cancels a paid booking',
        artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: 'test/booking.spec.ts', startLine: 8, endLine: 18,
        language: 'typescript', contentHash: 'sha256:test', metadata: { testCase: testCaseMetadata(testArtifactId, snapshotId) },
      },
    ] });
    const testProvenance = `snapshot:${snapshotId}:artifact:${testArtifactId}`;
    const serviceProvenance = `snapshot:${snapshotId}:artifact:${selectedArtifactId}`;
    await prisma.evidence.createMany({ data: [
      { id: crypto.randomUUID(), provenanceKey: serviceProvenance, sourceType: 'CODE', snapshotId, artifactId: selectedArtifactId,
        sourcePath: 'src/booking.service.ts', startLine: 10, endLine: 24, excerpt: 'async cancel(bookingId: string): Promise<void> { ... }',
        contentHash: 'sha256:service-evidence' },
      { id: crypto.randomUUID(), provenanceKey: testProvenance, sourceType: 'TEST', snapshotId, artifactId: testArtifactId,
        sourcePath: 'test/booking.spec.ts', startLine: 8, endLine: 18, excerpt: 'it(\'cancels a paid booking\', () => service.cancel(bookingId));',
        contentHash: 'sha256:test-evidence' },
    ] });
    await prisma.dependencyEdge.create({ data: {
      id: crypto.randomUUID(), snapshotId, fromArtifactId: testArtifactId, toArtifactId: selectedArtifactId, type: 'TESTS', confidence: 1,
      metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL', evidenceProvenanceKey: testProvenance,
        locations: [{ sourcePath: 'test/booking.spec.ts', startLine: 15, endLine: 15 }] },
    } });
  });

  it('serves a snapshot-scoped projection with persisted source and semantic evidence', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const projection = codeComprehensionResponseSchema.parse(response.body);

    expect(projection.selectedCode.id).toBe(selectedArtifactId);
    expect(projection.codeEvidence.source).toMatchObject({ sourceType: 'CODE', commitSha, filePath: 'src/booking.service.ts' });
    expect(projection.codeEvidence.conditions[0]).toMatchObject({ excerpt: 'booking.status !== Paid', commitSha });
    expect(projection.relatedScenarios).toHaveLength(1);
    expect(projection.relatedScenarios[0]).toMatchObject({
      testCase: { title: 'cancels a paid booking' },
      invocations: [{ kind: 'ACTION', sourceText: 'service.cancel(bookingId)' }],
      assertions: [{ kind: 'ASSERTION', assertionKind: 'RETURN_VALUE' }],
      trace: { relation: 'DIRECT_REFERENCE' },
    });
    expect(projection.relatedScenarios[0].behaviorAssociations[0]).toMatchObject({ basis: 'AST_SUBJECT_REFERENCE' });
    expect(projection.snapshotContext).toMatchObject({ snapshotId, commitSha, runtimeObservations: 'NOT_IMPORTED' });
  });

  it('rejects a user without membership before reading the projection', async () => {
    const outsider = await prisma.user.create({
      data: { id: crypto.randomUUID(), email: 'outsider@ba-helper.local', name: 'Outsider', role: 'REVIEWER' },
    });
    const outsiderToken = jwtService.sign({ sub: outsider.id, email: outsider.email, role: outsider.role });
    await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${outsiderToken}`)
      .expect(404);
  });

  it('keeps a method explorable when no supported test reference exists', async () => {
    const untestedArtifactId = crypto.randomUUID();
    await prisma.codeArtifact.create({ data: {
      id: untestedArtifactId, snapshotId, artifactKey: 'service:src/uncovered.service.ts:Uncovered.run', name: 'Uncovered.run',
      artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath: 'src/uncovered.service.ts', startLine: 4, endLine: 8,
      language: 'typescript', contentHash: 'sha256:uncovered', metadata: { codeEvidence: {
        parameters: [], conditions: [], exceptionHandlers: [],
      } },
    } });
    await prisma.evidence.create({ data: {
      id: crypto.randomUUID(), provenanceKey: `snapshot:${snapshotId}:artifact:${untestedArtifactId}`, sourceType: 'CODE',
      snapshotId, artifactId: untestedArtifactId, sourcePath: 'src/uncovered.service.ts', startLine: 4, endLine: 8,
      excerpt: 'run() { return true; }', contentHash: 'sha256:uncovered-evidence',
    } });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${untestedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const projection = codeComprehensionResponseSchema.parse(response.body);

    expect(projection.selectedCode.name).toBe('Uncovered.run');
    expect(projection.relatedScenarios).toEqual([]);
    expect(projection.limitations).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'NO_SUPPORTED_TEST_REFERENCE' }),
    ]));
  });
});

function location(relativePath: string, startOffset: number, endOffset: number, startLine: number,
  startColumn: number, endLine: number, endColumn: number) {
  return { relativePath, startOffset, endOffset, startLine, startColumn, endLine, endColumn };
}

function testCaseMetadata(testArtifactId: string, snapshotId: string) {
  const claimLocation = location('test/booking.spec.ts', 100, 123, 15, 3, 15, 26);
  const assertionLocation = location('test/booking.spec.ts', 130, 155, 16, 3, 16, 28);
  const expectedLocation = location('test/booking.spec.ts', 150, 160, 16, 20, 16, 30);
  const evidenceProvenanceKey = `snapshot:${snapshotId}:artifact:${testArtifactId}`;
  return {
    framework: 'jest', suitePath: ['BookingService'], title: 'cancels a paid booking', modifier: 'NORMAL', declaredModifier: 'NORMAL',
    parentFileArtifactKey: 'test:test/booking.spec.ts#file', behaviorEvidence: [
      { kind: 'ACTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'service.cancel(bookingId)', sourceLocation: claimLocation,
        commitSha, evidenceProvenanceKey },
      { kind: 'ASSERTION', assertionKind: 'RETURN_VALUE', evidenceKind: 'STATIC_DECLARATION', sourceText: 'expect(result).toBeUndefined()',
        sourceLocation: assertionLocation, relatedInvocationSourceLocation: claimLocation, relatedSubjectText: 'result', commitSha, evidenceProvenanceKey },
      { kind: 'EXPECTED_OUTCOME', assertionKind: 'RETURN_VALUE', evidenceKind: 'STATIC_DECLARATION', sourceText: 'undefined',
        sourceLocation: expectedLocation, relatedAssertionSourceLocation: assertionLocation, commitSha, evidenceProvenanceKey },
    ],
  };
}
