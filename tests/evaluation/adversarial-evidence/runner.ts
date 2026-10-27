import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ANALYZER_VERSION, buildGraph, scanProject } from '@ba-helper/analyzer';
import { auditSourceEvidence, type TraceRepository } from '../public-test-trace.evaluator';
import { adversarialCases } from './cases';
import type { AdversarialCase, FixtureFiles } from './cases';
import {
  compareDiagnostics, compareLocations, compareRelationshipSets, isOutcomeConsistent, normalizeDiagnostic,
  relationshipDelta, relationshipFromEdge, relationshipKey,
} from './relationships';
import type { Diagnostic, Relationship } from './relationships';

export { compareRelationshipSets };
type VariantResult = {
  fixtureSnapshotSha: string;
  relationships: Relationship[];
  diagnostics: Diagnostic[];
  sourceHashes: Record<string, string>;
  durationMs: number;
  provenance: { evaluatedLocations: number; validLocations: number; issues: Array<{ edge: string; reason: string }> };
  provenanceTamperProbe?: { injectedLocation: { sourcePath: string; startLine: number; endLine: number };
    expectedReason: string; detectedReasons: string[]; passed: boolean };
};

export function runAdversarialEvidenceVerification(projectRoot = process.cwd()) {
  const suiteStarted = performance.now();
  const memoryBefore = process.memoryUsage();
  const cases = adversarialCases.map(evaluateCase);
  const memoryAfter = process.memoryUsage();
  const allVariants = cases.flatMap(item => [item.baseline, item.transformed]);
  const evaluatedLocations = allVariants.reduce((sum, item) => sum + item.provenance.evaluatedLocations, 0);
  const validLocations = allVariants.reduce((sum, item) => sum + item.provenance.validLocations, 0);
  const invalidSupportedEdges = cases.flatMap(item => item.invalidSupportedEdges);
  const missingExpectedEdges = cases.flatMap(item => item.missingExpectedEdges);
  const provenanceViolations = cases.flatMap(item => item.provenanceViolations);
  const unexpectedDiagnostics = cases.flatMap(item => item.unexpectedDiagnostics);
  const missingExpectedDiagnostics = cases.flatMap(item => item.expectedDiagnosticsMissing);
  const unresolved = cases.filter(item => item.expectedOutcome === 'UNRESOLVED');
  const unresolvedCorrect = unresolved.filter(item => item.unresolvedCorrect).length;
  const passedProperties = cases.filter(item => item.passed).length;
  const provenanceTamperProbe = cases.map(item => item.transformed.provenanceTamperProbe).find(Boolean) ?? {
    injectedLocation: { sourcePath: '', startLine: 0, endLine: 0 },
    expectedReason: 'TARGET_CALL_NOT_AT_REPORTED_LOCATION', detectedReasons: [], passed: false,
  };
  const toolCommitSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'],
    { cwd: projectRoot, encoding: 'utf8' }).trim().length > 0;
  return {
    schemaVersion: 1,
    toolCommitSha,
    toolWorkingTreeDirty: dirty,
    toolSourceDiffSha256: toolSourceDiffSha256(projectRoot),
    analyzerVersion: ANALYZER_VERSION,
    verificationSuiteVersion: 'g2b-auto-lite-1',
    status: cases.every(item => item.passed) && provenanceTamperProbe.passed ? 'PASS' : 'FAIL',
    durationMs: Math.round(performance.now() - suiteStarted),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: os.cpus()[0]?.model ?? null,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      memoryBeforeBytes: { rss: memoryBefore.rss, heapUsed: memoryBefore.heapUsed },
      memoryAfterBytes: { rss: memoryAfter.rss, heapUsed: memoryAfter.heapUsed },
    },
    metrics: {
      propertySatisfaction: { passed: passedProperties, evaluated: cases.length,
        rate: cases.length ? passedProperties / cases.length : null },
      falseSupportedRelationshipCount: invalidSupportedEdges.length,
      missingExpectedRelationshipCount: missingExpectedEdges.length,
      provenanceIntegrity: { validLocations, evaluatedLocations,
        rate: evaluatedLocations ? validLocations / evaluatedLocations : null },
      unresolvedCorrectness: { passed: unresolvedCorrect, evaluated: unresolved.length,
        status: unresolvedCorrect === unresolved.length ? 'PASS' : 'FAIL' },
      provenanceTamperRejection: { ...provenanceTamperProbe,
        status: provenanceTamperProbe.passed ? 'PASS' : 'FAIL' },
      invalidSupportedEdges,
      missingExpectedEdges,
      provenanceViolations,
      unexpectedDiagnostics,
      missingExpectedDiagnostics,
    },
    cases,
    provenanceTamperProbe,
    limitations: [
      'Selected synthetic source transformations verify L0-L2 properties only.',
      'No repository code is executed; static declarations do not establish runtime behavior, test pass/fail, or coverage.',
      'The suite is not independently adjudicated repository ground truth and does not estimate general analyzer accuracy.',
      'Computed method names remain unresolved; runtime dispatch and snapshot persistence isolation are outside this analyzer seam.',
    ],
  };
}

function evaluateCase(spec: AdversarialCase) {
  const baseline = analyzeVariant(spec.id, spec.baseline, 'baseline');
  const transformedFiles = spec.transform(spec.baseline);
  const transformed = analyzeVariant(spec.id, transformedFiles, 'transformed');
  const baselineComparison = compareRelationshipSets(spec.expectedBaseline, baseline.relationships);
  const transformedComparison = compareRelationshipSets(spec.expectedTransformed, transformed.relationships);
  const baselineLocationMismatches = compareLocations(spec.expectedBaseline, baseline.relationships);
  const transformedLocationMismatches = compareLocations(spec.expectedTransformed, transformed.relationships);
  const baselineDiagnosticMismatches = compareDiagnostics(spec.expectedBaselineDiagnostics, baseline.diagnostics);
  const transformedDiagnosticMismatches = compareDiagnostics(spec.expectedTransformedDiagnostics, transformed.diagnostics);
  const expectedDelta = relationshipDelta(spec.expectedBaseline, spec.expectedTransformed);
  const observedDelta = relationshipDelta(baseline.relationships, transformed.relationships);
  const deltaMatches = JSON.stringify(expectedDelta) === JSON.stringify(observedDelta);
  const unresolvedCorrect = spec.outcome !== 'UNRESOLVED' ||
    (transformed.relationships.length === 0 && transformedDiagnosticMismatches.missing.length === 0 &&
      transformedDiagnosticMismatches.unexpected.length === 0);
  const outcomeConsistent = isOutcomeConsistent(spec, expectedDelta);
  const passed = !baselineComparison.missing.length && !baselineComparison.unexpected.length &&
    !transformedComparison.missing.length && !transformedComparison.unexpected.length &&
    !baselineLocationMismatches.length && !transformedLocationMismatches.length &&
    !baselineDiagnosticMismatches.missing.length && !baselineDiagnosticMismatches.unexpected.length &&
    !transformedDiagnosticMismatches.missing.length && !transformedDiagnosticMismatches.unexpected.length &&
    !baseline.provenance.issues.length && !transformed.provenance.issues.length && deltaMatches &&
    unresolvedCorrect && outcomeConsistent;
  return {
    id: spec.id, risk: spec.risk, transformation: spec.transformation, rationale: spec.rationale,
    expectedOutcome: spec.outcome, passed,
    expected: { baseline: spec.expectedBaseline, transformed: spec.expectedTransformed,
      baselineDiagnostics: spec.expectedBaselineDiagnostics, transformedDiagnostics: spec.expectedTransformedDiagnostics },
    baseline, transformed,
    relationshipDelta: observedDelta, outcomeSpecificationValid: outcomeConsistent,
    missingExpectedEdges: [
      ...baselineComparison.missing.map(edge => ({ caseId: spec.id, variant: 'baseline' as const, edge })),
      ...transformedComparison.missing.map(edge => ({ caseId: spec.id, variant: 'transformed' as const, edge })),
    ],
    invalidSupportedEdges: [
      ...baselineComparison.unexpected.map(edge => ({ caseId: spec.id, variant: 'baseline' as const, edge })),
      ...transformedComparison.unexpected.map(edge => ({ caseId: spec.id, variant: 'transformed' as const, edge })),
    ],
    provenanceViolations: [
      ...baseline.provenance.issues.map(issue => ({ caseId: spec.id, variant: 'baseline' as const, ...issue })),
      ...transformed.provenance.issues.map(issue => ({ caseId: spec.id, variant: 'transformed' as const, ...issue })),
      ...baselineLocationMismatches.map(edge => ({ caseId: spec.id, variant: 'baseline' as const, reason: 'EXPECTED_LOCATION_MISMATCH', edge })),
      ...transformedLocationMismatches.map(edge => ({ caseId: spec.id, variant: 'transformed' as const, reason: 'EXPECTED_LOCATION_MISMATCH', edge })),
    ],
    unexpectedDiagnostics: [
      ...baselineDiagnosticMismatches.unexpected.map(diagnostic => ({ caseId: spec.id, variant: 'baseline' as const, diagnostic })),
      ...transformedDiagnosticMismatches.unexpected.map(diagnostic => ({ caseId: spec.id, variant: 'transformed' as const, diagnostic })),
    ],
    unresolvedCorrect,
    expectedDiagnosticsMissing: [
      ...baselineDiagnosticMismatches.missing.map(diagnostic => ({ caseId: spec.id, variant: 'baseline' as const, diagnostic })),
      ...transformedDiagnosticMismatches.missing.map(diagnostic => ({ caseId: spec.id, variant: 'transformed' as const, diagnostic })),
    ],
  };
}

function analyzeVariant(caseId: string, files: FixtureFiles, variant: 'baseline' | 'transformed'): VariantResult {
  const root = mkdtempSync(path.join(os.tmpdir(), 'ba-adversarial-evidence-'));
  const started = performance.now();
  try {
    const relativeFiles = Object.keys(files).sort();
    for (const filePath of relativeFiles) {
      const absolute = path.resolve(root, filePath);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, normalizeLf(files[filePath]), 'utf8');
    }
    const tsFiles = relativeFiles.filter(file => file.endsWith('.ts')).map(file => path.resolve(root, file));
    const snapshotSha = createHash('sha1').update(relativeFiles.map(file => `${file}\0${files[file]}\0`).join('')).digest('hex');
    const scan = scanProject({ fixturePath: root, tsFiles, commitSha: snapshotSha });
    const graph = buildGraph(scan);
    const artifacts = new Map(scan.artifacts.map(artifact => [artifact.stableId, artifact]));
    const relationships = graph.edges.filter(edge => edge.type === 'CALLS' || edge.type === 'TESTS')
      .map(edge => relationshipFromEdge(edge, artifacts)).sort((left, right) => relationshipKey(left).localeCompare(relationshipKey(right)));
    const diagnostics = (graph.diagnostics ?? []).map(normalizeDiagnostic)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
    const repository: TraceRepository = {
      id: caseId.toLowerCase(), repository: `local/${caseId.toLowerCase()}`, commitSha: snapshotSha,
      files: relativeFiles.map(filePath => ({ path: filePath, blobSha: gitBlobSha(files[filePath]) })),
      cases: [], calls: [],
    };
    const audit = auditSourceEvidence(root, repository, graph.edges, artifacts);
    let provenanceTamperProbe: VariantResult['provenanceTamperProbe'];
    if (caseId === 'AE-PROVENANCE-SHIFT-01' && variant === 'transformed') {
      const edge = graph.edges.find(item => item.type === 'TESTS' && item.provenance?.locations.length);
      const from = edge && artifacts.get(edge.from);
      if (!edge || !from || !edge.provenance) throw new Error('Cannot construct provenance sensitivity probe.');
      const injectedLocation = { sourcePath: from.filePath, startLine: from.startLine, endLine: from.startLine };
      const tampered = { ...edge, provenance: { ...edge.provenance, locations: [injectedLocation] } };
      const tamperAudit = auditSourceEvidence(root, repository, [tampered], artifacts);
      const detectedReasons = [...new Set(tamperAudit.issues.map(issue => issue.reason))].sort();
      provenanceTamperProbe = { injectedLocation, expectedReason: 'TARGET_CALL_NOT_AT_REPORTED_LOCATION',
        detectedReasons, passed: detectedReasons.includes('TARGET_CALL_NOT_AT_REPORTED_LOCATION') };
    }
    const invalidEdges = new Set(audit.issues.map(issue => issue.edge));
    const locations = graph.edges.filter(edge => edge.type === 'CALLS' || edge.type === 'TESTS')
      .flatMap(edge => (edge.provenance?.locations ?? []).map(location => ({ edge, location })));
    return {
      fixtureSnapshotSha: snapshotSha, relationships, diagnostics,
      sourceHashes: Object.fromEntries(relativeFiles.map(file => [file, sha256(normalizeLf(files[file]))])),
      durationMs: Math.round(performance.now() - started),
      provenance: { evaluatedLocations: locations.length,
        validLocations: locations.filter(({ edge }) => !invalidEdges.has(`${edge.type}:${edge.from}->${edge.to}`)).length,
        issues: audit.issues },
      ...(provenanceTamperProbe ? { provenanceTamperProbe } : {}),
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function normalizeLf(source: string): string { return source.replace(/\r\n?/g, '\n'); }
function sha256(source: string): string { return createHash('sha256').update(source, 'utf8').digest('hex'); }
function gitBlobSha(source: string): string {
  return createHash('sha1').update(`blob ${Buffer.byteLength(source)}\0`).update(source, 'utf8').digest('hex');
}

function toolSourceDiffSha256(projectRoot: string): string {
  const hash = createHash('sha256');
  const trackedFiles = execFileSync('git', ['diff', '--name-status', '--no-renames', 'HEAD'],
    { cwd: projectRoot, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [status, filePath] = line.split('\t', 2);
      return { status, filePath };
    });
  const untrackedFiles = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'],
    { cwd: projectRoot, encoding: 'utf8' }).split('\0').filter(Boolean)
    .map(filePath => ({ status: '??', filePath }));
  for (const file of [...trackedFiles, ...untrackedFiles].sort((left, right) => left.filePath.localeCompare(right.filePath))) {
    if (file.filePath.startsWith('docs/') || file.filePath.startsWith('artifacts/')) continue;
    hash.update(file.status).update('\0').update(file.filePath).update('\0');
    try { hash.update(readFileSync(path.resolve(projectRoot, file.filePath))); }
    catch { hash.update('<deleted>'); }
  }
  return hash.digest('hex');
}
