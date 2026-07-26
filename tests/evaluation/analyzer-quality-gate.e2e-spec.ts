import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  RunImpactAnalysisUseCase,
  RunScanJobUseCase,
} from '@ba-helper/application';
import { PrismaService } from '@ba-helper/backend-runtime';
import { AppModule } from '../../apps/api/src/app.module';
import { prepareIsolatedTestEnv } from '../../apps/api/test/e2e/helpers/prepare-test-env';
import { resetDatabase } from '../../apps/api/test/e2e/helpers/reset-db';
import { ProductionPathEvaluationAdapter } from './adapters/production-path.adapter';
import { productionStableEvaluationCases } from './cases/stable-production';
import {
  runStableQualityGate,
  type QualityBaseline,
  type QualityScorecard,
} from './stable-quality-gate';

const baseline = JSON.parse(
  readFileSync(path.join(process.cwd(), 'tests/evaluation/quality-baseline.json'), 'utf8'),
) as QualityBaseline;

function writeScorecard(scorecard: QualityScorecard): void {
  const outDir = path.join(process.cwd(), 'artifacts/evaluation');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    path.join(outDir, 'analyzer-scorecard.json'),
    `${JSON.stringify(scorecard, null, 2)}\n`,
  );
}

describe('Production-path analyzer quality gate', () => {
  let app: any;
  let prisma: PrismaService;
  let adapter: ProductionPathEvaluationAdapter;

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
    adapter = new ProductionPathEvaluationAdapter(
      prisma,
      app.get(RunScanJobUseCase),
      app.get(RunImpactAnalysisUseCase),
    );
  }, 180000);

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (app) await app.close();
  });

  it('enforces recall, precision, evidence, negative-control, and orphan floors on the real pipeline', async () => {
    await resetDatabase(prisma);

    const scorecard = await runStableQualityGate({
      adapter,
      cases: productionStableEvaluationCases,
      baseline,
      generatedAt: '2026-01-01T00:00:00.000Z',
    });

    // Always emit the scorecard artifact, even on failure, so CI can upload it.
    writeScorecard(scorecard);

    // Surface per-case detail for calibration / debugging.

    console.warn('ANALYZER_METRICS=' + JSON.stringify(scorecard.metrics));
    for (const c of scorecard.cases) {
      console.warn(
        `ANALYZER_CASE[${c.caseId}] critR=${c.criticalArtifactRecall.toFixed(2)} ovR=${c.overallArtifactRecall.toFixed(2)} prec=${c.artifactPrecision.toFixed(2)} negOk=${c.negativeControlPassed} orphan=${c.orphanEvidencedArtifactKeys.length}` +
          (c.failures.length ? ` FAIL=${JSON.stringify(c.failures)}` : ''),
      );
    }
    if (scorecard.failures.length) {
      console.warn('ANALYZER_FAILURES=' + JSON.stringify(scorecard.failures, null, 2));
    }

    expect(scorecard.status).toBe('PASS');
  }, 300000);
});
