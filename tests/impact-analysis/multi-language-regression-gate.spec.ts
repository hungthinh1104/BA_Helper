import { prepareIsolatedTestEnv } from '../../apps/api/test/e2e/helpers/prepare-test-env';
import { resetDatabase } from '../../apps/api/test/e2e/helpers/reset-db';
import { Test, TestingModule } from '@nestjs/testing';
import { execSync } from 'node:child_process';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { RunScanJobUseCase } from '../../apps/api/src/modules/scanner/application/run-scan-job.usecase';
import { RunImpactAnalysisUseCase } from '@ba-helper/application';
import { FinalizeImpactAnalysisUseCase } from '../../apps/api/src/modules/impact-analysis/application/lifecycle/finalize-impact-analysis.usecase';
import { ScanJobStatus } from '@prisma/client';
import { resolve, join } from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { RunDocumentJobUseCase } from '../../apps/api/src/modules/document/application/jobs/run-document-job.usecase';

const safeRm = async (targetPath: string) => {
  await fs.rm(targetPath, { recursive: true, force: true }).catch(() => {});
};

describe('Multi-Language End-to-End Regression Gate', () => {
  let app: any;
  let prisma: PrismaService;
  let runScanJob: RunScanJobUseCase;
  let runImpactAnalysis: RunImpactAnalysisUseCase;
  let finalizeImpactAnalysis: FinalizeImpactAnalysisUseCase;
  let runDocumentJob: RunDocumentJobUseCase;
  
  let tempDirs: string[] = [];

  beforeAll(async () => {
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
    runDocumentJob = app.get(RunDocumentJobUseCase);
  });

  afterAll(async () => {
    for (const dir of tempDirs) {
      await safeRm(dir);
    }
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  const generateTempDir = async (files: Record<string, string>): Promise<string> => {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'ba-regression-'));
    tempDirs.push(tempDir);
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = join(tempDir, relativePath);
      await fs.mkdir(dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content);
    }
    
    // Initialize git repository so RunScanJobUseCase can clone it locally
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git branch -m main', { cwd: tempDir, stdio: 'ignore' });
    execSync('git add .', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@example.com"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });
    
    return tempDir;
  };

  const dirname = (filePath: string) => {
      const parts = filePath.split('/');
      parts.pop();
      return parts.join('/');
  };

  const getSupportedFixtures = async () => {
    const baseDir = resolve(__dirname, '../fixtures');
    
    // Create go+gin dynamic fixture
    const goGinDir = await generateTempDir({
      'main.go': `package main
import "github.com/gin-gonic/gin"
func main() {
  r := gin.Default()
  r.GET("/refunds", getRefunds)
  r.Run()
}
func getRefunds(c *gin.Context) { c.JSON(200, gin.H{"status": "ok"}) }`
    });

    return [
      { name: 'typescript + nestjs', path: join(baseDir, 'nestjs-booking-with-payment'), profile: { language: 'TYPESCRIPT', framework: 'NESTJS' } },
      { name: 'java + spring', path: join(baseDir, 'java-spring-basic'), profile: { language: 'JAVA', framework: 'SPRING_BOOT' } },
      { name: 'go + net-http', path: join(baseDir, 'go-http-basic'), profile: { language: 'GO', framework: 'NET_HTTP' } },
      { name: 'go + gin', path: goGinDir, profile: { language: 'GO', framework: 'GIN' } },
      { name: 'python + fastapi', path: join(baseDir, 'python-fastapi-basic'), profile: { language: 'PYTHON', framework: 'FASTAPI' } },
      { name: 'csharp + aspnetcore', path: join(baseDir, 'csharp-aspnetcore-basic'), profile: { language: 'CSHARP', framework: 'ASPNETCORE' } },
      { name: 'php + laravel', path: join(baseDir, 'php-laravel-basic'), profile: { language: 'PHP', framework: 'LARAVEL' } },
      { name: 'ruby + rails', path: join(baseDir, 'ruby-rails-basic'), profile: { language: 'RUBY', framework: 'RAILS' } },
    ];
  };

  const getUnsupportedPairs = async () => {
    return [
      {
        name: 'python + django',
        dir: await generateTempDir({
          'urls.py': `from django.urls import path\nfrom . import views\nurlpatterns = [path("refund/", views.refund)]`,
        })
      },
      {
        name: 'python + flask',
        dir: await generateTempDir({
          'app.py': `from flask import Flask\napp = Flask(__name__)\n@app.route("/refund")\ndef refund(): pass`,
        })
      },
      {
        name: 'php + symfony',
        dir: await generateTempDir({
          'composer.json': `{"require": {"symfony/framework-bundle": "*" }}`,
          'src/Controller/RefundController.php': `<?php namespace App\\Controller; use Symfony\\Component\\Routing\\Annotation\\Route; class RefundController { #[Route('/refund')] public function refund() {} }`,
        })
      },
      {
        name: 'csharp + unknown',
        dir: await generateTempDir({
          'project.csproj': `<Project Sdk="Microsoft.NET.Sdk"></Project>`,
          'Program.cs': `using System; class Program { static void Main() { Console.WriteLine("Hello"); } }`,
        })
      },
      {
        name: 'go + echo',
        dir: await generateTempDir({
          'main.go': `package main\nimport "github.com/labstack/echo/v4"\nfunc main() { e := echo.New(); e.GET("/refund", func(c echo.Context) error { return nil }) }`,
        })
      },
      {
        name: 'ruby + sinatra',
        dir: await generateTempDir({
          'Gemfile': `gem 'sinatra'`,
          'app.rb': `require 'sinatra'\nget '/refund' do\n  "refund"\nend`,
        })
      },
      {
        name: 'java + unknown',
        dir: await generateTempDir({
          'build.gradle': `plugins { id 'java' }`,
          'src/main/java/Main.java': `public class Main { public static void main(String[] args) {} }`,
        })
      },
      {
        name: 'javascript/unknown + nestjs markers without .ts source',
        dir: await generateTempDir({
          'package.json': `{"dependencies": {"@nestjs/common": "10.0.0"}}`,
          'main.js': `const { Controller } = require('@nestjs/common');`,
        })
      },
      {
        name: 'polyglot java spring + typescript nestjs',
        dir: await generateTempDir({
          'pom.xml': `<project><parent><groupId>org.springframework.boot</groupId></parent></project>`,
          'src/main/java/com/example/App.java': `package com.example; class App {}`,
          'package.json': `{"dependencies":{"@nestjs/common":"10.0.0","typescript":"5.0.0"}}`,
          'tsconfig.json': `{}`,
          'src/app.controller.ts': `import { Controller } from '@nestjs/common'; @Controller() class AppController {}`,
        })
      },
    ];
  };

  describe('Supported Pairs Determinism & Assertions', () => {
    let supportedFixtures: { name: string, path: string, profile: { language: string, framework: string } }[] = [];

    beforeAll(async () => {
      supportedFixtures = await getSupportedFixtures();
    });

    const runDeterministicGate = async (fixturePath: string) => {
      await resetDatabase(prisma);

      await prisma.user.create({
        data: {
          id: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462',
          email: 'test@example.com',
          name: 'Test User',
        }
      });

      const project = await prisma.project.create({ data: { name: 'Regression Gate' } });
      const repo = await prisma.repository.create({ data: { projectId: project.id, canonicalUrl: fixturePath } });

      const scanJob = await prisma.scanJob.create({
        data: {
          repositoryId: repo.id,
          requestedRef: 'main',
          status: ScanJobStatus.QUEUED,
          stage: 'WAITING',
          progress: 0,
          requestKey: 'test-scan',
        },
      });

      try {
        await runScanJob.execute({ jobId: scanJob.id });
      } catch (e: any) {
        console.error('runScanJob.execute failed:', e);
        const snapshot = await prisma.repositorySnapshot.findFirst({
          where: { repositoryId: repo.id },
          orderBy: { createdAt: 'desc' },
        });
        if (snapshot) console.error('Diagnostics:', snapshot.diagnostics);
        throw e;
      }

      const completedJob = await prisma.scanJob.findUniqueOrThrow({ where: { id: scanJob.id } });
      expect(completedJob.status).toBe('COMPLETED');
      const snapshotId = completedJob.snapshotId!;
      const sourceTargetId = completedJob.sourceTargetId!;

      const req = await prisma.requirement.create({ data: { projectId: project.id } });
      const revision = await prisma.requirementRevision.create({
        data: {
          requirementId: req.id,
          rawText: 'Refund cancelled bookings',
          title: 'Refund',
          normalizedText: 'Refund cancelled bookings',
          readinessStatus: 'READY_FOR_ANALYSIS',
        },
      });

      const analysis = await prisma.impactAnalysis.create({
        data: {
          requirementRevisionId: revision.id,
          snapshotId,
          sourceTargetId,
          status: 'QUEUED',
          stage: 'WAITING',
          progress: 0,
          requestKey: 'test-analysis',
        },
      });

      await runImpactAnalysis.execute({ analysisId: analysis.id, domain: 'booking' });

      await prisma.baInsight.updateMany({
        where: { impactAnalysisId: analysis.id },
        data: { reviewStatus: 'CONFIRMED' },
      });
      await prisma.traceabilityLink.updateMany({
        where: { impactAnalysisId: analysis.id },
        data: { reviewStatus: 'CONFIRMED' },
      });

      await finalizeImpactAnalysis.execute({ analysisId: analysis.id, acknowledgeUnreviewed: true, userId: 'b0e6a1e4-3993-47cb-b0bb-26477e8a9462' });

      // Process the enqueued DocumentJob synchronously for the test
      const reviewSnapshot = await prisma.reviewedReportSnapshot.findFirstOrThrow({
        where: { analysisId: analysis.id },
        orderBy: { createdAt: 'desc' },
      });
      
      const documentJob = await prisma.documentJob.findFirstOrThrow({
        where: { snapshotId: reviewSnapshot.id, documentType: 'IMPACT_REPORT' },
        orderBy: { createdAt: 'desc' },
      });
      await runDocumentJob.execute({ documentJobId: documentJob.id });

      const snapshot = await prisma.repositorySnapshot.findUniqueOrThrow({ where: { id: snapshotId } });
      const profile = await prisma.repositoryProfile.findUniqueOrThrow({ where: { snapshotId } });
      const artifacts = await prisma.codeArtifact.findMany({ where: { snapshotId } });
      const insights = await prisma.baInsight.findMany({ where: { impactAnalysisId: analysis.id } });
      const documents = await prisma.generatedDocument.findMany({ where: { impactAnalysisId: analysis.id } });

      return { snapshot, profile, artifacts, insights, documents };
    };

    const sectionBetween = (content: string, start: string, end: string): string => {
      const startIndex = content.indexOf(start);
      if (startIndex < 0) return '';
      const endIndex = content.indexOf(end, startIndex + start.length);
      return endIndex < 0 ? content.slice(startIndex) : content.slice(startIndex, endIndex);
    };

    const extractCanonicalOutput = (result: any) => {
      const artifactKeys = result.artifacts.map((a: any) => `${a.artifactKey}|${a.artifactType}`).sort();
      const diagnostics = (result.snapshot.diagnostics as any[])
        .filter(d => d.code !== 'SCAN_HEALTH' && d.code !== 'INCREMENTAL_SCAN_SUMMARY' && d.code !== 'EMBEDDING_REUSE_PLAN' && d.code !== 'DOMAIN_PACK_APPLIED')
        .map(d => `${d.code}|${(d.payload?.candidateTerms || []).sort().join(',')}`)
        .sort();
      const insights = result.insights
        .map((i: any) => `${i.insightType}|${i.title}|${(i.metadata as any)?.origin || 'AI'}`)
        .sort();
      return { artifactKeys, diagnostics, insights };
    };

    it('processes all supported pairs respecting evidence-first behavior', async () => {
      for (const pair of supportedFixtures) {
        const path = pair.path;
        const run1 = await runDeterministicGate(path);
        
        // Assertions for Supported Pair
        // 1. Adapter resolves explicitly and SCANNER_CAPABILITY_SUMMARY exists
        const diagnostics = run1.snapshot.diagnostics as any[];
        const capabilitySummary = diagnostics.find(d => d.code === 'SCANNER_CAPABILITY_SUMMARY');
        expect(capabilitySummary).toBeDefined();
        expect(capabilitySummary.payload).toMatchObject({
          language: expect.any(String),
          framework: expect.any(String),
          status: expect.any(String),
          confidence: expect.any(String),
        });
        expect(run1.profile).toMatchObject(pair.profile);

        // 2. Endpoint artifacts are evidence-backed and typed correctly
        for (const artifact of run1.artifacts) {
          if (artifact.artifactKey.includes('api:') || artifact.artifactType === 'API_ROUTE' || artifact.artifactType === 'HTTP_ENDPOINT') {
            expect(['API_ROUTE', 'HTTP_ENDPOINT']).toContain(artifact.artifactType);
          }
        }

        // 3. Diagnostic-derived risks have metadata.origin = SCANNER_DIAGNOSTIC and do not appear in Impacted Artifacts table
        const derivedRisks = run1.insights.filter(i => (i.metadata as any)?.origin === 'SCANNER_DIAGNOSTIC');
        for (const risk of derivedRisks) {
          expect(risk.certainty).not.toBe('EVIDENCED');
          expect((risk.metadata as any)?.evidenceMode).toBe('DIAGNOSTIC_ONLY');
          expect((risk.metadata as any)?.diagnosticPayload).toBeDefined();
        }
        expect(derivedRisks.some(i => i.title.includes('SCANNER_CAPABILITY_SUMMARY'))).toBe(false);
        const hasEndpoint = run1.artifacts.some(
          (a: any) => a.artifactType === 'HTTP_ENDPOINT' || a.artifactType === 'API_ROUTE'
        );
        expect(hasEndpoint).toBe(true);

        // 4. Report separates sections
        const report = run1.documents.find((d: any) => d.type === 'IMPACT_REPORT' && d.status === 'APPROVED');
        expect(report).toBeDefined();
        const reportContent = report!.content as string;
        expect(reportContent).toContain('Scanner Capability Profile');
        expect(reportContent).toContain('Open Questions / Unknowns');
        const impactedSection = sectionBetween(reportContent, '## Impacted Areas', '## Open Questions / Unknowns');
        for (const risk of derivedRisks) {
          expect(impactedSection).not.toContain(risk.title);
        }

        // Run second pass for determinism
        const run2 = await runDeterministicGate(path);

        const out1 = extractCanonicalOutput(run1);
        const out2 = extractCanonicalOutput(run2);

        expect(out2.artifactKeys).toEqual(out1.artifactKeys);
        expect(out2.diagnostics).toEqual(out1.diagnostics);
        expect(out2.insights).toEqual(out1.insights);
      }
    }, 180000); // 3 minutes timeout
  });

  describe('Unsupported Pairs Rejection', () => {
    let unsupportedPairs: { name: string, dir: string }[] = [];

    beforeAll(async () => {
      unsupportedPairs = await getUnsupportedPairs();
    });

    it('rejects all unsupported configurations', async () => {
      for (const { name, dir } of unsupportedPairs) {
        await resetDatabase(prisma);
        const project = await prisma.project.create({ data: { name: 'Unsupported Gate' } });
        const repo = await prisma.repository.create({ data: { projectId: project.id, canonicalUrl: dir } });

        const scanJob = await prisma.scanJob.create({
          data: {
            repositoryId: repo.id,
            requestedRef: 'main',
            status: ScanJobStatus.QUEUED,
            stage: 'WAITING',
            progress: 0,
            requestKey: 'test-scan-unsupported',
          },
        });

        // Run scan
        await expect(runScanJob.execute({ jobId: scanJob.id })).rejects.toThrow();

        // Verify it failed and didn't create fake snapshot
        const job = await prisma.scanJob.findUniqueOrThrow({ where: { id: scanJob.id } });
        expect(job.status).toBe('FAILED');
        expect(job.snapshotId).toBeNull();
        expect(job.errorCode).toBe('UNSUPPORTED_FRAMEWORK');

        const snapshot = await prisma.repositorySnapshot.findFirst({ where: { repositoryId: repo.id } });
        expect(snapshot).toBeNull();
      }
    });
  });
});
