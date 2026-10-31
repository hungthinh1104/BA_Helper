import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@ba-helper/backend-runtime';
import { codeComprehensionResponseSchema, graphResponseSchema } from '@ba-helper/contracts';
import crypto from 'node:crypto';
import { installQueryMeter } from '../../../../scripts/pinned-comprehension-query-meter';
import request from 'supertest';
import { measureHighFanoutProjection } from './helpers/code-comprehension-fanout';
import { createPersistedScenarioPageCorpus } from './helpers/code-comprehension-pagination';
import { createTestApp } from './helpers/test-app';
import { resetDatabase } from './helpers/reset-db';

const commitSha = 'e2e-comprehension-commit';

jest.setTimeout(90_000);

describe('Code comprehension projection (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let adminToken: string;
  let snapshotId: string;
  let selectedArtifactId: string;
  let measureQueries: ReturnType<typeof installQueryMeter>;

  beforeAll(async () => {
    app = await createTestApp(moduleFixture => {
      measureQueries = installQueryMeter(moduleFixture.get(PrismaService));
    });
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
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

  afterEach(async () => {
    if (prisma) await resetDatabase(prisma);
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

  it.each(['fromArtifactId', 'toArtifactId'] as const)(
    'rejects a cross-snapshot %s and keeps graph and comprehension projections scoped',
    async (foreignEndpoint) => {
    const foreignProject = await prisma.project.create({ data: { name: 'Foreign comprehension project' } });
    const foreignRepository = await prisma.repository.create({
      data: { projectId: foreignProject.id, canonicalUrl: 'https://github.com/mock/foreign-comprehension' },
    });
    const foreignSnapshot = await prisma.repositorySnapshot.create({
      data: { repositoryId: foreignRepository.id, commitSha: 'foreign-comprehension-commit',
        analyzerVersion: 'analyzer@0.14.0', coverageStatus: 'READY' },
    });
    const foreignArtifactId = crypto.randomUUID();
    await prisma.codeArtifact.create({
      data: { id: foreignArtifactId, snapshotId: foreignSnapshot.id,
        artifactKey: 'private:src/payment-secrets.ts:PaymentSecrets.refundCustomer',
        name: 'PaymentSecrets.refundCustomer', artifactType: 'SERVICE_METHOD',
        universalKind: 'DOMAIN_SERVICE', filePath: 'src/payment-secrets.ts' },
    });
    const edgeData = {
      snapshotId,
      fromArtifactId: selectedArtifactId,
      toArtifactId: selectedArtifactId,
      type: 'CALLS' as const,
      [foreignEndpoint]: foreignArtifactId,
    };
    await expect(prisma.dependencyEdge.create({ data: edgeData })).rejects.toMatchObject({ code: 'P2003' });
    await expect(prisma.dependencyEdge.count({
      where: { snapshotId, OR: [
        { fromArtifactId: foreignArtifactId },
        { toArtifactId: foreignArtifactId },
      ] },
    })).resolves.toBe(0);

    const response = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const projection = codeComprehensionResponseSchema.parse(response.body);

    expect(JSON.stringify(projection)).not.toContain('PaymentSecrets.refundCustomer');
    expect(JSON.stringify(projection)).not.toContain('src/payment-secrets.ts');

    const graphResponse = await request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/graph`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const graph = graphResponseSchema.parse(graphResponse.body);
    expect(graph.edges.some((edge) =>
      edge.fromArtifactId === foreignArtifactId || edge.toArtifactId === foreignArtifactId)).toBe(false);
    },
  );

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
    const sample = await measureHighFanoutProjection({ app, prisma, measureQueries, snapshotId,
      selectedArtifactId, adminToken });
    expect(sample.cold.projection.relatedScenarios).toHaveLength(8);
    expect(new Set(sample.cold.projection.relatedScenarios.map(item => item.testArtifact.id)).size).toBe(8);
    expect(sample.cold.projection.scenarioPagination.hasMore).toBe(false);
    expect(sample.cold.projection.truncated).toBe(false);
    expect(sample.cacheMisses).toHaveLength(5);
    expect(sample.cacheMisses.map(item => item.projection.scenarioPagination.offset)).toEqual([0, 1, 2, 3, 4]);
    expect(sample.cacheMisses.every(item => item.projection.relatedScenarios.length === 8 - item.scenarioOffset &&
      !item.projection.scenarioPagination.hasMore && !item.projection.truncated &&
      item.database.queryCount > 0 && item.database.returnedRows > 0 && item.database.nonPromiseQueries === 0)).toBe(true);
    expect(sample.warm).toHaveLength(10);
    expect(sample.warm.every(item => item.database.nonPromiseQueries === 0)).toBe(true);
    expect(sample.edgeCounts).toEqual({ testEdges: sample.edgeCounts.expectedTestEdges,
      callEdges: sample.edgeCounts.expectedCallEdges, expectedTestEdges: 561, expectedCallEdges: 80 });
    expect(sample.report.result.responseBytes).toBeLessThan(1_000_000);
  });

  it.each([49, 50, 51])('pages %i persisted scenarios across the PostgreSQL boundary without repeats', async total => {
    const expectedTitles = await createPersistedScenarioPageCorpus(prisma, snapshotId, selectedArtifactId, total);
    const observedTitles: string[] = [];
    const observedIds = new Set<string>();

    for (let offset = 0; offset < total; offset += 50) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
        .query({ scenarioLimit: 50, scenarioOffset: offset })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const projection = codeComprehensionResponseSchema.parse(response.body);
      const current = projection.relatedScenarios.map(item => item.testArtifact.id);

      expect(current.every(id => !observedIds.has(id))).toBe(true);
      for (const id of current) observedIds.add(id);
      observedTitles.push(...projection.relatedScenarios.map(item => item.testCase?.title ?? 'missing'));
      expect(projection.relatedScenarios.every(item => item.trace?.relation === 'DIRECT_REFERENCE')).toBe(true);
      expect(projection.scenarioPagination.hasMore).toBe(offset + 50 < total);
      expect(projection.truncated).toBe(false);
    }

    expect(observedTitles).toEqual(expectedTitles);
    expect(observedIds.size).toBe(total);
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
