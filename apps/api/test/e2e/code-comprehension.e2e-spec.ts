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
    const testProvenance = `snapshot:${snapshotId}:artifact:test:test/booking.spec.ts#cancel`;
    const serviceProvenance = `snapshot:${snapshotId}:artifact:service:src/booking.service.ts:BookingService.cancel`;
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

  it('returns one scenario when the same Jest case references both a method and its caller', async () => {
    const callerId = crypto.randomUUID();
    const callerKey = 'service:src/booking.controller.ts:BookingController.cancel';
    const test = await prisma.codeArtifact.findFirstOrThrow({ where: { snapshotId, artifactType: 'JEST_TEST_CASE' } });
    await prisma.codeArtifact.create({ data: {
      id: callerId, snapshotId, artifactKey: callerKey, name: 'BookingController.cancel',
      artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath: 'src/booking.controller.ts',
      startLine: 10, endLine: 20, language: 'typescript', contentHash: 'sha256:caller',
    } });
    await prisma.evidence.create({ data: {
      id: crypto.randomUUID(), provenanceKey: `snapshot:${snapshotId}:artifact:${callerKey}`, sourceType: 'CODE',
      snapshotId, artifactId: callerId, sourcePath: 'src/booking.controller.ts', startLine: 10, endLine: 20,
      excerpt: 'return service.cancel(bookingId);', contentHash: 'sha256:caller-evidence',
    } });
    await prisma.dependencyEdge.createMany({ data: [
      { id: crypto.randomUUID(), snapshotId, fromArtifactId: callerId, toArtifactId: selectedArtifactId,
        type: 'CALLS', confidence: 1, metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
          evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${callerKey}`,
          locations: [{ sourcePath: 'src/booking.controller.ts', startLine: 14, endLine: 14 }] } },
      { id: crypto.randomUUID(), snapshotId, fromArtifactId: test.id, toArtifactId: callerId,
        type: 'TESTS', confidence: 1, metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
          evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${test.artifactKey}`,
          locations: [{ sourcePath: 'test/booking.spec.ts', startLine: 15, endLine: 15 }] } },
    ] });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension?scenarioLimit=1`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const projection = codeComprehensionResponseSchema.parse(response.body);
    expect(projection.relatedScenarios).toHaveLength(1);
    expect(projection.scenarioPagination.hasMore).toBe(false);
    expect(projection.relatedScenarios[0].trace?.relation).toBe('DIRECT_REFERENCE');
  });

  it('shows a persisted entity reference only with source provenance', async () => {
    const entityId = crypto.randomUUID();
    await prisma.codeArtifact.update({ where: { id: selectedArtifactId },
      data: { artifactType: 'API_ROUTE', universalKind: 'API_ENDPOINT' } });
    await prisma.codeArtifact.create({ data: {
      id: entityId, snapshotId, artifactKey: 'entity:src/booking.entity.ts:Booking', name: 'Booking',
      artifactType: 'ENTITY', universalKind: 'DATA_MODEL', filePath: 'src/booking.entity.ts',
      startLine: 1, endLine: 8, language: 'typescript', contentHash: 'sha256:entity',
    } });
    await prisma.dependencyEdge.create({ data: {
      id: crypto.randomUUID(), snapshotId, fromArtifactId: selectedArtifactId, toArtifactId: entityId,
      type: 'REFERENCES', confidence: 1, metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_ENTITY_REFERENCE',
        evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:service:src/booking.service.ts:BookingService.cancel`,
        locations: [{ sourcePath: 'src/booking.service.ts', startLine: 12, endLine: 12 }] },
    } });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const projection = codeComprehensionResponseSchema.parse(response.body);
    expect(projection.selectedCode.artifactType).toBe('API_ROUTE');
    expect(projection.codeEvidence.dependencies.map(item => item.id)).toContain(entityId);
    expect(projection.codeEvidence.staticCalls).toEqual([]);
  });

  it('does not invent a next page when many TESTS edges share few Jest cases', async () => {
    const callers = Array.from({ length: 80 }, (_, index) => ({
      id: crypto.randomUUID(), key: `service:src/fanout-${index}.ts:Caller${index}.run`,
      path: `src/fanout-${index}.ts`, name: `Caller${index}.run`,
    }));
    const tests = Array.from({ length: 7 }, (_, index) => ({
      id: crypto.randomUUID(), key: `test:test%2Ffanout.spec.ts#case-${index}`, name: `case-${index}`,
    }));
    await prisma.codeArtifact.createMany({ data: [
      ...callers.map(item => ({ id: item.id, snapshotId, artifactKey: item.key, name: item.name,
        artifactType: 'SERVICE_METHOD', universalKind: 'DOMAIN_SERVICE', filePath: item.path,
        startLine: 1, endLine: 10, language: 'typescript', contentHash: 'sha256:caller' })),
      ...tests.map(item => ({ id: item.id, snapshotId, artifactKey: item.key, name: item.name,
        artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE', filePath: 'test/fanout.spec.ts',
        startLine: 1, endLine: 10, language: 'typescript', contentHash: 'sha256:test',
        metadata: { testCase: { framework: 'jest', suitePath: ['Fanout'], title: item.name,
          modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: 'test:test%2Ffanout.spec.ts#file',
          behaviorEvidence: [] } } })),
    ] });
    await prisma.evidence.createMany({ data: [
      ...callers.map(item => ({ id: crypto.randomUUID(), snapshotId, artifactId: item.id,
        provenanceKey: `snapshot:${snapshotId}:artifact:${item.key}`, sourceType: 'CODE' as const,
        sourcePath: item.path, startLine: 1, endLine: 10, excerpt: 'return service.cancel(id);', contentHash: 'sha256:caller' })),
      ...tests.map(item => ({ id: crypto.randomUUID(), snapshotId, artifactId: item.id,
        provenanceKey: `snapshot:${snapshotId}:artifact:${item.key}`, sourceType: 'TEST' as const,
        sourcePath: 'test/fanout.spec.ts', startLine: 1, endLine: 10,
        excerpt: 'it("case", () => caller.run());', contentHash: 'sha256:test' })),
    ] });
    await prisma.dependencyEdge.createMany({ data: [
      ...callers.map(item => ({ id: crypto.randomUUID(), snapshotId, fromArtifactId: item.id,
        toArtifactId: selectedArtifactId, type: 'CALLS' as const, confidence: 1,
        metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
          evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${item.key}`,
          locations: [{ sourcePath: item.path, startLine: 5, endLine: 5 }] } })),
      ...callers.flatMap(caller => tests.map(test => ({ id: crypto.randomUUID(), snapshotId,
        fromArtifactId: test.id, toArtifactId: caller.id, type: 'TESTS' as const, confidence: 1,
        metadata: { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
          evidenceProvenanceKey: `snapshot:${snapshotId}:artifact:${test.key}`,
          locations: [{ sourcePath: 'test/fanout.spec.ts', startLine: 5, endLine: 5 }] } }))),
    ] });

    const started = performance.now();
    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const latencyMs = performance.now() - started;
    const projection = codeComprehensionResponseSchema.parse(response.body);
    expect(projection.relatedScenarios).toHaveLength(8);
    expect(new Set(projection.relatedScenarios.map(item => item.testArtifact.id)).size).toBe(8);
    expect(projection.scenarioPagination.hasMore).toBe(false);
    const payloadBytes = Buffer.byteLength(JSON.stringify(response.body), 'utf8');
    const warmSamples: number[] = [];
    for (let index = 0; index < 10; index += 1) {
      const warmStart = performance.now();
      await request(app.getHttpServer())
        .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      warmSamples.push(performance.now() - warmStart);
    }
    const ordered = warmSamples.slice().sort((left, right) => left - right);
    process.stdout.write(`${JSON.stringify({ comprehensionFanoutSample: { callers: 80, cases: 8,
      testEdges: 561, coldMs: latencyMs, warmP50Ms: ordered[4], warmP95Ms: ordered[9],
      payloadBytes, rssBytes: process.memoryUsage().rss } })}\n`);
    expect(payloadBytes).toBeLessThan(1_000_000);
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

  it('discovers production artifacts through a bounded searchable page', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts?scope=production&search=BookingService&limit=1&offset=0`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ id: selectedArtifactId, artifactType: 'SERVICE_METHOD' });
    expect(response.body.hasMore).toBe(false);
    expect(response.body.limit).toBe(1);
    expect(response.body.offset).toBe(0);
  });

  it('keeps warm comprehension reads bounded for a small local performance sample', async () => {
    const durations: number[] = [];
    let payloadBytes = 0;
    for (let index = 0; index < 12; index += 1) {
      const started = performance.now();
      const response = await request(app.getHttpServer())
        .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension?scenarioLimit=1&scenarioOffset=0`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      durations.push(performance.now() - started);
      payloadBytes = Buffer.byteLength(JSON.stringify(response.body), 'utf8');
    }
    const sorted = durations.slice().sort((left, right) => left - right);
    const p50 = sorted[Math.ceil(sorted.length * 0.5) - 1];
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    process.stdout.write(`${JSON.stringify({ comprehensionWarmSample: { samples: durations.length, p50Ms: p50, p95Ms: p95, payloadBytes } })}\n`);
    expect(payloadBytes).toBeLessThan(1_000_000);
    // This is a regression ceiling for a bounded local API sample, not a
    // production capacity claim; CI records the measured values separately.
    expect(p95).toBeLessThan(2_000);
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
  const evidenceProvenanceKey = `snapshot:${snapshotId}:artifact:test:test/booking.spec.ts#cancel`;
  return {
    framework: 'jest', suitePath: ['BookingService'], title: 'cancels a paid booking', modifier: 'NORMAL', declaredModifier: 'NORMAL',
    parentFileArtifactKey: 'test:test%2Fbooking.spec.ts#file', behaviorEvidence: [
      { kind: 'ACTION', evidenceKind: 'STATIC_DECLARATION', sourceText: 'service.cancel(bookingId)', sourceLocation: claimLocation,
        commitSha, evidenceProvenanceKey },
      { kind: 'ASSERTION', assertionKind: 'RETURN_VALUE', evidenceKind: 'STATIC_DECLARATION', sourceText: 'expect(result).toBeUndefined()',
        sourceLocation: assertionLocation, relatedInvocationSourceLocation: claimLocation, relatedSubjectText: 'result', commitSha, evidenceProvenanceKey },
      { kind: 'EXPECTED_OUTCOME', assertionKind: 'RETURN_VALUE', evidenceKind: 'STATIC_DECLARATION', sourceText: 'undefined',
        sourceLocation: expectedLocation, relatedAssertionSourceLocation: assertionLocation, commitSha, evidenceProvenanceKey },
    ],
  };
}
