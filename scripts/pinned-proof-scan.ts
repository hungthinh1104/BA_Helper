import { createHash } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { buildGraph, scanProject } from '../packages/analyzer/src/index';
import type { ScanCoverage, ScanResult } from '../packages/analyzer/src/index';
import { SafeFileEnumerator } from '../packages/analyzer/src/scanner/core/safe-file-enumerator';
import type { FileDiagnostic } from '../packages/analyzer/src/scanner/core/safe-file-enumerator';
import { TypeScriptNestJsAdapter } from '../packages/analyzer/src/scanner/adapters/typescript-nestjs.adapter';

const WARMUP_PASSES = 1;
const MEASURED_PASSES = 5;

export function summarizeMs(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  return { count: sorted.length, p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

type ScanPass = {
  result: ScanResult;
  fileDiagnostics: FileDiagnostic[];
  enumerationMs: number;
  scannerMs: number;
  graphMs: number;
  pipelineMs: number;
  digest: string;
};

async function scanPass(root: string, commitSha: string, adapter: TypeScriptNestJsAdapter): Promise<ScanPass> {
  const pipelineStarted = performance.now();
  const enumerationStarted = performance.now();
  const enumerated = await new SafeFileEnumerator(root).enumerate();
  const enumerationMs = performance.now() - enumerationStarted;
  const coverage: ScanCoverage = { status: enumerated.isPartial ? 'PARTIAL' : 'FULL',
    skippedFiles: enumerated.skippedFiles, skippedSummary: enumerated.skippedSummary,
    limits: enumerated.limits, limitHits: enumerated.limitHits };
  const scannerStarted = performance.now();
  const scanned = scanProject({ fixturePath: root, tsFiles: enumerated.tsFiles, coverage,
    commitSha, analyzerVersion: adapter.adapterVersion });
  const scannerMs = performance.now() - scannerStarted;
  const graphStarted = performance.now();
  const graph = buildGraph(scanned);
  const graphMs = performance.now() - graphStarted;
  const pipelineMs = performance.now() - pipelineStarted;
  const digest = createHash('sha256').update(JSON.stringify({
    sourceFiles: enumerated.tsFiles.map(file => path.relative(root, file).replace(/\\/g, '/')).sort(),
    artifacts: scanned.artifacts, edges: graph.edges, scannerDiagnostics: scanned.diagnostics,
    graphDiagnostics: graph.diagnostics ?? [],
  })).digest('hex');
  const diagnostics = [...(scanned.diagnostics ?? []), ...(graph.diagnostics ?? []).map(diagnostic => ({
    code: diagnostic.code, severity: 'WARN' as const, category: 'SCANNER' as const,
    message: diagnostic.message, count: diagnostic.count ?? 1,
    payload: { relativePath: diagnostic.filePath, unsupportedPattern: diagnostic.reason ?? diagnostic.code,
      reason: diagnostic.reason, sourceSymbol: diagnostic.sourceSymbol,
      targetExpression: diagnostic.targetExpression, sampleEvidence: diagnostic.sampleEvidence },
    samplePaths: diagnostic.filePath ? [diagnostic.filePath] : undefined,
  }))];
  diagnostics.push({ code: 'SCANNER_CAPABILITY_SUMMARY', severity: 'INFO',
    message: `Scanner capability profile injected for ${adapter.adapterId}`, category: 'SCANNER',
    payload: { adapterId: adapter.adapterId, adapterVersion: adapter.adapterVersion,
      language: adapter.language, framework: adapter.framework, status: adapter.capability.status,
      confidence: adapter.capability.confidence,
      supportedArtifactKindCount: adapter.capability.supportedArtifactKinds.length,
      supportedPatternCount: adapter.capability.supportedPatterns.length,
      partialPatternCount: adapter.capability.partialPatterns.length,
      unsupportedPatternCount: adapter.capability.unsupportedPatterns.length } });
  return { result: { ...scanned, analyzerVersion: adapter.adapterVersion,
    scannedFileCount: enumerated.tsFiles.length,
    dependencyEdges: graph.edges.map(edge => ({ fromArtifactId: edge.from, toArtifactId: edge.to,
      type: edge.type, confidence: edge.confidence, provenance: edge.provenance })),
    diagnostics, coverage, sourceRoot: root, sourceFiles: enumerated.tsFiles },
  fileDiagnostics: enumerated.diagnostics, enumerationMs, scannerMs, graphMs,
  pipelineMs, digest };
}

export async function scanPinnedRepository(root: string, commitSha: string) {
  const adapter = new TypeScriptNestJsAdapter();
  const enumerationSamples: number[] = [];
  const scannerSamples: number[] = [];
  const graphSamples: number[] = [];
  const pipelineSamples: number[] = [];
  const outputDigests: string[] = [];
  let lastPass: ScanPass | undefined;
  for (let sample = 0; sample < WARMUP_PASSES + MEASURED_PASSES; sample += 1) {
    lastPass = await scanPass(root, commitSha, adapter);
    if (sample >= WARMUP_PASSES) {
      enumerationSamples.push(lastPass.enumerationMs);
      scannerSamples.push(lastPass.scannerMs);
      graphSamples.push(lastPass.graphMs);
      pipelineSamples.push(lastPass.pipelineMs);
    }
    if (outputDigests.length > 0 && outputDigests[0] !== lastPass.digest) {
      throw new Error('Repeated pinned scans produced different artifact, edge, or diagnostic output.');
    }
    outputDigests.push(lastPass.digest);
  }
  if (!lastPass) throw new Error('Pinned scan did not produce an extraction result.');
  const scanPerformance = {
    condition: 'One unmeasured warm-up plus five measured same-process passes using the production file enumerator, scanner extraction and graph builder.',
    warmupPasses: WARMUP_PASSES, measuredPasses: MEASURED_PASSES,
    sourceEnumeration: summarizeMs(enumerationSamples), scannerExtraction: summarizeMs(scannerSamples),
    graphConstruction: summarizeMs(graphSamples), endToEnd: summarizeMs(pipelineSamples),
    outputDigest: outputDigests[0], outputDigestsAcrossRuns: outputDigests,
    driverMetricLimitations: ['All three passes share one Node process; OS filesystem and runtime caches are warm after the first pass.'],
  };
  return { scanResult: lastPass.result, fileDiagnostics: lastPass.fileDiagnostics,
    scanMs: summarizeMs(scannerSamples).p50, graphMs: summarizeMs(graphSamples).p50, scanPerformance };
}
