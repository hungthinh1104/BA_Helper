import type { INestApplication } from '@nestjs/common';
import type { PrismaService } from '@ba-helper/backend-runtime';
import { codeComprehensionResponseSchema } from '@ba-helper/contracts';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { installQueryMeter, QueryStats } from '../../../../../scripts/pinned-comprehension-query-meter';
import request from 'supertest';

type MeasureQueries = ReturnType<typeof installQueryMeter>;
type Projection = ReturnType<typeof codeComprehensionResponseSchema.parse>;
type ProjectionSample = { scenarioOffset: number; latencyMs: number; database: QueryStats; projection: Projection };

export async function measureHighFanoutProjection(input: {
  app: INestApplication;
  prisma: PrismaService;
  measureQueries: MeasureQueries;
  snapshotId: string;
  selectedArtifactId: string;
  adminToken: string;
}) {
  const { app, prisma, measureQueries, snapshotId, selectedArtifactId, adminToken } = input;
  const { callers, tests } = await createFanoutFixture(prisma, snapshotId, selectedArtifactId);
  const cold = await measureProjection(app, measureQueries, snapshotId, selectedArtifactId, adminToken);
  const cacheMisses = [cold];
  for (const scenarioOffset of [1, 2, 3, 4]) {
    cacheMisses.push(await measureProjection(app, measureQueries, snapshotId,
      selectedArtifactId, adminToken, scenarioOffset));
  }
  const warm = await measureWarmCache(app, measureQueries, snapshotId, selectedArtifactId, adminToken);
  const edgeCounts = await countFixtureEdges(prisma, snapshotId, callers, tests, selectedArtifactId);
  const report = buildFanoutReport({ callers: callers.length, cold,
    cacheMisses, warm, edgeCounts });
  writeFanoutReport(report);
  return { report, cold, cacheMisses, warm, edgeCounts };
}

async function createFanoutFixture(prisma: PrismaService, snapshotId: string, selectedArtifactId: string) {
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
  return { callers, tests };
}

async function measureProjection(
  app: INestApplication,
  measureQueries: MeasureQueries,
  snapshotId: string,
  selectedArtifactId: string,
  adminToken: string,
  scenarioOffset?: number,
): Promise<ProjectionSample> {
  const started = performance.now();
  const query = request(app.getHttpServer())
    .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`);
  const routed = scenarioOffset === undefined ? query : query.query({ scenarioOffset });
  const measured = await measureQueries(async () => routed
    .set('Authorization', `Bearer ${adminToken}`).expect(200));
  return { scenarioOffset: scenarioOffset ?? 0, latencyMs: performance.now() - started, database: measured.stats,
    projection: codeComprehensionResponseSchema.parse(measured.result.body) };
}

async function measureWarmCache(
  app: INestApplication, measureQueries: MeasureQueries, snapshotId: string,
  selectedArtifactId: string, adminToken: string,
) {
  const samples: Array<{ latencyMs: number; database: QueryStats }> = [];
  for (let index = 0; index < 10; index += 1) {
    const started = performance.now();
    const result = await measureQueries(async () => request(app.getHttpServer())
      .get(`/api/v1/snapshots/${snapshotId}/artifacts/${selectedArtifactId}/comprehension`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200));
    samples.push({ latencyMs: performance.now() - started, database: result.stats });
  }
  return samples;
}

async function countFixtureEdges(
  prisma: PrismaService, snapshotId: string, callers: Array<{ id: string }>,
  tests: Array<{ id: string }>, selectedArtifactId: string,
) {
  const [testEdges, callEdges] = await Promise.all([
    prisma.dependencyEdge.count({ where: { snapshotId, type: 'TESTS',
      toArtifactId: { in: [selectedArtifactId, ...callers.map(item => item.id)] } } }),
    prisma.dependencyEdge.count({ where: { snapshotId, type: 'CALLS', toArtifactId: selectedArtifactId,
      fromArtifactId: { in: callers.map(item => item.id) } } }),
  ]);
  return { testEdges, callEdges, expectedTestEdges: 1 + callers.length * tests.length,
    expectedCallEdges: callers.length };
}

function buildFanoutReport(input: {
  callers: number; cold: ProjectionSample; cacheMisses: ProjectionSample[];
  warm: Array<{ latencyMs: number; database: QueryStats }>;
  edgeCounts: { testEdges: number; callEdges: number };
}) {
  const { cold, cacheMisses, warm, edgeCounts } = input;
  const orderedWarm = warm.map(sample => sample.latencyMs).sort((left, right) => left - right);
  const orderedMiss = cacheMisses.map(sample => sample.latencyMs).sort((left, right) => left - right);
  const projection = cold.projection;
  const payloadBytes = Buffer.byteLength(JSON.stringify(projection), 'utf8');
  return {
    benchmark: 'synthetic-e2e-high-fanout',
    toolCommitSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    toolWorkingTreeDirty: Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()),
    condition: 'Synthetic PostgreSQL-backed API workload; five unique scenario offsets force projection cache misses on a warm database pool. Repeated offset-zero requests are full-response cache hits that still read snapshot and artifact state.',
    workload: { callerArtifacts: input.callers, testCases: projection.relatedScenarios.length,
      callEdges: edgeCounts.callEdges, testEdges: edgeCounts.testEdges,
      inputEdges: edgeCounts.callEdges + edgeCounts.testEdges },
    result: { scenarios: projection.relatedScenarios.length,
      displayedRelationships: projection.relatedScenarios.reduce((count, scenario) =>
        count + (scenario.trace?.relationships.length ?? 0), 0),
      responseBytes: payloadBytes, truncated: projection.truncated,
      limitationCodes: projection.limitations.map(item => item.code).sort() },
    cold: { latencyMs: cold.latencyMs, database: cold.database },
    cacheMiss: { sampleCount: cacheMisses.length,
      latencyMs: { p50: orderedMiss[2], p95: orderedMiss[4] }, samples: cacheMisses.map(sample => ({
        scenarioOffset: sample.scenarioOffset, latencyMs: sample.latencyMs, database: sample.database,
        scenarios: sample.projection.relatedScenarios.length, truncated: sample.projection.truncated,
      })) },
    warm: { sampleCount: warm.length, latencyMs: { p50: orderedWarm[4], p95: orderedWarm[9] },
      database: warm.map(sample => sample.database) },
    memory: { rssBytes: process.memoryUsage().rss },
    environment: { cpu: cpus()[0]?.model ?? 'unknown', logicalCores: cpus().length,
      totalMemoryBytes: totalmem(), platform: process.platform, node: process.version },
    driverMetricLimitations: ['Rows returned excludes PostgreSQL statements without result rows.'],
  };
}

function writeFanoutReport(report: ReturnType<typeof buildFanoutReport>): void {
  const reportPath = path.resolve('artifacts/evaluation/code-comprehension-fanout-e2e.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ comprehensionFanoutSample: report })}\n`);
}
