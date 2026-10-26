import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type {
  ArtifactRepository, EvidenceRepository, GraphRepository, PrismaService,
} from '../packages/backend-runtime/src/index';
import { GetCodeComprehensionUseCase } from '../apps/api/src/modules/artifact/application/get-code-comprehension.usecase';
import type { installQueryMeter, QueryStats } from './pinned-comprehension-query-meter';
import { summarizeMs } from './pinned-proof-scan';
import { verifyPersistedPinnedProjections } from './verify-pinned-comprehension-provenance';

const PINNED_COMMIT = 'b49ae92a6c0b0db39b6542338a2ffea3eda15717';
const METHOD_NAMES = ['AuthController.register', 'CurrentUserInterceptor.intercept',
  'AuthenticationService.verifyPayload'] as const;
type Projection = Awaited<ReturnType<GetCodeComprehensionUseCase['execute']>>;
type MeasureQueries = ReturnType<typeof installQueryMeter>;
type Repositories = { artifacts: ArtifactRepository; graph: GraphRepository; evidence: EvidenceRepository };
type ProjectionShape = 'DIRECT' | 'INDIRECT' | 'NO_TEST';
type MethodReference = { id: string; name: string };

type ColdProjectionSample = {
  elapsedMs: number; database: QueryStats; responseBytes: number;
  memoryBefore: { rss: number; heapUsed: number };
  memoryAfter: { rss: number; heapUsed: number };
};

function sampleColdProjections(snapshotId: string, methodId: string): ColdProjectionSample[] {
  return Array.from({ length: 5 }, () => {
    const output = execFileSync(process.execPath, ['-r', 'ts-node/register/transpile-only',
      path.resolve('scripts/measure-pinned-cold-projection.ts'), snapshotId, methodId, PINNED_COMMIT],
    { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
    return JSON.parse(output.trim()) as ColdProjectionSample;
  });
}

function getRequiredMethodIds(methods: Array<{ id: string; name: string }>): readonly [string, string, string] {
  const byName = new Map(methods.map(method => [method.name, method.id]));
  if (byName.size !== METHOD_NAMES.length || METHOD_NAMES.some(name => !byName.has(name))) {
    throw new Error('Pinned source method identity changed.');
  }
  return METHOD_NAMES.map(name => byName.get(name)!) as [string, string, string];
}

async function measureComplexityWorkloads(
  prisma: PrismaService,
  repositories: Repositories,
  measureQueries: MeasureQueries,
  snapshotId: string,
  methods: { multiId: string; multiName: string; mockId: string; mockName: string;
    indirect?: MethodReference; noTest?: MethodReference; mostRelationships?: MethodReference },
) {
  if (!methods.indirect || !methods.noTest || !methods.mostRelationships) {
    throw new Error('The pinned corpus no longer demonstrates indirect and no-test paths.');
  }
  const workloads = [
    { kind: 'MULTIPLE_SCENARIOS', id: methods.multiId, name: methods.multiName },
    { kind: 'INDIRECT_PATH', ...methods.indirect },
    { kind: 'MOST_RELATIONSHIPS', ...methods.mostRelationships },
    { kind: 'UNRESOLVED_EVIDENCE', id: methods.mockId, name: methods.mockName },
    { kind: 'NO_SUPPORTED_TEST', ...methods.noTest },
  ];
  const results = [];
  for (const workload of workloads) {
    const samples = [];
    for (let index = 0; index < 5; index += 1) {
      const uncachedReader = new GetCodeComprehensionUseCase(prisma,
        repositories.artifacts, repositories.graph, repositories.evidence);
      const started = performance.now();
      const { result, stats } = await measureQueries(() => uncachedReader.execute(snapshotId, workload.id));
      const elapsedMs = performance.now() - started;
      if (result.snapshotContext.commitSha !== PINNED_COMMIT || stats.nonPromiseQueries !== 0) {
        throw new Error(`Workload ${workload.kind} lost provenance or query instrumentation.`);
      }
      const unresolvedCodes = result.relatedScenarios.flatMap(scenario =>
        scenario.unresolved.map(item => item.code));
      if (workload.kind === 'UNRESOLVED_EVIDENCE' &&
        !unresolvedCodes.includes('ASSERTION_INVOCATION_UNRESOLVED')) {
        throw new Error('The unresolved workload has no scenario-specific uncertainty.');
      }
      samples.push({ elapsedMs, database: stats, scenarios: result.relatedScenarios.length,
        relationships: result.relatedScenarios.reduce((count, scenario) =>
          count + (scenario.trace?.relationships.length ?? 0), 0),
        limitationCodes: result.limitations.map(item => item.code), unresolvedCodes,
        responseBytes: Buffer.byteLength(JSON.stringify(result), 'utf8') });
    }
    results.push({ kind: workload.kind, method: workload.name,
      latency: summarizeMs(samples.map(sample => sample.elapsedMs)), samples });
  }
  return results;
}

function classifyProjectionShape(projection: Projection): ProjectionShape {
  if (projection.relatedScenarios.length === 0) return 'NO_TEST';
  return projection.relatedScenarios.some(scenario => scenario.trace?.relation === 'CALL_PATH')
    ? 'INDIRECT' : 'DIRECT';
}

async function discoverProjectionShapes(
  prisma: PrismaService,
  reader: GetCodeComprehensionUseCase,
  snapshotId: string,
) {
  const methods = await prisma.codeArtifact.findMany({ where: {
    snapshotId, artifactType: { in: ['API_ROUTE', 'SERVICE_METHOD'] },
  }, select: { id: true, name: true }, orderBy: { artifactKey: 'asc' } });
  const shapeCounts: Record<ProjectionShape, number> = { DIRECT: 0, INDIRECT: 0, NO_TEST: 0 };
  const examples: Partial<Record<ProjectionShape, MethodReference>> = {};
  let mostRelationships: (MethodReference & { relationships: number }) | undefined;
  for (const method of methods) {
    const projection = await reader.execute(snapshotId, method.id);
    const shape = classifyProjectionShape(projection);
    shapeCounts[shape] += 1;
    examples[shape] ??= { id: method.id, name: method.name };
    const relationships = projection.relatedScenarios.reduce((count, scenario) =>
      count + (scenario.trace?.relationships.length ?? 0), 0);
    if (!mostRelationships || relationships > mostRelationships.relationships) {
      mostRelationships = { id: method.id, name: method.name, relationships };
    }
    if (shape === 'NO_TEST' && !projection.limitations.some(item => item.code === 'NO_SUPPORTED_TEST_REFERENCE')) {
      throw new Error('A no-test method lacks its explicit uncertainty diagnostic.');
    }
  }
  return { shapeCounts, indirect: examples.INDIRECT, noTest: examples.NO_TEST, mostRelationships };
}

export async function measurePinnedProjections(input: {
  prisma: PrismaService;
  root: string;
  snapshotId: string;
  measureQueries: MeasureQueries;
  repositories: Repositories;
}) {
  const methods = await input.prisma.codeArtifact.findMany({ where: {
    snapshotId: input.snapshotId, name: { in: [...METHOD_NAMES] },
  }, select: { id: true, name: true } });
  const [directId, multiId, mockId] = getRequiredMethodIds(methods);
  const coldSamples = sampleColdProjections(input.snapshotId, directId);
  const reader = new GetCodeComprehensionUseCase(input.prisma, input.repositories.artifacts,
    input.repositories.graph, input.repositories.evidence);
  const memoryBeforeProjection = process.memoryUsage();
  const coldStarted = performance.now();
  const { result: direct, stats: coldDb } = await input.measureQueries(
    () => reader.execute(input.snapshotId, directId));
  const coldMs = performance.now() - coldStarted;
  const memoryAfterFirstProjection = process.memoryUsage();
  const multi = await reader.execute(input.snapshotId, multiId);
  const mock = await reader.execute(input.snapshotId, mockId);
  assertPinnedProjectionEvidence(direct, multi, mock);
  const cacheSamples = await measureProjectionCache(input, reader, directId, coldDb);
  const memoryAfterCacheMisses = process.memoryUsage();
  const shapes = await discoverProjectionShapes(input.prisma, reader, input.snapshotId);
  if (!shapes.indirect || !shapes.noTest || !shapes.mostRelationships) {
    throw new Error('The pinned corpus no longer demonstrates indirect and no-test paths.');
  }
  const indirect = await reader.execute(input.snapshotId, shapes.indirect.id);
  const noTest = await reader.execute(input.snapshotId, shapes.noTest.id);
  const provenanceVerification = await verifyPersistedPinnedProjections(input.prisma, input.root,
    input.snapshotId, PINNED_COMMIT, [direct, multi, mock, indirect, noTest]);
  const higherComplexity = await measureComplexityWorkloads(input.prisma, input.repositories,
    input.measureQueries, input.snapshotId, {
    multiId, multiName: METHOD_NAMES[1], mockId, mockName: METHOD_NAMES[2], ...shapes,
  });
  return {
    methodIds: { direct: directId, multi: multiId, mock: mockId,
      indirect: shapes.indirect.id, noTest: shapes.noTest.id },
    direct, multi, mock, provenanceVerification, shapeCounts: shapes.shapeCounts,
    performance: {
      coldProjection: { condition: 'five fresh Node processes; modules and database connection initialized before timed projection',
        latency: summarizeMs(coldSamples.map(sample => sample.elapsedMs)), samples: coldSamples },
      higherComplexity,
      firstProjectionAfterScan: { condition: 'fresh projection cache; shared scan process and database pool',
        latency: summarizeMs([coldMs]), samplesMs: [coldMs], database: [coldDb] },
      warmInfrastructureCacheMiss: { condition: 'same initialized database pool; new projection use case per sample',
        latency: summarizeMs(cacheSamples.missMs), samplesMs: cacheSamples.missMs, database: cacheSamples.missDb },
      projectionCacheHit: { condition: 'same initialized pool and populated projection cache',
        latency: summarizeMs(cacheSamples.hitMs), samplesMs: cacheSamples.hitMs, database: cacheSamples.hitDb },
      responseBytes: Buffer.byteLength(JSON.stringify(direct), 'utf8'),
      memory: { beforeProjection: { rss: memoryBeforeProjection.rss, heapUsed: memoryBeforeProjection.heapUsed },
        afterFirstProjection: { rss: memoryAfterFirstProjection.rss, heapUsed: memoryAfterFirstProjection.heapUsed },
        afterCacheMisses: { rss: memoryAfterCacheMisses.rss, heapUsed: memoryAfterCacheMisses.heapUsed },
        atEnd: { rss: process.memoryUsage().rss, heapUsed: process.memoryUsage().heapUsed } },
      driverMetricLimitations: ['Returned rows count excludes non-SELECT statements without rows.',
        'The first projection shares a process and database pool with the scan; it is not a new-process cold benchmark.'],
    },
  };
}

function assertPinnedProjectionEvidence(direct: Projection, multi: Projection, mock: Projection): void {
  if (direct.snapshotContext.commitSha !== PINNED_COMMIT ||
    direct.relatedScenarios.every(scenario => scenario.testCase?.title !== 'should register a new user') ||
    direct.relatedScenarios.some(scenario => !scenario.trace?.relationships.every(
      relation => relation.evidence?.commitSha === PINNED_COMMIT && relation.evidence.provenanceKey)) ||
    direct.codeEvidence.staticCalls.length === 0 || direct.codeEvidence.dependencies.length === 0 ||
    multi.relatedScenarios.length < 3 || mock.relatedScenarios.every(scenario => scenario.mockedBoundaries.length === 0) ||
    !mock.relatedScenarios.some(scenario => scenario.unresolved.some(item =>
      item.code === 'ASSERTION_INVOCATION_UNRESOLVED'))) {
    throw new Error('Pinned Code to Evidence to Test projection failed its source-backed assertions.');
  }
}

async function measureProjectionCache(
  input: { prisma: PrismaService; snapshotId: string; measureQueries: MeasureQueries; repositories: Repositories },
  reader: GetCodeComprehensionUseCase,
  directId: string,
  coldDb: QueryStats,
) {
  const missMs: number[] = [];
  const missDb: QueryStats[] = [];
  for (let index = 0; index < 10; index += 1) {
    const uncachedReader = new GetCodeComprehensionUseCase(input.prisma,
      input.repositories.artifacts, input.repositories.graph, input.repositories.evidence);
    const started = performance.now();
    const sample = await input.measureQueries(() => uncachedReader.execute(input.snapshotId, directId));
    missMs.push(performance.now() - started);
    missDb.push(sample.stats);
  }
  const hitMs: number[] = [];
  const hitDb: QueryStats[] = [];
  for (let index = 0; index < 10; index += 1) {
    const started = performance.now();
    const sample = await input.measureQueries(() => reader.execute(input.snapshotId, directId));
    hitMs.push(performance.now() - started);
    hitDb.push(sample.stats);
  }
  if ([coldDb, ...missDb, ...hitDb].some(sample => sample.nonPromiseQueries > 0)) {
    throw new Error('The query meter could not count returned rows for every driver query.');
  }
  return { missMs, missDb, hitMs, hitDb };
}
