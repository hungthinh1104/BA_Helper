import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { config } from 'dotenv';
import type { Pool } from 'pg';
import { DiagnosticCollector, scanFixture } from '../packages/analyzer/src/index';
import { TypeScriptNestJsAdapter } from '../packages/analyzer/src/scanner/adapters/typescript-nestjs.adapter';
import {
  ArtifactRepository, EvidenceRepository, GraphRepository, PrismaService,
  RunScanJobPersistenceStep, ScanJobRepository,
} from '../packages/backend-runtime/src/index';
import { GetCodeComprehensionUseCase } from '../apps/api/src/modules/artifact/application/get-code-comprehension.usecase';

const PINNED_COMMIT = 'b49ae92a6c0b0db39b6542338a2ffea3eda15717';
const CORPUS_URL = 'https://github.com/leosuncin/nest-api-example';
const OUTPUT = path.resolve('artifacts/evaluation/pinned-code-comprehension-proof.json');
type QueryStats = { queryCount: number; returnedRows: number; nonPromiseQueries: number };

function installQueryMeter(prisma: PrismaService) {
  const pool = Reflect.get(prisma, 'pool') as Pool | undefined;
  if (!pool) throw new Error('The proof could not access the test database pool for measurement.');
  let active: QueryStats | undefined;
  pool.on('connect', client => {
    const original = client.query.bind(client);
    client.query = ((...args: unknown[]) => {
      const sample = active;
      if (sample) sample.queryCount += 1;
      const queryArgs = [...args];
      const callback = queryArgs.at(-1);
      if (typeof callback === 'function') {
        queryArgs[queryArgs.length - 1] = (...callbackArgs: unknown[]) => {
          const response = callbackArgs[1] as { rows?: unknown[] } | undefined;
          if (sample) sample.returnedRows += response?.rows?.length ?? 0;
          return Reflect.apply(callback, client, callbackArgs);
        };
      }
      const result: unknown = Reflect.apply(original, client, queryArgs);
      if (typeof callback === 'function') return result;
      if (!result || typeof result !== 'object' || !('then' in result) ||
        typeof result.then !== 'function') {
        if (sample) sample.nonPromiseQueries += 1;
        return result;
      }
      return (result as Promise<{ rows?: unknown[] }>).then(response => {
        if (sample) sample.returnedRows += response.rows?.length ?? 0;
        return response;
      });
    }) as typeof client.query;
  });
  return async <T>(operation: () => Promise<T>): Promise<{ result: T; stats: QueryStats }> => {
    const stats = { queryCount: 0, returnedRows: 0, nonPromiseQueries: 0 };
    active = stats;
    try { return { result: await operation(), stats }; }
    finally { active = undefined; }
  };
}

function requirePinnedInputs(): string {
  config({ path: '.env.test', quiet: true });
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!databaseUrl || new URL(databaseUrl).pathname !== '/ba_helper_test') {
    throw new Error('The pinned proof requires DATABASE_URL_TEST pointing to the ba_helper_test database.');
  }
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  const root = path.resolve(process.env.PINNED_CORPUS_PATH ?? 'tmp/corpora/nest-api-example');
  const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const changes = execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'],
    { encoding: 'utf8' }).trim();
  if (head !== PINNED_COMMIT || changes) {
    throw new Error('The corpus checkout must be clean and pinned to the required commit.');
  }
  return root;
}

async function main(): Promise<void> {
  const root = requirePinnedInputs();
  const prisma = new PrismaService();
  const measureQueries = installQueryMeter(prisma);
  try {
    await prisma.$connect();
    const demoUser = await prisma.user.findUnique({ where: { email: 'demo@ba-helper.local' } });
    if (!demoUser) throw new Error('Seed the demo user in the test database before running the pinned proof.');
    const scanStarted = performance.now();
    const initial = scanFixture({ fixturePath: root, commitSha: PINNED_COMMIT });
    const adapter = new TypeScriptNestJsAdapter();
    const extracted = await adapter.scan({ rootDir: root, tsFiles: initial.sourceFiles ?? [],
      commitSha: PINNED_COMMIT, coverage: initial.coverage });
    const scanMs = performance.now() - scanStarted;
    const collector = new DiagnosticCollector();
    for (const diagnostic of extracted.diagnostics) collector.add(diagnostic);
    const scanResult = { ...initial, artifacts: extracted.artifacts,
      dependencyEdges: extracted.dependencyEdges, diagnostics: extracted.diagnostics };
    const project = await prisma.project.create({ data: { name: `Pinned NestJS proof ${randomUUID()}` } });
    await prisma.projectMember.create({ data: { projectId: project.id, userId: demoUser.id, role: 'OWNER' } });
    const repository = await prisma.repository.create({ data: { projectId: project.id, canonicalUrl: CORPUS_URL } });
    const job = await prisma.scanJob.create({ data: { repositoryId: repository.id, requestKey: randomUUID(),
      requestedRef: PINNED_COMMIT, status: 'RUNNING', stage: 'GENERATING_SUMMARIES', progress: 90 } });
    const artifacts = new ArtifactRepository(prisma);
    const graph = new GraphRepository(prisma);
    const evidence = new EvidenceRepository(prisma);
    const persistence = new RunScanJobPersistenceStep(
      prisma, artifacts, graph, evidence, new ScanJobRepository(prisma));
    const persisted = await persistence.persist({ job, commitSha: PINNED_COMMIT, scanResult,
      repositoryProfile: null, collector });
    const names = ['AuthController.register', 'CurrentUserInterceptor.intercept',
      'AuthenticationService.verifyPayload'];
    const methods = await prisma.codeArtifact.findMany({ where: { snapshotId: persisted.snapshotId,
      name: { in: names } }, select: { id: true, name: true } });
    const byName = new Map(methods.map(method => [method.name, method.id]));
    if (byName.size !== names.length) throw new Error('Pinned source method identity changed.');
    const reader = new GetCodeComprehensionUseCase(prisma, artifacts, graph, evidence);
    const coldStarted = performance.now();
    const { result: direct, stats: coldDb } = await measureQueries(
      () => reader.execute(persisted.snapshotId, byName.get(names[0])!));
    const coldMs = performance.now() - coldStarted;
    const multi = await reader.execute(persisted.snapshotId, byName.get(names[1])!);
    const mock = await reader.execute(persisted.snapshotId, byName.get(names[2])!);
    if (direct.snapshotContext.commitSha !== PINNED_COMMIT ||
      direct.relatedScenarios.every(scenario => scenario.testCase?.title !== 'should register a new user') ||
      direct.relatedScenarios.some(scenario => !scenario.trace?.relationships.every(
        relation => relation.evidence?.commitSha === PINNED_COMMIT && relation.evidence.provenanceKey)) ||
      direct.codeEvidence.staticCalls.length === 0 || direct.codeEvidence.dependencies.length === 0 ||
      multi.relatedScenarios.length < 3 ||
      mock.relatedScenarios.every(scenario => scenario.mockedBoundaries.length === 0)) {
      throw new Error('Pinned Code to Evidence to Test projection failed its source-backed assertions.');
    }
    const warmMs: number[] = [];
    const warmDb: QueryStats[] = [];
    for (let index = 0; index < 10; index += 1) {
      const started = performance.now();
      const sample = await measureQueries(() => reader.execute(persisted.snapshotId, byName.get(names[0])!));
      warmMs.push(performance.now() - started);
      warmDb.push(sample.stats);
    }
    if ([coldDb, ...warmDb].some(sample => sample.nonPromiseQueries > 0)) {
      throw new Error('The query meter could not count returned rows for every driver query.');
    }
    const candidateMethods = await prisma.codeArtifact.findMany({ where: {
      snapshotId: persisted.snapshotId, artifactType: { in: ['API_ROUTE', 'SERVICE_METHOD'] },
    }, select: { id: true, name: true }, orderBy: { artifactKey: 'asc' } });
    const shapeCounts = { DIRECT: 0, INDIRECT: 0, NO_TEST: 0 };
    const shapeExamples: Record<string, { id: string; name: string } | undefined> = {};
    for (const method of candidateMethods) {
      const projection = await reader.execute(persisted.snapshotId, method.id);
      const shape = projection.relatedScenarios.length === 0 ? 'NO_TEST'
        : projection.relatedScenarios.some(scenario => scenario.trace?.relation === 'CALL_PATH')
          ? 'INDIRECT' : 'DIRECT';
      shapeCounts[shape] += 1;
      shapeExamples[shape] ??= { id: method.id, name: method.name };
      if (shape === 'NO_TEST' && !projection.limitations.some(item => item.code === 'NO_SUPPORTED_TEST_REFERENCE')) {
        throw new Error('A no-test method lacks its explicit uncertainty diagnostic.');
      }
    }
    if (!shapeExamples.INDIRECT || !shapeExamples.NO_TEST) {
      throw new Error('The pinned corpus no longer demonstrates indirect and no-test paths.');
    }
    const proof = { corpusUrl: CORPUS_URL, commitSha: PINNED_COMMIT,
      scannedFiles: initial.scannedFileCount, scanMs, repositoryId: repository.id,
      snapshotId: persisted.snapshotId, methodId: byName.get(names[0]),
      multiMethodId: byName.get(names[1]), mockMethodId: byName.get(names[2]),
      persisted: { artifacts: persisted.artifactCount, edges: persisted.dependencyEdgeCount,
        evidence: persisted.evidenceCount, droppedEdges: persisted.skippedDependencyEdgeCount },
      direct: { scenarios: direct.relatedScenarios.length, staticCalls: direct.codeEvidence.staticCalls.length,
        dependencies: direct.codeEvidence.dependencies.length,
        limitations: direct.limitations.map(item => item.code) },
      multiScenarios: multi.relatedScenarios.length,
      mockClaims: mock.relatedScenarios.flatMap(scenario => scenario.mockedBoundaries).length,
      shapeCounts, indirectMethodId: shapeExamples.INDIRECT.id, noTestMethodId: shapeExamples.NO_TEST.id,
      coldMs, warmMs, coldDb, warmDb, rssAtEndBytes: process.memoryUsage().rss,
      environment: { cpu: cpus()[0]?.model ?? 'unknown', logicalCores: cpus().length,
        totalMemoryBytes: totalmem(), platform: process.platform, node: process.version } };
    mkdirSync(path.dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(proof, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ ...proof, output: path.relative(process.cwd(), OUTPUT) })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
