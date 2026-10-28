import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { config } from 'dotenv';
import { DiagnosticCollector } from '../packages/analyzer/src/index';
import {
  ArtifactRepository, EvidenceRepository, GraphRepository, PrismaService,
  RunScanJobPersistenceStep, ScanJobRepository,
} from '../packages/backend-runtime/src/index';
import { PasswordHashService } from '../apps/api/src/modules/auth/application/password-hash.service';
import { GetCodeComprehensionUseCase } from '../apps/api/src/modules/artifact/application/get-code-comprehension.usecase';
import { installQueryMeter } from './pinned-comprehension-query-meter';
import { isIsolatedPinnedTestDatabaseUrl } from './pinned-proof-environment';
import { verifyPersistedPinnedProjections } from './verify-pinned-comprehension-provenance';
import { scanPinnedRepository } from './pinned-proof-scan';
import { CORPUS_SHA, CORPUS_URL, OUTPUT, sourceIdentities, summarizeValues, taskTestEvidence,
  verifyCorpus, type StudyTask } from './g2a-study-corpus-support';

async function getDemoUser(prisma: PrismaService) {
  let user = await prisma.user.findUnique({ where: { email: 'demo@ba-helper.local' } });
  if (!user) user = await prisma.user.create({ data: { email: 'demo@ba-helper.local', name: 'G2A Proof Runner',
    passwordHash: await new PasswordHashService().hashPassword('g2a-local-proof-only'), role: 'ADMIN' } });
  return user;
}

async function persistScan(prisma: PrismaService, userId: string,
  scanResult: Awaited<ReturnType<typeof scanPinnedRepository>>['scanResult'],
  fileDiagnostics: Awaited<ReturnType<typeof scanPinnedRepository>>['fileDiagnostics']) {
  const project = await prisma.project.create({ data: { name: `G2A mutoe proof ${randomUUID()}` } });
  await prisma.projectMember.create({ data: { projectId: project.id, userId, role: 'OWNER' } });
  const repository = await prisma.repository.create({ data: { projectId: project.id, canonicalUrl: CORPUS_URL } });
  const job = await prisma.scanJob.create({ data: { repositoryId: repository.id, requestKey: randomUUID(),
    requestedRef: CORPUS_SHA, status: 'RUNNING', stage: 'GENERATING_SUMMARIES', progress: 90 } });
  const artifacts = new ArtifactRepository(prisma);
  const graph = new GraphRepository(prisma);
  const evidence = new EvidenceRepository(prisma);
  const collector = new DiagnosticCollector();
  for (const diagnostic of scanResult.diagnostics ?? []) collector.add(diagnostic);
  for (const diagnostic of fileDiagnostics) collector.addFromFileDiagnostic(diagnostic, diagnostic.filePath);
  const persistence = new RunScanJobPersistenceStep(prisma, artifacts, graph, evidence, new ScanJobRepository(prisma));
  const started = performance.now();
  const persisted = await persistence.persist({ job, commitSha: CORPUS_SHA, scanResult, repositoryProfile: null, collector });
  return { project, repository, persisted, persistenceMs: performance.now() - started,
    repositories: { artifacts, graph, evidence } };
}

async function main(): Promise<void> {
  config({ path: '.env.test', quiet: true });
  const databaseUrl = process.env.DATABASE_URL_TEST;
  if (!isIsolatedPinnedTestDatabaseUrl(databaseUrl)) {
    throw new Error('G2A persistence proof requires DATABASE_URL_TEST on loopback with database ba_helper_test.');
  }
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  const root = path.resolve(process.env.G2A_CORPUS_PATH ?? 'tmp/corpora/mutoe-nestjs-realworld-g2a');
  const dataset = JSON.parse(readFileSync('tests/evaluation/developer-comprehension/dataset.template.json', 'utf8')) as {
    studyStatus: string; groundTruthReviewStatus: string; observations: unknown[]; tasks: StudyTask[];
  };
  const corpus = verifyCorpus(root, dataset.tasks);
  const sourceMethodIdentities = sourceIdentities(root, dataset.tasks);
  if (sourceMethodIdentities.some(item => !item.sourceMethodFound)) throw new Error('A task target is absent from pinned source.');
  const toolCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const dirtyPaths = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' })
    .trim().split(/\r?\n/).filter(Boolean);
  const prisma = new PrismaService();
  const measureQueries = installQueryMeter(prisma);
  try {
    await prisma.$connect();
    const scan = await scanPinnedRepository(root, CORPUS_SHA);
    const sourceByTask = new Map(sourceMethodIdentities.map(item => [item.taskId, item]));
    const scanTargets = dataset.tasks.map(task => {
      const artifact = scan.scanResult.artifacts.find(item => item.filePath === task.target.filePath &&
        item.symbolName === task.target.symbol);
      if (!artifact) throw new Error(`Production target was not extracted: ${task.target.symbol}`);
      const testEvidence = taskTestEvidence(scan.scanResult, task);
      if (testEvidence.missingSelectedTitles.length) throw new Error(`Selected Jest declarations were not extracted: ${task.taskId}`);
      const directEdges = scan.graph.edges.filter(edge => edge.type === 'TESTS' && edge.to === artifact.stableId);
      const selectedTestKeys = new Set(testEvidence.selectedDeclarations.map(item => item.artifactKey));
      return { taskId: task.taskId, target: task.target, artifact, testEvidence,
        directTargetTestEdgeCount: directEdges.filter(edge => selectedTestKeys.has(edge.from)).length,
        directTargetTestTitles: directEdges.filter(edge => selectedTestKeys.has(edge.from)).map(edge =>
          scan.scanResult.artifacts.find(item => item.stableId === edge.from)?.testCase?.title ?? 'unknown'),
        sourceIdentity: sourceByTask.get(task.taskId) };
    });

    const user = await getDemoUser(prisma);
    const saved = await persistScan(prisma, user.id, scan.scanResult, scan.fileDiagnostics);
    const snapshot = await prisma.repositorySnapshot.findUnique({ where: { id: saved.persisted.snapshotId },
      select: { id: true, repositoryId: true, commitSha: true, analyzerVersion: true, coverageStatus: true } });
    if (!snapshot || snapshot.repositoryId !== saved.repository.id || snapshot.commitSha !== CORPUS_SHA ||
      snapshot.analyzerVersion !== scan.scanResult.analyzerVersion) throw new Error('Persisted snapshot identity is invalid.');
    const [persistedArtifacts, persistedEdges, persistedEvidence] = await Promise.all([
      prisma.codeArtifact.findMany({ where: { snapshotId: snapshot.id }, select: { id: true, artifactKey: true,
        artifactType: true, name: true, filePath: true, startLine: true, endLine: true } }),
      prisma.dependencyEdge.findMany({ where: { snapshotId: snapshot.id }, select: { id: true, fromArtifactId: true,
        toArtifactId: true, type: true, metadata: true } }),
      prisma.evidence.findMany({ where: { snapshotId: snapshot.id }, select: { id: true, snapshotId: true, artifactId: true,
        sourcePath: true, startLine: true, endLine: true, isRedacted: true } }),
    ]);
    const persistedTargetByTask = new Map(scanTargets.map(task => {
      const artifact = persistedArtifacts.find(item => item.artifactKey === task.artifact.stableId &&
        item.filePath === task.target.filePath);
      if (!artifact || !['SERVICE_METHOD', 'API_ROUTE'].includes(artifact.artifactType)) {
        throw new Error(`Persisted production target is unavailable: ${task.taskId}`);
      }
      return [task.taskId, artifact] as const;
    }));
    const artifactIds = new Set(persistedArtifacts.map(item => item.id));
    const provenanceMismatches = persistedEvidence.filter(item => item.snapshotId !== snapshot.id || !item.artifactId ||
      !artifactIds.has(item.artifactId) || !item.sourcePath || !persistedArtifacts.some(artifact =>
        artifact.id === item.artifactId && artifact.filePath === item.sourcePath) || item.startLine === null ||
      item.endLine === null || item.endLine < item.startLine).length;
    if (provenanceMismatches !== 0 || !persistedEdges.every(edge =>
      artifactIds.has(edge.fromArtifactId) && artifactIds.has(edge.toArtifactId))) {
      throw new Error('Persisted evidence provenance or graph endpoints failed integrity checks.');
    }

    const projections: Array<Record<string, unknown>> = [];
    const tasks = [];
    const missSamples: number[] = [];
    const missQueryCounts: number[] = [];
    const missRows: number[] = [];
    const hitSamples: number[] = [];
    const hitQueryCounts: number[] = [];
    const hitRows: number[] = [];
    const responseBytes: number[] = [];
    for (const task of scanTargets) {
      const persisted = persistedTargetByTask.get(task.taskId)!;
      let projection: Awaited<ReturnType<GetCodeComprehensionUseCase['execute']>> | undefined;
      for (let index = 0; index < 5; index += 1) {
        const missReader = new GetCodeComprehensionUseCase(prisma, saved.repositories.artifacts,
          saved.repositories.graph, saved.repositories.evidence);
        const started = performance.now();
        const measured = await measureQueries(() => missReader.execute(snapshot.id, persisted.id));
        missSamples.push(performance.now() - started);
        missQueryCounts.push(measured.stats.queryCount);
        missRows.push(measured.stats.returnedRows);
        const sample = measured.result;
        projection = sample;
        if (sample.snapshotContext.commitSha !== CORPUS_SHA || sample.selectedCode.artifactKey !== task.artifact.stableId ||
          sample.selectedCode.filePath !== task.target.filePath || sample.codeEvidence.source.filePath !== task.target.filePath ||
          sample.codeEvidence.source.startLine === null || sample.codeEvidence.source.endLine === null ||
          sample.snapshotContext.runtimeObservations !== 'NOT_IMPORTED') {
          throw new Error(`Comprehension projection identity or source provenance mismatch: ${task.taskId}`);
        }
        responseBytes.push(Buffer.byteLength(JSON.stringify(sample), 'utf8'));
      }
      if (!projection) throw new Error('No comprehension response was measured.');
      projections.push(projection as unknown as Record<string, unknown>);
      const hitReader = new GetCodeComprehensionUseCase(prisma, saved.repositories.artifacts,
        saved.repositories.graph, saved.repositories.evidence);
      const cachedProjection = await hitReader.execute(snapshot.id, persisted.id);
      for (let index = 0; index < 5; index += 1) {
        const started = performance.now();
        const measured = await measureQueries(() => hitReader.execute(snapshot.id, persisted.id));
        hitSamples.push(performance.now() - started);
        hitQueryCounts.push(measured.stats.queryCount);
        hitRows.push(measured.stats.returnedRows);
        if (measured.result !== cachedProjection) throw new Error('Projection cache hit did not reuse the cached response.');
      }
      const scenarios = projection.relatedScenarios;
      const relatedTestEdges = scenarios.flatMap(scenario => scenario.trace?.relationships ?? [])
        .filter(edge => edge.type === 'TESTS' && edge.targetArtifactId === persisted.id);
      tasks.push({ taskId: task.taskId, taskFamily: dataset.tasks.find(item => item.taskId === task.taskId)?.taskFamily,
        target: task.target, scanArtifactKey: task.artifact.stableId, productionArtifactPersisted: true,
        persistedArtifactId: persisted.id,
        sourceDefinitionLines: [task.sourceIdentity?.methodStartLine, task.sourceIdentity?.methodEndLine],
        sourceEvidence: { path: projection.codeEvidence.source.filePath,
          lines: [projection.codeEvidence.source.startLine, projection.codeEvidence.source.endLine],
          persisted: Boolean(projection.codeEvidence.source.id), commitSha: projection.codeEvidence.source.commitSha },
        testDeclarations: task.testEvidence, scannerDirectTargetTestEdgeCount: task.directTargetTestEdgeCount,
        projectedRelatedScenarioCount: scenarios.length,
        projectedDirectTestRelationshipCount: relatedTestEdges.length,
        projectedScenarioTitles: scenarios.map(scenario => scenario.testCase?.title ?? scenario.testArtifact.name),
        claimCounts: scenarios.reduce((sum, scenario) => ({ assertion: sum.assertion + scenario.assertions.length,
          invocation: sum.invocation + scenario.invocations.length, mock: sum.mock + scenario.mockedBoundaries.length,
          unresolved: sum.unresolved + scenario.unresolved.length }),
        { assertion: 0, invocation: 0, mock: 0, unresolved: 0 }),
        limitations: projection.limitations.map(item => item.code),
        runtimeEvidence: projection.snapshotContext.runtimeObservations, evidenceParityReady: true });
    }
    const provenance = await verifyPersistedPinnedProjections(prisma, root, snapshot.id, CORPUS_SHA,
      projections as never[]);
    const diagnosticCounts = (scan.scanResult.diagnostics ?? []).reduce<Record<string, number>>((counts, item) => {
      counts[item.code] = (counts[item.code] ?? 0) + (item.count ?? 1); return counts;
    }, {});
    const proof = {
      schemaVersion: 'g2a-study-corpus-readiness@1', generatedAt: new Date().toISOString(),
      tool: { commitSha: toolCommitSha, workingTree: dirtyPaths.length ? 'DIRTY' : 'CLEAN', dirtyPaths,
        analyzerVersion: scan.scanResult.analyzerVersion, scannerVersion: 'scanner@0.7.0' },
      corpus: { url: CORPUS_URL, commitSha: corpus.head, treeSha: corpus.treeSha, checkoutClean: corpus.clean,
        sourceFilesVerified: corpus.files, licenseId: corpus.licenseId, jestVersion: corpus.jestVersion,
        nestVersion: corpus.nestVersion, typescriptFileCount: scan.scanResult.scannedFileCount,
        submoduleCount: corpus.submoduleCount, externalDependenciesInstalled: false, externalCodeExecuted: false },
      study: { status: dataset.studyStatus, groundTruthReviewStatus: dataset.groundTruthReviewStatus,
        observationCount: dataset.observations.length, candidateAnnotationsUsedByRunner: false },
      scanner: { adapterId: 'typescript-nestjs', coverage: scan.scanResult.coverage,
        artifactCount: scan.scanResult.artifacts.length, graphEdgeCount: scan.graph.edges.length,
        diagnosticCounts, outputDigest: scan.scanPerformance.outputDigest,
        repeatability: scan.scanPerformance.outputDigestsAcrossRuns, performance: scan.scanPerformance },
      sourceMethodIdentities, tasks,
      persistence: { status: 'COMPLETED', projectId: saved.project.id, projectName: saved.project.name,
        repositoryId: saved.repository.id, snapshotId: snapshot.id,
        sourceTargetId: saved.persisted.sourceTargetId, commitSha: snapshot.commitSha, analyzerVersion: snapshot.analyzerVersion,
        coverageStatus: snapshot.coverageStatus, artifactCount: persistedArtifacts.length, edgeCount: persistedEdges.length,
        evidenceCount: persistedEvidence.length, droppedEdgeCount: saved.persisted.skippedDependencyEdgeCount,
        provenanceMismatches, allEdgeEndpointsPersisted: persistedEdges.every(edge =>
          artifactIds.has(edge.fromArtifactId) && artifactIds.has(edge.toArtifactId)), durationMs: saved.persistenceMs,
        projectionProvenanceValidation: provenance },
      performance: {
        condition: 'Warm shared process and database after pinned scan persistence; no new repository scan during projections.',
        cacheMissProjection: { samples: summarizeValues(missSamples), queryCountP50: summarizeValues(missQueryCounts).p50,
          returnedRowsP50: summarizeValues(missRows).p50, responseBytesP50: summarizeValues(responseBytes).p50,
          targetSamples: 5, targetCount: tasks.length },
        cacheHitProjection: { samples: summarizeValues(hitSamples), queryCountP50: summarizeValues(hitQueryCounts).p50,
          returnedRowsP50: summarizeValues(hitRows).p50, targetSamples: 5, targetCount: tasks.length },
        freshProcessProjection: { status: 'NOT_RUN', reason: 'The runner reuses one Node process; separate process timing is not inferred.' },
        browserInitialReadiness: { status: 'NOT_RUN', reason: 'This proof verifies the application use case; it does not launch a browser.' },
        scenarioNavigation: { status: 'NOT_RUN', reason: 'Candidate-specific browser navigation was not measured.' },
        evidenceInspection: { status: 'NOT_RUN', reason: 'Candidate-specific browser interaction was not measured.' },
        visualGraphReadiness: { status: 'NOT_RUN', reason: 'Candidate-specific browser graph timing was not measured.' },
        environment: { platform: process.platform, node: process.version, cpu: os.cpus()[0]?.model ?? 'unknown',
          logicalCores: os.cpus().length, totalMemoryBytes: os.totalmem() },
      },
      api: { boundary: 'GetCodeComprehensionUseCase', selectedMethodProjections: 'PASS', httpAuthorization: 'NOT_RUN' },
      ui: { conditions: ['EXISTING_WORKFLOW', 'TEXTUAL_EVIDENCE', 'VISUAL_TEST_TRACE'],
        candidateBrowserSamples: 0, parityEvidence: 'Existing condition-parity tests; candidate Explorer route was not opened by this proof.' },
      decision: 'ENGINEERING_PROOF_PASS_STUDY_NOT_STARTED',
      limitations: ['Candidate labels remain pending independent review.', 'No participant observations exist.',
        'Static test declarations do not establish that Jest ran or passed.', 'HTTP authorization and candidate browser timings were not measured.'],
      verificationCommands: ['pnpm prove:g2a-study-corpus'],
    };
    mkdirSync(path.dirname(OUTPUT), { recursive: true });
    writeFileSync(OUTPUT, `${JSON.stringify(proof, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({ output: path.relative(process.cwd(), OUTPUT), decision: proof.decision,
      corpusSha: corpus.head, license: corpus.licenseId, scanFiles: scan.scanResult.scannedFileCount,
      artifacts: scan.scanResult.artifacts.length, edges: scan.graph.edges.length,
      persisted: { snapshotId: snapshot.id, artifactCount: persistedArtifacts.length, edgeCount: persistedEdges.length,
        evidenceCount: persistedEvidence.length, provenanceMismatches },
      api: { boundary: 'GetCodeComprehensionUseCase', projectedTasks: tasks.length, provenance },
      performance: { cacheMiss: summarizeValues(missSamples), cacheHit: summarizeValues(hitSamples) },
      tasks: tasks.map(task => ({ taskId: task.taskId, scenarios: task.projectedRelatedScenarioCount,
        directTestEdges: task.projectedDirectTestRelationshipCount, runtime: task.runtimeEvidence })) })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
