import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ANALYZER_VERSION } from '@ba-helper/analyzer';
import type { buildGraph, ScanResult } from '@ba-helper/analyzer';
import { evaluateTraceRepository, type TraceRepository } from './public-test-trace.evaluator';

type PinnedGroundTruth = {
  schemaVersion: number;
  independentHumanReview: boolean;
  heldOutFromResolverDevelopment?: boolean;
  labelReviewStatus?: string;
  groundTruthMethod: string;
  scope: string;
  repositories: TraceRepository[];
};

export function evaluatePinnedTestTrace(projectRoot: string, corpusRoot: string, commitSha: string,
  scan: ScanResult, graph: ReturnType<typeof buildGraph>) {
  const truthSource = readFileSync(path.join(projectRoot, 'tests/evaluation/pinned-nest-api-example.ground-truth.json'), 'utf8');
  const truth = JSON.parse(truthSource) as PinnedGroundTruth;
  if (truth.repositories.length !== 1 || truth.repositories[0].commitSha !== commitSha) {
    throw new Error('Pinned test trace labels do not match the requested corpus commit.');
  }
  const measured = evaluateTraceRepository(corpusRoot, truth.repositories[0], { scan, graph });
  const artifacts = new Map(scan.artifacts.map(artifact => [artifact.stableId, artifact]));
  const selectedTestPaths = new Set(truth.repositories[0].cases.map(test => test.filePath));
  const recoveredTestLinks = graph.edges.flatMap(edge => {
    if (edge.type !== 'TESTS') return [];
    const from = artifacts.get(edge.from), to = artifacts.get(edge.to);
    if (!from?.testCase || !to || !selectedTestPaths.has(from.filePath)) return [];
    return [{ edgeId: edge.stableId, test: { filePath: from.filePath,
      suitePath: from.testCase.suitePath, title: from.testCase.title },
    target: { filePath: to.filePath, symbolName: to.symbolName },
    confidence: edge.confidence, resolver: edge.provenance?.resolver,
    sourceLocations: edge.provenance?.locations ?? [] }];
  }).sort((left, right) => JSON.stringify(left.test).localeCompare(JSON.stringify(right.test)) ||
    (left.sourceLocations[0]?.startLine ?? 0) - (right.sourceLocations[0]?.startLine ?? 0));
  const complete = measured.cases.falsePositive === 0 && measured.cases.falseNegative === 0 &&
    measured.tests.falsePositive === 0 && measured.tests.falseNegative === 0 &&
    measured.evidence.issues.length === 0 && measured.identityAmbiguities.length === 0;
  return { schemaVersion: 1, analyzerVersion: ANALYZER_VERSION, groundTruthMethod: truth.groundTruthMethod,
    groundTruthSha256: createHash('sha256').update(truthSource).digest('hex'),
    independentHumanReview: truth.independentHumanReview,
    heldOutFromResolverDevelopment: truth.heldOutFromResolverDevelopment ?? false,
    labelReviewStatus: truth.labelReviewStatus ?? 'UNSPECIFIED', scope: truth.scope,
    status: complete ? 'PASS' : 'FAIL', cases: measured.cases, tests: measured.tests,
    recoveredTestLinks, evidence: measured.evidence, identityAmbiguities: measured.identityAmbiguities,
    unsupportedPatterns: measured.unsupportedPatterns, diagnosticScope: 'FULL_PINNED_REPOSITORY',
    diagnosticCounts: (scan.diagnostics ?? []).reduce<Record<string, number>>((counts, item) => {
      counts[item.code] = (counts[item.code] ?? 0) + (item.count ?? 1);
      return counts;
    }, {}), durationMs: measured.durationMs };
}
