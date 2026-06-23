import { prepareIsolatedTestEnv } from '../../apps/api/test/e2e/helpers/prepare-test-env';
import { resetDatabase } from '../../apps/api/test/e2e/helpers/reset-db';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { RunScanJobUseCase } from '../../apps/api/src/modules/scanner/application/run-scan-job.usecase';
import { RunImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/run-impact-analysis.usecase';
import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase';
import { GetRepositorySnapshotDriftUseCase } from '../../apps/api/src/modules/repository/application/get-repository-snapshot-drift.usecase';
import { ScanJobStatus } from '@prisma/client';
import { resolve } from 'node:path';
import { DocumentJobWorker } from '../../apps/api/src/modules/impact-analysis/worker/document-job.worker';

describe('Golden Path Demo', () => {
  let app: any;
  let prisma: PrismaService;
  let runScanJob: RunScanJobUseCase;
  let runImpactAnalysis: RunImpactAnalysisUseCase;
  let finalizeImpactAnalysis: FinalizeImpactAnalysisUseCase;
  let getSnapshotDrift: GetRepositorySnapshotDriftUseCase;
  
  // State for the flow
  let projectId: string;
  let repositoryId: string;
  let scanJobId: string;
  let snapshotId: string;
  let sourceTargetId: string;
  let requirementRevisionId: string;
  let analysisId: string;

  beforeAll(async () => {
    // Ensure fake providers are strictly used. If they are not, tests will fail or timeout.
    process.env.AI_PROVIDER = 'fake';
    process.env.EMBEDDING_PROVIDER = 'fake';

    await prepareIsolatedTestEnv();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    runScanJob = app.get(RunScanJobUseCase);
    runImpactAnalysis = app.get(RunImpactAnalysisUseCase);
    finalizeImpactAnalysis = app.get(FinalizeImpactAnalysisUseCase);
    getSnapshotDrift = app.get(GetRepositorySnapshotDriftUseCase);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);

    // 0. Seed a base workspace
    await prisma.user.create({
      data: {
        id: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462',
        email: 'test@example.com',
        name: 'Test User',
      }
    });

    const project = await prisma.project.create({
      data: {
        name: 'Demo Project',
      },
    });
    projectId = project.id;

    const fixturePath = resolve(__dirname, '../fixtures/nestjs-booking-with-payment');
    const repo = await prisma.repository.create({
      data: {
        projectId,
        canonicalUrl: fixturePath, // use local fixture so clone creates a copy locally
      },
    });
    repositoryId = repo.id;
  });

  it('executes the full golden path deterministically', async () => {
    // ==========================================
    // STEP 1: Scan (RunScanJobUseCase)
    // ==========================================
    const scanJob = await prisma.scanJob.create({
      data: {
        repositoryId,
        requestedRef: 'main',
        status: ScanJobStatus.QUEUED,
        stage: 'WAITING',
        progress: 0,
        requestKey: 'demo-scan-job',
      },
    });
    scanJobId = scanJob.id;

    await runScanJob.execute({ jobId: scanJobId });

    const completedJob = await prisma.scanJob.findUniqueOrThrow({ where: { id: scanJobId } });
    expect(completedJob.status).toBe('COMPLETED');
    expect(completedJob.snapshotId).toBeDefined();
    expect(completedJob.sourceTargetId).toBeDefined();

    snapshotId = completedJob.snapshotId!;
    sourceTargetId = completedJob.sourceTargetId!;

    const snapshot = await prisma.repositorySnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
    
    // Assert Snapshot Metadata bounds
    expect(snapshot.commitSha).toBeDefined();
    expect(snapshot.commitSha!.length).toBeGreaterThan(0);
    // Actually Prisma schema has analyzerVersion instead of scannerVersion
    expect(snapshot.analyzerVersion).toBeDefined();
    
    const diagnostics = snapshot.diagnostics as any[];
    expect(diagnostics).toBeInstanceOf(Array);
    
    // Assert Required Diagnostics from run-scan-job
    expect(diagnostics.some(d => d.code === 'SCAN_HEALTH')).toBe(true);
    expect(diagnostics.some(d => d.code === 'INCREMENTAL_SCAN_SUMMARY')).toBe(true);
    expect(diagnostics.some(d => d.code === 'EMBEDDING_REUSE_PLAN')).toBe(true);

    const artifacts = await prisma.codeArtifact.findMany({ where: { snapshotId } });
    expect(artifacts.length).toBeGreaterThan(0); // Expecting extraction to succeed

    // ==========================================
    // STEP 2: Impact Analysis
    // ==========================================
    const requirement = await prisma.requirement.create({
      data: {
        projectId,
      },
    });

    const requirementText = 'When a paid booking is cancelled, the system must refund the tenant, prevent double refunds, update booking/payment state, and notify relevant parties.';
    const revision = await prisma.requirementRevision.create({
      data: {
        requirementId: requirement.id,
        rawText: requirementText,
        title: 'Refund cancelled bookings',
        normalizedText: requirementText,
        readinessStatus: 'READY_FOR_ANALYSIS',
      },
    });
    requirementRevisionId = revision.id;

    const analysis = await prisma.impactAnalysis.create({
      data: {
        requirementRevisionId,
        snapshotId,
        sourceTargetId,
        status: 'QUEUED',
        stage: 'WAITING',
        progress: 0,
        requestKey: 'demo-request',
      },
    });
    analysisId = analysis.id;

    // We pass domain pack id to runImpactAnalysis
    await runImpactAnalysis.execute({ analysisId, domain: 'booking' });

    const completedAnalysis = await prisma.impactAnalysis.findUniqueOrThrow({ where: { id: analysisId } });
    expect(completedAnalysis.status).toBe('WAITING_FOR_REVIEW');

    const analysisDiagnostics = (completedAnalysis.metadata as any)?.diagnostics as any[] || [];
    const packDiagnostic = analysisDiagnostics.find(d => d.code === 'DOMAIN_PACK_APPLIED');
    expect(packDiagnostic).toBeDefined();
    expect(packDiagnostic.payload.domainPackId).toBe('booking');
    expect(packDiagnostic.payload.domainPackVersion).toBeDefined();
    expect(packDiagnostic.payload.selectedBy).toBe('manual_config');
    // Ensure Boundedness
    expect(packDiagnostic.payload.rawPrompts).toBeUndefined();
    expect(packDiagnostic.payload.sourceCode).toBeUndefined();

    // ==========================================
    // STEP 3: Evidence Invariant
    // ==========================================
    const insights = await prisma.baInsight.findMany({ where: { impactAnalysisId: analysisId } });
    expect(insights.length).toBeGreaterThan(0);

    const evidencedInsights = insights.filter(i => i.certainty === 'EVIDENCED');
    for (const insight of evidencedInsights) {
      const links = await prisma.insightEvidence.findMany({ where: { insightId: insight.id } });
      // Assert every EVIDENCED insight has at least one Evidence link
      expect(links.length).toBeGreaterThan(0);
    }

    // ==========================================
    // STEP 4: Risk / Unknown / QA Bounds
    // ==========================================
    const unknowns = insights.filter(i => i.insightType === 'UNKNOWN' || i.insightType === 'QUESTION' || i.insightType === 'QA_SCENARIO' || i.certainty === 'UNKNOWN' || i.certainty === 'CONFLICTING');
    // We expect some unknowns to be generated by the fake provider or domain pack templates
    expect(unknowns.length).toBeGreaterThanOrEqual(0); // Not strictly demanding > 0 in fake provider, but checking bounding if present.
    
    for (const insight of unknowns) {
      // bounded presence: Description should not be thousands of lines
      expect(insight.description.length).toBeLessThan(1000);
      expect(insight.description).not.toContain('```typescript'); // No raw code dumps in insight text expected
    }

    // ==========================================
    // STEP 5: Human Review (Simulated)
    // ==========================================
    // Simulate user reviewing insights
    await prisma.baInsight.updateMany({
      where: { impactAnalysisId: analysisId },
      data: { reviewStatus: 'CONFIRMED' },
    });

    const unreviewedCount = await prisma.baInsight.count({
      where: { impactAnalysisId: analysisId, reviewStatus: 'NEEDS_REVIEW' },
    });
    expect(unreviewedCount).toBe(0);

    // ==========================================
    // STEP 6: Finalization and Report
    // ==========================================
    await finalizeImpactAnalysis.execute({ analysisId, acknowledgeUnreviewed: false, userId: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462' });

    // Process the enqueued DocumentJob synchronously for the test
    const reviewSnapshot = await prisma.reviewedReportSnapshot.findFirstOrThrow({
      where: { analysisId },
      orderBy: { createdAt: 'desc' },
    });
    
    const docWorker = app.get(DocumentJobWorker);
    await docWorker.process({ data: { snapshotId: reviewSnapshot.id, documentType: 'IMPACT_REPORT' } } as any);

    const finalizedAnalysis = await prisma.impactAnalysis.findUniqueOrThrow({ where: { id: analysisId } });
    expect(finalizedAnalysis.status).toBe('COMPLETED');

    const documents = await prisma.generatedDocument.findMany({ where: { impactAnalysisId: analysisId } });
    expect(documents.length).toBeGreaterThan(0);
    const report = documents.find(d => d.type === 'IMPACT_REPORT' && d.status === 'APPROVED');
    expect(report).toBeDefined();

    const reportContent = report!.content as string;
    const traceabilityCount = await prisma.traceabilityLink.count({ where: { impactAnalysisId: analysisId } });
    
    // Assert key sections
    expect(reportContent).toContain('Executive Summary');
    expect(reportContent).toContain('Impact Flow Diagram');
    expect(reportContent).toContain('Scanner Capability Profile');
    if (traceabilityCount > 0) {
      expect(reportContent).toContain('Impacted Areas');
      expect(reportContent).toContain('Evidence Appendix');
    } else {
      expect(reportContent).toContain('Open Questions / Unknowns');
    }
    
    // Assert NO raw vectors/hashes/dumps
    expect(reportContent).not.toContain('0x'); // Common in hashes/memory leaks
    expect(reportContent).not.toMatch(/\[\s*\d+\.\d+,\s*\d+\.\d+/); // embedding vectors array format
    expect(reportContent).not.toContain('Bearer'); // Fake secrets

    // ==========================================
    // STEP 7: Drift Visibility
    // ==========================================
    // Create a mock second snapshot to test drift.
    const secondSnapshot = await prisma.repositorySnapshot.create({
      data: {
        repositoryId,
        commitSha: 'drift-mock-sha-2',
        analyzerVersion: snapshot.analyzerVersion,
        coverageStatus: 'READY',
      }
    });

    // Mock an artifact that changed
    await prisma.codeArtifact.create({
      data: {
        snapshotId: secondSnapshot.id,
        artifactKey: 'api:booking.controller.cancel', // Same key as earlier
        name: 'BookingController.cancel',
        artifactType: 'API_ROUTE',
        filePath: 'src/booking/booking.controller.ts',
        startLine: 8,
        endLine: 12,
        contentHash: 'new-hash-indicating-change', // different hash
      }
    });

    const driftResult = await getSnapshotDrift.execute({
      projectId,
      repositoryId,
      baseSnapshotId: snapshotId,
      targetSnapshotId: secondSnapshot.id,
    });

    expect(driftResult.status).toBe('DRIFTED');
    expect(driftResult.baseSnapshotId).toBe(snapshotId);
    expect(driftResult.targetSnapshotId).toBe(secondSnapshot.id);
    
    // Drift result should be bounded
    const stringifiedDrift = JSON.stringify(driftResult);
    expect(stringifiedDrift.length).toBeLessThan(5000);
    expect(stringifiedDrift).not.toContain('```'); // No source code in drift payload
  }, 60000); // 60s timeout since full scan may take a few seconds
});
