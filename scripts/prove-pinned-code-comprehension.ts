import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { config } from 'dotenv';
import { DiagnosticCollector } from '../packages/analyzer/src/index';
import {
  ArtifactRepository, EvidenceRepository, GraphRepository, PrismaService,
  RunScanJobPersistenceStep, ScanJobRepository,
} from '../packages/backend-runtime/src/index';
import { PasswordHashService } from '../apps/api/src/modules/auth/application/password-hash.service';
import { installQueryMeter } from './pinned-comprehension-query-meter';
import { isIsolatedPinnedTestDatabaseUrl } from './pinned-proof-environment';
import { summarizePinnedScanDiagnostics } from './pinned-proof-diagnostics';
import { scanPinnedRepository } from './pinned-proof-scan';
import { measurePinnedProjections } from './pinned-proof-projections';

const PINNED_COMMIT = 'b49ae92a6c0b0db39b6542338a2ffea3eda15717';
const CORPUS_URL = 'https://github.com/leosuncin/nest-api-example';
const OUTPUT = path.resolve('artifacts/evaluation/pinned-code-comprehension-proof.json');

function requirePinnedInputs(): string {
  config({ path: '.env.test', quiet: true });
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!isIsolatedPinnedTestDatabaseUrl(databaseUrl)) {
    throw new Error('The pinned proof requires DATABASE_URL_TEST to use local loopback and the ba_helper_test database.');
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

async function getDemoUser(prisma: PrismaService) {
  let user = await prisma.user.findUnique({ where: { email: 'demo@ba-helper.local' } });
  if (!user) {
    const passwordHash = await new PasswordHashService().hashPassword('demo-password-2026');
    user = await prisma.user.create({ data: { email: 'demo@ba-helper.local', name: 'Demo Analyst',
      passwordHash, role: 'ADMIN' } });
  }
  return user;
}

async function persistPinnedScan(prisma: PrismaService, userId: string,
  scanResult: Awaited<ReturnType<typeof scanPinnedRepository>>['scanResult'],
  fileDiagnostics: Awaited<ReturnType<typeof scanPinnedRepository>>['fileDiagnostics']) {
  const collector = new DiagnosticCollector();
  for (const diagnostic of scanResult.diagnostics ?? []) collector.add(diagnostic);
  for (const diagnostic of fileDiagnostics) collector.addFromFileDiagnostic(diagnostic, diagnostic.filePath);
  const project = await prisma.project.create({ data: { name: `Pinned NestJS proof ${randomUUID()}` } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId, role: 'OWNER' } });
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
  return { project, repository, persisted, repositories: { artifacts, graph, evidence } };
}

async function main(): Promise<void> {
  const root = requirePinnedInputs();
  const toolCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const toolWorkingTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim());
  const prisma = new PrismaService();
  const measureQueries = installQueryMeter(prisma);
  try {
    await prisma.$connect();
    const user = await getDemoUser(prisma);
    const scan = await scanPinnedRepository(root, PINNED_COMMIT);
    const saved = await persistPinnedScan(prisma, user.id, scan.scanResult, scan.fileDiagnostics);
    const projection = await measurePinnedProjections({ prisma, root, snapshotId: saved.persisted.snapshotId,
      measureQueries, repositories: saved.repositories });
    const diagnosticSummary = summarizePinnedScanDiagnostics(scan.scanResult.diagnostics ?? [], scan.fileDiagnostics);
    const proof = {
      toolCommitSha, toolWorkingTreeDirty, corpusUrl: CORPUS_URL, commitSha: PINNED_COMMIT,
      analyzerVersion: scan.scanResult.analyzerVersion,
      diagnosticCounts: diagnosticSummary.codeCounts, diagnosticReasonCounts: diagnosticSummary.reasonCounts,
      diagnosticExamples: diagnosticSummary.examples,
      fileDiagnosticExamples: diagnosticSummary.fileDiagnosticExamples,
      scannedFiles: scan.scanResult.scannedFileCount,
      scanMs: scan.scanMs, graphMs: scan.graphMs, scanPerformance: scan.scanPerformance,
      repositoryId: saved.repository.id, projectId: saved.project.id, projectName: saved.project.name,
      snapshotId: saved.persisted.snapshotId,
      methodId: projection.methodIds.direct, multiMethodId: projection.methodIds.multi,
      mockMethodId: projection.methodIds.mock,
      persisted: { artifacts: saved.persisted.artifactCount, edges: saved.persisted.dependencyEdgeCount,
        evidence: saved.persisted.evidenceCount, droppedEdges: saved.persisted.skippedDependencyEdgeCount },
      direct: { scenarios: projection.direct.relatedScenarios.length,
        staticCalls: projection.direct.codeEvidence.staticCalls.length,
        dependencies: projection.direct.codeEvidence.dependencies.length,
        limitations: projection.direct.limitations.map(item => item.code) },
      multiScenarios: projection.multi.relatedScenarios.length,
      mockClaims: projection.mock.relatedScenarios.flatMap(scenario => scenario.mockedBoundaries).length,
      provenanceVerification: projection.provenanceVerification,
      shapeCounts: projection.shapeCounts, indirectMethodId: projection.methodIds.indirect,
      noTestMethodId: projection.methodIds.noTest,
      apiVerification: { status: 'NOT_RUN' }, browserVerification: { status: 'NOT_RUN' },
      performance: projection.performance,
      environment: { cpu: cpus()[0]?.model ?? 'unknown', logicalCores: cpus().length,
        totalMemoryBytes: totalmem(), platform: process.platform, node: process.version },
    };
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
