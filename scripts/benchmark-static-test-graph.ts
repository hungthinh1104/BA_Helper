import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildGraph } from '../packages/analyzer/src/graph/graph';
import { scanProject } from '../packages/analyzer/src/scanner/scanner';

const callsPerCase = 4;
const iterations = 5;
const scanIterations = 3;
const maxScanMs = 15_000;
const maxMedianGraphMs = 5_000;
const scalePoints = [
  { files: 5, casesPerFile: 20 },
  { files: 10, casesPerFile: 20 },
  { files: 20, casesPerFile: 40 },
];
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const digestSource = (value: string) => digest(value.replace(/\r\n/g, '\n'));

async function fixture(root: string, files: number, casesPerFile: number): Promise<string[]> {
  const service = join(root, 'payment.service.ts');
  await writeFile(service, "@Injectable() export class PaymentService { refund() {} }\n");
  const paths = [service];
  for (let index = 0; index < files; index++) {
    const file = join(root, `payment-${index}.spec.ts`);
    const cases = Array.from({ length: casesPerFile }, (_, item) =>
      `it('refund ${item}', () => { const request = { id: ${item} }; ` +
      `jest.fn().mockReturnValue('ok'); ${'service.refund(); '.repeat(callsPerCase)} ` +
      `const result = service.refund(); expect(result).toBe('ok'); });`);
    await writeFile(file, [
      "import { PaymentService } from './payment.service';",
      'const service = new PaymentService();', ...cases,
    ].join('\n'));
    paths.push(file);
  }
  return paths;
}

async function measureScale(files: number, casesPerFile: number) {
  const root = await mkdtemp(join(tmpdir(), 'ba-helper-graph-benchmark-'));
  try {
    const paths = await fixture(root, files, casesPerFile);
    const snapshotInputs = await Promise.all(paths.map(async file =>
      `${relative(root, file).replace(/\\/g, '/')}\0${digestSource(await readFile(file, 'utf8'))}`));
    const fixtureSnapshotSha = createHash('sha1').update(snapshotInputs.sort().join('\n')).digest('hex');
    const memoryBefore = process.memoryUsage();
    const scanStart = performance.now();
    const scan = scanProject({ fixturePath: root, tsFiles: paths, commitSha: fixtureSnapshotSha });
    const scanMs = performance.now() - scanStart;
    const memoryAfterScan = process.memoryUsage();
    const behavior = scan.artifacts.flatMap(artifact => artifact.testCase?.behaviorEvidence ?? []);
    const expectedBehaviorClaims = files * casesPerFile * (callsPerCase + 6);
    const behaviorDigest = digest(JSON.stringify(behavior));
    if (behavior.length !== expectedBehaviorClaims || scan.diagnostics?.some(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')) {
      throw new Error('Benchmark fixture did not produce its expected bounded behavior evidence.');
    }
    if (scanMs > maxScanMs) throw new Error(`Static test extraction exceeded the ${maxScanMs}ms scan budget.`);
    const scanSamplesMs: number[] = [];
    for (let index = 0; index < scanIterations; index++) {
      const repeatedStart = performance.now();
      const repeatedScan = scanProject({ fixturePath: root, tsFiles: paths, commitSha: fixtureSnapshotSha });
      scanSamplesMs.push(performance.now() - repeatedStart);
      const repeatedBehavior = repeatedScan.artifacts.flatMap(artifact => artifact.testCase?.behaviorEvidence ?? []);
      if (digest(JSON.stringify(repeatedBehavior)) !== behaviorDigest) throw new Error('Non-deterministic static behavior evidence.');
    }
    const memoryAfterRepeatedScan = process.memoryUsage();

    const samplesMs: number[] = [];
    let outputDigest = '';
    for (let index = 0; index <= iterations; index++) {
      const start = performance.now();
      const graph = buildGraph(scan);
      const elapsed = performance.now() - start;
      if (graph.edges.length !== files * casesPerFile || graph.diagnostics?.length) {
        throw new Error('Benchmark fixture did not produce its expected source relationships.');
      }
      const actual = digest(JSON.stringify(graph));
      if (outputDigest && actual !== outputDigest) throw new Error('Non-deterministic graph output.');
      outputDigest = actual;
      if (index > 0) samplesMs.push(elapsed);
    }
    const memoryAfterGraph = process.memoryUsage();
    const ordered = [...samplesMs].sort((a, b) => a - b);
    const medianGraphMs = percentile(ordered, 0.5);
    if (medianGraphMs > maxMedianGraphMs) {
      throw new Error(`Static test graph construction exceeded the ${maxMedianGraphMs}ms median budget.`);
    }
    return {
      analyzerVersion: scan.analyzerVersion,
      fixture: { files, casesPerFile, callsPerCase, snapshotSha: fixtureSnapshotSha, artifacts: scan.artifacts.length,
        cases: files * casesPerFile, edges: files * casesPerFile,
        behaviorClaims: behavior.length, behaviorDigest },
      scanMs: Math.round(scanMs * 100) / 100,
      scanSamplesMs: scanSamplesMs.map(value => Math.round(value * 100) / 100),
      medianScanMs: Math.round(percentile(scanSamplesMs, 0.5) * 100) / 100,
      p95ScanMs: Math.round(percentile(scanSamplesMs, 0.95) * 100) / 100,
      graphSamplesMs: samplesMs.map(value => Math.round(value * 100) / 100),
      medianGraphMs: Math.round(medianGraphMs * 100) / 100,
      p95GraphMs: Math.round(percentile(samplesMs, 0.95) * 100) / 100, outputDigest,
      memoryBytes: {
        beforeScan: { rss: memoryBefore.rss, heapUsed: memoryBefore.heapUsed },
        afterScan: { rss: memoryAfterScan.rss, heapUsed: memoryAfterScan.heapUsed },
        afterRepeatedScan: { rss: memoryAfterRepeatedScan.rss, heapUsed: memoryAfterRepeatedScan.heapUsed },
        afterGraph: { rss: memoryAfterGraph.rss, heapUsed: memoryAfterGraph.heapUsed },
        scanDelta: { rss: memoryAfterScan.rss - memoryBefore.rss, heapUsed: memoryAfterScan.heapUsed - memoryBefore.heapUsed },
        repeatedScanDelta: { rss: memoryAfterRepeatedScan.rss - memoryAfterScan.rss,
          heapUsed: memoryAfterRepeatedScan.heapUsed - memoryAfterScan.heapUsed },
        graphDelta: { rss: memoryAfterGraph.rss - memoryAfterRepeatedScan.rss,
          heapUsed: memoryAfterGraph.heapUsed - memoryAfterRepeatedScan.heapUsed },
      },
    };
  } finally {
    await removeBenchmarkRoot(root);
  }
}

async function main(): Promise<void> {
  const label = process.argv.slice(2).filter(value => value !== '--')[0] ?? 'current';
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a lowercase benchmark label.');
  const scales: Awaited<ReturnType<typeof measureScale>>[] = [];
  for (const point of scalePoints) scales.push(await measureScale(point.files, point.casesPerFile));
  const sourceFiles = ['graph/graph.ts', 'graph/graph.types.ts', 'graph/graph-source-resolver.ts', 'graph/test-call-index.ts',
    'scanner/scanner.ts', 'scanner/scanner.types.ts', 'scanner/jest/jest-test-behavior.ts',
    'scanner/jest/jest-test-extractor.ts', 'scanner/jest/jest-test-artifact.ts', 'scanner/core/secret-redactor.ts'];
  const implementation = await Promise.all(sourceFiles.map(async file => {
    try { return [file, digestSource(await readFile(resolve('packages/analyzer/src', file), 'utf8'))]; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [file, null]; throw error; }
  }));
  const benchmarkScriptSha256 = digestSource(await readFile(resolve('scripts/benchmark-static-test-graph.ts'), 'utf8'));
  const outputDigest = digest(JSON.stringify(scales.map(scale => [scale.fixture, scale.outputDigest])));
  const output = {
    benchmarkVersion: 4, label, generatedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    analyzerVersion: scales[0]?.analyzerVersion, benchmarkScriptSha256,
    gates: { maxScanMs, maxMedianGraphMs, warmupGraphIterations: 1, measuredGraphIterations: iterations,
      measuredScanIterations: scanIterations,
      callsPerCase, scalePoints },
    implementation: Object.fromEntries(implementation), scales,
    interpretation: 'Synthetic static extraction and graph scalability measurements. Latency and process memory are observations of these fixtures, not end-to-end or public-repository estimates. Memory deltas are not regression thresholds because runner RSS varies.',
    outputDigest,
  };
  const directory = resolve('artifacts/performance');
  await mkdir(directory, { recursive: true });
  const outputPath = join(directory, `static-test-graph-${label}.json`);
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ label, outputDigest,
    scales: scales.map(scale => ({ cases: scale.fixture.cases, scanMs: scale.scanMs,
      medianScanMs: scale.medianScanMs, p95ScanMs: scale.p95ScanMs,
      medianGraphMs: scale.medianGraphMs, p95GraphMs: scale.p95GraphMs })),
    output: relative(process.cwd(), outputPath) })}\n`);
}

function percentile(samples: number[], rank: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(rank * sorted.length) - 1));
  return sorted[index];
}

async function removeBenchmarkRoot(root: string): Promise<void> {
  if (!root.startsWith(join(tmpdir(), 'ba-helper-graph-benchmark-'))) throw new Error('Unsafe cleanup path.');
  await rm(root, { recursive: true, force: true });
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
