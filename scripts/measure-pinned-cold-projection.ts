import { performance } from 'node:perf_hooks';
import { ArtifactRepository, EvidenceRepository, GraphRepository, PrismaService } from
  '../packages/backend-runtime/src/index';
import { GetCodeComprehensionUseCase } from '../apps/api/src/modules/artifact/application/get-code-comprehension.usecase';
import { installQueryMeter } from './pinned-comprehension-query-meter';
import { isIsolatedPinnedTestDatabaseUrl } from './pinned-proof-environment';

async function main(): Promise<void> {
  const [snapshotId, methodId, commitSha] = process.argv.slice(2);
  const databaseUrl = process.env.DATABASE_URL;
  if (!snapshotId || !methodId || !commitSha || !isIsolatedPinnedTestDatabaseUrl(databaseUrl) ||
    process.env.NODE_ENV !== 'test') {
    throw new Error('Cold projection requires a pinned snapshot and the isolated test database.');
  }
  const prisma = new PrismaService();
  const measureQueries = installQueryMeter(prisma);
  try {
    await prisma.$connect();
    const reader = new GetCodeComprehensionUseCase(prisma,
      new ArtifactRepository(prisma), new GraphRepository(prisma), new EvidenceRepository(prisma));
    const memoryBefore = process.memoryUsage();
    const started = performance.now();
    const { result, stats } = await measureQueries(() => reader.execute(snapshotId, methodId));
    const elapsedMs = performance.now() - started;
    if (result.snapshotContext.commitSha !== commitSha || stats.nonPromiseQueries !== 0) {
      throw new Error('Cold projection provenance or query instrumentation could not be validated.');
    }
    const memoryAfter = process.memoryUsage();
    process.stdout.write(`${JSON.stringify({ elapsedMs, database: stats,
      responseBytes: Buffer.byteLength(JSON.stringify(result), 'utf8'),
      memoryBefore: { rss: memoryBefore.rss, heapUsed: memoryBefore.heapUsed },
      memoryAfter: { rss: memoryAfter.rss, heapUsed: memoryAfter.heapUsed } })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
