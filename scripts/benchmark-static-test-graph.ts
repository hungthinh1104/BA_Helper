import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildGraph } from '../packages/analyzer/src/graph/graph';
import { scanProject } from '../packages/analyzer/src/scanner/scanner';

const files = 20;
const casesPerFile = 40;
const callsPerCase = 4;
const iterations = 5;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

async function fixture(root: string): Promise<string[]> {
  const service = join(root, 'payment.service.ts');
  await writeFile(service, "@Injectable() export class PaymentService { refund() {} }\n");
  const paths = [service];
  for (let index = 0; index < files; index++) {
    const file = join(root, `payment-${index}.spec.ts`);
    const cases = Array.from({ length: casesPerFile }, (_, item) =>
      `it('refund ${item}', () => { ${'service.refund(); '.repeat(callsPerCase)} });`);
    await writeFile(file, [
      "import { PaymentService } from './payment.service';",
      'const service = new PaymentService();', ...cases,
    ].join('\n'));
    paths.push(file);
  }
  return paths;
}

async function main(): Promise<void> {
  const label = process.argv.slice(2).filter(value => value !== '--')[0] ?? 'current';
  if (!/^[a-z0-9-]+$/.test(label)) throw new Error('Use a lowercase benchmark label.');
  const root = await mkdtemp(join(tmpdir(), 'ba-helper-graph-benchmark-'));
  try {
    const paths = await fixture(root);
    const scanStart = performance.now();
    const scan = scanProject({ fixturePath: root, tsFiles: paths });
    const scanMs = performance.now() - scanStart;
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
    const sourceFiles = ['graph.ts', 'graph-source-resolver.ts', 'test-call-index.ts'];
    const implementation = await Promise.all(sourceFiles.map(async file => {
      try { return [file, digest(await readFile(resolve('packages/analyzer/src/graph', file), 'utf8'))]; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [file, null]; throw error; }
    }));
    const ordered = [...samplesMs].sort((a, b) => a - b);
    const output = {
      benchmarkVersion: 1, label, node: process.version, platform: process.platform,
      analyzerVersion: scan.analyzerVersion, implementation: Object.fromEntries(implementation),
      fixture: { files, casesPerFile, callsPerCase, artifacts: scan.artifacts.length },
      scanMs, warmupIterations: 1, samplesMs, medianGraphMs: ordered[Math.floor(ordered.length / 2)],
      outputDigest, interpretation: 'Synthetic graph-only measurement; not end-to-end or public-repository latency.',
    };
    const directory = resolve('artifacts/performance');
    await mkdir(directory, { recursive: true });
    const outputPath = join(directory, `static-test-graph-${label}.json`);
    await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify({ label, medianGraphMs: output.medianGraphMs, outputDigest,
      output: relative(process.cwd(), outputPath) }));
  } finally {
    if (!root.startsWith(join(tmpdir(), 'ba-helper-graph-benchmark-'))) throw new Error('Unsafe cleanup path.');
    await rm(root, { recursive: true, force: true });
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
