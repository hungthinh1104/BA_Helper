import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { GitRepositoryFetcher, ANALYZER_VERSION } from '@ba-helper/analyzer';
import { RunScanJobUseCase } from '@ba-helper/application';
import { impactGraphResponseSchema, qaCoverageResponseSchema } from '@ba-helper/contracts';
import { PrismaService } from '@ba-helper/backend-runtime';
import { ArtifactRepository } from '../../packages/backend-runtime/src/artifact/infrastructure/artifact.repository';
import { EvidenceRepository } from '../../packages/backend-runtime/src/evidence/infrastructure/evidence.repository';
import { GraphRepository } from '../../packages/backend-runtime/src/graph/infrastructure/graph.repository';
import { ScanJobRepository } from '../../packages/backend-runtime/src/scanner/infrastructure/scan-job.repository';
import { RunScanJobPersistenceStep } from '../../packages/backend-runtime/src/scanner/application/run-scan-job-persistence.step';
import { RuntimeScanJobRunnerAdapter } from '../../packages/backend-runtime/src/scanner/infrastructure/runtime-scan-job-runner.adapter';
import { EventLogService } from '../../packages/backend-runtime/src/event-log/application/event-log.service';
import { EventLogRepository } from '../../packages/backend-runtime/src/event-log/infrastructure/event-log.repository';
import type { QueueService } from '../../packages/backend-runtime/src/queue/queue.service';
import { ImpactGraphReadModelBuilder } from '../../apps/api/src/modules/impact-analysis/application/queries/impact-graph-read-model.builder';
import { GetImpactGraphUseCase } from '../../apps/api/src/modules/impact-analysis/application/queries/get-impact-graph.usecase';
import { GetQaCoverageUseCase } from '../../apps/api/src/modules/impact-analysis/application/qa/get-qa-coverage.usecase';
import { QaCoverageDeriver } from '../../apps/api/src/modules/impact-analysis/application/qa/qa-coverage.deriver';
import { QaTraceRepository } from '../../apps/api/src/modules/impact-analysis/infrastructure/qa-trace.repository';
import { GetTestTraceEvidenceUseCase } from '../../apps/api/src/modules/impact-analysis/application/qa/get-test-trace-evidence.usecase';
import { ReviewedReportContentBuilder } from '../../apps/api/src/modules/document/application/commands/reviewed-report-content.builder';
import { CreateReviewedReportSnapshotUseCase } from '../../apps/api/src/modules/document/application/commands/create-reviewed-report-snapshot.usecase';
import { InsightRepository, TraceabilityRepository, EvaluationContextAdapter, readReportTestTrace } from '@ba-helper/backend-runtime';
import { prepareIsolatedTestEnv } from '../../apps/api/test/e2e/helpers/prepare-test-env';
import { resetDatabase } from '../../apps/api/test/e2e/helpers/reset-db';

describe('NestJS scan → persisted dependencies → API graph', () => {
  let prisma: PrismaService;
  let jobs: ScanJobRepository;
  let scan: RunScanJobUseCase;
  const sha = 'a'.repeat(40);

  beforeAll(async () => {
    await prepareIsolatedTestEnv();
    prisma = new PrismaService();
    await prisma.$connect();
    jobs = new ScanJobRepository(prisma);
    const persistence = new RunScanJobPersistenceStep(prisma, new ArtifactRepository(prisma),
      new GraphRepository(prisma), new EvidenceRepository(prisma), jobs);
    scan = new RunScanJobUseCase(new RuntimeScanJobRunnerAdapter(jobs,
      new EventLogService(new EventLogRepository(prisma)),
      { enqueueSnapshotEmbedding: jest.fn().mockResolvedValue(undefined) } as unknown as QueueService,
      persistence));
    // Only source acquisition is replaced. Enumeration, adapter, parser and persistence are real.
    jest.spyOn(GitRepositoryFetcher, 'fetch').mockImplementation(async input => {
      await cp(resolve(__dirname, '../fixtures/nestjs-booking-with-payment'), input.targetDir, { recursive: true });
      return { commitSha: sha };
    });
  }, 120000);

  afterAll(async () => {
    jest.restoreAllMocks();
    if (prisma) await prisma.onModuleDestroy();
  });

  it('persists source-backed CALLS/TESTS, preserves history, and reuses the snapshot on retry', async () => {
    await resetDatabase(prisma);
    const project = await prisma.project.create({ data: { name: 'Graph pipeline proof' } });
    const repository = await prisma.repository.create({ data: {
      projectId: project.id, canonicalUrl: 'https://github.com/example/booking',
    } });
    const historical = await prisma.repositorySnapshot.create({ data: {
      repositoryId: repository.id, commitSha: sha, analyzerVersion: 'analyzer@0.3.0', coverageStatus: 'READY',
    } });
    const first = await jobs.createQueued({ repositoryId: repository.id, requestKey: 'graph-first', requestedRef: 'main' });
    await scan.execute({ jobId: first.id });
    const completed = await prisma.scanJob.findUniqueOrThrow({ where: { id: first.id } });
    expect(completed.status).toBe('COMPLETED');
    const snapshotId = completed.snapshotId!;
    const snapshot = await prisma.repositorySnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    expect(snapshot.analyzerVersion).toBe(ANALYZER_VERSION);
    expect(snapshotId).not.toBe(historical.id);

    const edges = await prisma.dependencyEdge.findMany({ where: { snapshotId },
      include: { fromArtifact: true, toArtifact: true } });
    const triples = edges.map(e => `${e.fromArtifact.name}|${e.type}|${e.toArtifact.name}`);
    expect(triples).toEqual(expect.arrayContaining([
      'BookingController.cancel|CALLS|BookingService.cancelBooking',
      'BookingService.cancelBooking|CALLS|PaymentService.refund',
      'BookingService.cancelBooking > sets status to CANCELLED|TESTS|BookingService.cancelBooking',
    ]));
    expect(edges).toHaveLength(7);
    const test = edges.find(edge => edge.type === 'TESTS')!.fromArtifact;
    expect(test.universalKind).toBe('TEST_CASE');
    expect(test.metadata).toMatchObject({ testCase: { framework: 'jest', modifier: 'NORMAL',
      suitePath: ['BookingService.cancelBooking'], title: 'sets status to CANCELLED' } });
    const file = await prisma.codeArtifact.findFirstOrThrow({ where: { snapshotId, artifactType: 'TEST' } });
    expect(file.universalKind).toBe('TEST_FILE');
    expect(test.metadata).toMatchObject({ testCase: { parentFileArtifactKey: file.artifactKey } });
    for (const edge of edges) {
      expect(edge.confidence).toBe(1);
      const metadata = edge.metadata as { evidenceProvenanceKey: string };
      const evidence = await prisma.evidence.findUniqueOrThrow({ where: { provenanceKey: metadata.evidenceProvenanceKey } });
      expect(evidence.snapshotId).toBe(snapshotId);
      expect(evidence.artifactId).toBe(edge.fromArtifactId);
      if (edge.type === 'TESTS') expect(evidence.sourceType).toBe('TEST');
    }

    const requirement = await prisma.requirement.create({ data: { projectId: project.id } });
    const revision = await prisma.requirementRevision.create({ data: { requirementId: requirement.id,
      title: 'Cancel paid booking', rawText: 'Allow cancellation and refund.',
      normalizedText: 'Allow cancellation and refund.', readinessStatus: 'READY_FOR_ANALYSIS' } });
    const analysis = await prisma.impactAnalysis.create({ data: { requirementRevisionId: revision.id,
      snapshotId, sourceTargetId: completed.sourceTargetId!, requestKey: 'graph-analysis',
      status: 'WAITING_FOR_REVIEW', stage: 'DONE' } });
    const service = edges.find(e => e.toArtifact.name === 'BookingService.cancelBooking')!.toArtifact;
    const link = await prisma.traceabilityLink.create({ data: { impactAnalysisId: analysis.id, artifactId: service.id,
      linkType: 'AFFECTED', linkBasis: 'EVIDENCED', reviewStatus: 'NEEDS_REVIEW' } });
    const serviceEvidence = await prisma.evidence.findFirstOrThrow({ where: { snapshotId, artifactId: service.id } });
    await prisma.traceabilityEvidence.create({ data: { traceabilityLinkId: link.id, evidenceId: serviceEvidence.id } });
    const graph = impactGraphResponseSchema.parse(await new GetImpactGraphUseCase(
      new ImpactGraphReadModelBuilder(prisma)).execute(analysis.id));
    const testEdge = graph.edges.find(e => e.type === 'TESTS')!;
    expect(testEdge.provenance).toMatchObject({ kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL' });
    expect(testEdge.displayDirectionReversed).toBe(true);
    expect(graph.nodes.find(n => n.id === testEdge.target)?.type).toBe('TEST');
    expect(graph.nodes.find(n => n.id === testEdge.target)?.testCase).toMatchObject({
      title: 'sets status to CANCELLED', modifier: 'NORMAL' });

    const refund = edges.find(e => e.toArtifact.name === 'PaymentService.refund')!.toArtifact;
    await prisma.traceabilityLink.create({ data: { impactAnalysisId: analysis.id, artifactId: refund.id,
      linkType: 'AFFECTED', linkBasis: 'INFERRED', reviewStatus: 'NEEDS_REVIEW' } });
    const qa = qaCoverageResponseSchema.parse(await new GetQaCoverageUseCase(
      new QaTraceRepository(prisma), new QaCoverageDeriver()).execute(analysis.id));
    expect(qa.traceContext).toMatchObject({ commitSha: sha, analyzerVersion: ANALYZER_VERSION,
      basis: 'STATIC_SOURCE_REFERENCE', limitations: ['SCANNER_LIMITATIONS'] });
    expect(qa.items.find(i => i.artifactId === service.id)?.status).toBe('COVERED');
    const refundTrace = qa.items.find(i => i.artifactId === refund.id)!;
    expect(refundTrace.status).toBe('INDIRECT_ONLY');
    expect(refundTrace.testArtifacts[0].trace?.edges.map(e => e.type)).toEqual(['TESTS', 'CALLS']);
    expect(refundTrace.testArtifacts[0].trace?.artifacts.map(a => a.id)).toEqual([test.id, service.id, refund.id]);

    const traceReader = new QaTraceRepository(prisma);
    const coverageUseCase = new GetQaCoverageUseCase(traceReader, new QaCoverageDeriver());
    const proofReader = new GetTestTraceEvidenceUseCase(coverageUseCase, traceReader);
    const testProofId = refundTrace.testArtifacts[0].trace!.edges[0].evidenceId;
    expect((await proofReader.execute(analysis.id, testProofId))?.evidence.excerpt).toContain('service.cancelBooking');
    // Seed the finalized lifecycle here; finalization policy is covered by its own tests.
    await prisma.impactAnalysis.update({ where: { id: analysis.id }, data: { status: 'COMPLETED' } });
    const capture = new CreateReviewedReportSnapshotUseCase(prisma, new EventLogService(new EventLogRepository(prisma)),
      new ReviewedReportContentBuilder(new TraceabilityRepository(prisma), new InsightRepository(prisma),
        new EvaluationContextAdapter(), coverageUseCase));
    const reviewed = await capture.execute({ analysisId: analysis.id });
    const stored = await prisma.reviewedReportSnapshot.findUniqueOrThrow({ where: { id: reviewed.id } });
    const saved = readReportTestTrace(stored.testTraceSnapshot, { analysisId: analysis.id, snapshotId,
      commitSha: sha, analyzerVersion: ANALYZER_VERSION });
    expect(saved?.coverage.items.find(i => i.artifactId === refund.id)?.testArtifacts[0].trace?.edges[0].evidenceId).toBe(testProofId);

    const second = await jobs.createQueued({ repositoryId: repository.id, requestKey: 'graph-rerun', requestedRef: 'main' });
    await scan.execute({ jobId: second.id });
    expect((await prisma.scanJob.findUniqueOrThrow({ where: { id: second.id } })).snapshotId).toBe(snapshotId);
    expect(await prisma.dependencyEdge.count({ where: { snapshotId } })).toBe(edges.length);
    expect(await prisma.dependencyEdge.count({ where: { snapshotId: historical.id } })).toBe(0);
  }, 120000);
});
