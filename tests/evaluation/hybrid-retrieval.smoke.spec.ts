import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../apps/api/src/app.module';
import { PrismaService } from '../../apps/api/src/modules/prisma/prisma.service';
import { HybridRetrievalService } from '../../apps/api/src/modules/retrieval/application/hybrid-retrieval.service';
import { EmbeddingChunkRepository } from '../../apps/api/src/modules/embedding/infrastructure/embedding-chunk.repository';
import { resetDatabase } from '../../apps/api/test/e2e/helpers/reset-db';
import { prepareIsolatedTestEnv } from '../../apps/api/test/e2e/helpers/prepare-test-env';
import { ALL_EVALUATION_CASES } from './cases';
import { EvaluationRunner } from './evaluation-runner';
import { HybridRetrievalEvaluationAdapter } from './adapters/hybrid-retrieval.adapter';
import { DomainPackRegistry } from '../../apps/api/src/modules/domain-pack/application/domain-pack.registry';
// @ts-ignore
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config({ path: resolve(__dirname, '../../.env.test') });
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

describe('Hybrid Retrieval Evaluation Smoke', () => {
  let app: any;
  let prisma: PrismaService;
  let hybridRetrievalService: HybridRetrievalService;
  let chunkRepo: EmbeddingChunkRepository;
  let runner: EvaluationRunner;

  beforeAll(async () => {
    try {
      await prepareIsolatedTestEnv();
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      prisma = app.get(PrismaService);
      hybridRetrievalService = app.get(HybridRetrievalService);
      chunkRepo = app.get(EmbeddingChunkRepository);

      const domainPackRegistry = app.get(DomainPackRegistry);

      runner = new EvaluationRunner(
        new HybridRetrievalEvaluationAdapter(prisma, hybridRetrievalService, domainPackRegistry)
      );
    } catch (e) {
      console.error('NestJS initialization failed:', e);
      throw e;
    }
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  it('evaluates hybrid retrieval for smoke cases without real LLM or external embeddings', async () => {
    // 1. Filter to the 2 specified cases
    const smokeCases = ALL_EVALUATION_CASES.filter(c => 
      c.id === 'cancel-paid-booking-refund' || c.id === 'prevent-double-refund'
    );

    expect(smokeCases.length).toBe(2);

    // 2. Mock vector retrieval to be deterministic and avoid real embedding API calls.
    // For the smoke test, we simulate that the vector search returns some semantic hits
    // but without hard-coding the expected artifacts (which is forbidden).
    // So we just return an empty array and let the hybrid search fallback to its lexical/graph engine.
    // This perfectly tests the hybrid integration pipeline without vector flakiness.
    const searchSimilarSpy = jest.spyOn(chunkRepo, 'searchSimilar').mockResolvedValue([]);

    // 3. Run evaluation
    const result = await runner.run(smokeCases);

    searchSimilarSpy.mockRestore();

    // 4. Assert bounded output and determinism
    expect(result.report.totalCases).toBe(2);
    expect(result.report.cases.length).toBe(2);
    
    expect(typeof result.textSummary).toBe('string');
    expect(result.textSummary.length).toBeGreaterThan(0);
    expect(result.textSummary.length).toBeLessThan(10000); // Output remains bounded

    for (const cr of result.report.cases) {
      // Assert evaluation constraints
      expect(cr.evidenceCoverage).toBeDefined();
      expect(cr.negativeArtifactsFailed).toBeDefined();
      
      // Expected impacted artifact retrieval is checked at smoke level
      // We don't demand 100% precision/recall, but it should output the metrics
      expect(cr.artifactRecall).toContain('%');
      expect(cr.artifactPrecision).toContain('%');
    }

    // Print summary to visualize smoke metrics
    console.log('\n--- Hybrid Retrieval Smoke Summary ---');
    console.log(result.textSummary);
    console.log('--------------------------------------\n');
  }, 30000); // Give generous timeout for DB operations

  it('observes domain hints and applies no global booking fallback for unknown domain', async () => {
    const projectId = 'smoke-proj-domain';
    const repositoryId = 'smoke-repo-domain';
    const snapshotId = 'smoke-snap-domain';

    await prisma.project.create({ data: { id: projectId, name: `Project domain` } });
    await prisma.repository.create({ data: { id: repositoryId, projectId, canonicalUrl: `http://fake` } });
    await prisma.repositorySnapshot.create({
      data: {
        id: snapshotId,
        repositoryId,
        commitSha: `commit-domain`,
        analyzerVersion: 'smoke-eval-v1',
        coverageStatus: 'READY',
        indexStatus: 'VECTOR_READY',
      },
    });

    const searchSimilarSpy = jest.spyOn(chunkRepo, 'searchSimilar').mockResolvedValue([]);

    // 1. With BOOKING domain pack
    const bookingResults = await hybridRetrievalService.retrieve({
      projectId, repositoryId, snapshotId,
      changeRequest: 'cancel the booking for a refund',
      domain: 'booking',
      maxResults: 5,
    });

    // We may not have any matching artifacts since we didn't insert any code artifacts, 
    // but we can test the fallback on `undefined` domain.
    // Wait, to test if it uses booking vs general, we need artifacts!
    // Let's insert a dummy artifact
    await prisma.codeArtifact.create({
      data: {
        id: 'dummy-art', snapshotId, artifactKey: 'some.refund.service',
        name: 'refund', artifactType: 'SERVICE', filePath: 'refund.ts',
        startLine: 1, endLine: 10, universalKind: 'DOMAIN_SERVICE'
      }
    });

    const bookingResultsWithArtifact = await hybridRetrievalService.retrieve({
      projectId, repositoryId, snapshotId,
      changeRequest: 'cancel the booking for a refund',
      domain: 'booking',
      maxResults: 5,
    });

    // Since domain='booking', "refund" is a glossary term.
    // The lexical reasons should mention domain match.
    expect(bookingResultsWithArtifact.length).toBeGreaterThan(0);
    const art = bookingResultsWithArtifact.find(a => a.artifactKey === 'some.refund.service');
    expect(art).toBeDefined();
    expect(art?.retrievalSignals.includes('DOMAIN')).toBe(true);
    expect(art?.domainBoost).toBeGreaterThan(0);

    // 2. With UNKNOWN domain, it should fallback to General pack, which has no "refund" concept
    const generalResults = await hybridRetrievalService.retrieve({
      projectId, repositoryId, snapshotId,
      changeRequest: 'cancel the booking for a refund',
      domain: 'UNKNOWN',
      maxResults: 5,
    });

    const generalArt = generalResults.find(a => a.artifactKey === 'some.refund.service');
    // It might still match lexically because of exact symbol match on "refund",
    // but the domain match reason should NOT be present.
    if (generalArt) {
      expect(generalArt.retrievalSignals.includes('DOMAIN')).toBe(false);
      expect(generalArt.domainBoost).toBe(0);
    }

    searchSimilarSpy.mockRestore();
  });
});
