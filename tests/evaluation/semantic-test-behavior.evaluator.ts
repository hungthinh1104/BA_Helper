import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { ANALYZER_VERSION, scanProject } from '@ba-helper/analyzer';
import type { ScanArtifact, ScanStaticBehaviorClaim } from '@ba-helper/analyzer';
import { scoreReferenceSet } from './reference-set.scorer';

type Label = { kind: ScanStaticBehaviorClaim['kind']; assertionKind?: ScanStaticBehaviorClaim['assertionKind']; line: number; sourceText: string };
type BehaviorCase = { filePath: string; suitePath: string[]; title: string; claims: Label[] };
type UnsupportedLabel = { pattern: string; filePath: string; line: number; sourceText: string };
type Corpus = {
  fixturePath: string; sourceHashPolicy: string; commitSha: string; files: Array<{ path: string; sha256: string }>;
  cases: BehaviorCase[]; unsupportedPatterns: UnsupportedLabel[]; independentHumanReview: boolean;
  labelReviewStatus: string; groundTruthMethod: string; limitations: string[];
};
type Policy = { groundTruthSha256: string; expectedClaims: number; unsupportedPatterns: string[] };
type Scorer = (expected: Iterable<string>, predicted: Iterable<string>) => ReturnType<typeof scoreReferenceSet>;

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
export const normalizeText = (value: string) => value.replace(/\r\n/g, '\n');
const caseIdentity = (value: Pick<BehaviorCase, 'filePath' | 'suitePath' | 'title'>) =>
  JSON.stringify([value.filePath, value.suitePath, value.title]);
const claimIdentity = (caseKey: string, claim: Pick<ScanStaticBehaviorClaim, 'kind' | 'assertionKind' | 'sourceText' | 'sourceLocation'>) =>
  JSON.stringify([caseKey, claim.kind, claim.assertionKind ?? null, claim.sourceLocation.startLine, claim.sourceLocation.startColumn,
    claim.sourceLocation.endLine, claim.sourceLocation.endColumn, normalizeText(claim.sourceText)]);

export function evaluateSemanticTestBehavior(root = process.cwd(), score: Scorer = scoreReferenceSet) {
  const prepared = prepareBehaviorEvaluation(root);
  const { labels, labelsSha256, sourceByPath, actualByCase, scan, leakage, policy } = prepared;
  const expectedClaims: string[] = [];
  const actualClaims: string[] = [];
  for (const test of labels.cases) {
    const key = caseIdentity(test);
    const source = sourceByPath.get(test.filePath);
    if (source === undefined) throw new Error(`Label references unpinned source: ${test.filePath}`);
    for (const claim of test.claims) expectedClaims.push(expectedClaimIdentity(key, claim, source));
    for (const artifact of actualByCase.get(key) ?? []) {
      for (const claim of artifact.testCase?.behaviorEvidence ?? []) actualClaims.push(claimIdentity(key, claim));
    }
  }
  const behavior = score(expectedClaims, actualClaims);
  const provenance = auditClaimProvenance(labels.cases, actualByCase, sourceByPath, labels.commitSha);
  const observedUnsupported = (scan.diagnostics ?? [])
    .filter(item => item.code === 'JEST_BEHAVIOR_UNRESOLVED')
    .map(item => ({
      pattern: typeof item.payload?.unsupportedPattern === 'string' ? item.payload.unsupportedPattern : '<missing-pattern>',
      filePath: typeof item.payload?.relativePath === 'string' ? item.payload.relativePath : '<missing-path>',
      line: Number.isInteger(item.payload?.startLine) ? Number(item.payload?.startLine) : null,
      column: Number.isInteger(item.payload?.startColumn) ? Number(item.payload?.startColumn) : null,
      count: item.count ?? 1,
    })).sort((left, right) => {
      const leftKey = JSON.stringify(left), rightKey = JSON.stringify(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  const expectedUnsupported = labels.unsupportedPatterns.map(label => expectedUnsupportedIdentity(label, sourceByPath.get(label.filePath) ?? ''));
  const actualUnsupported = observedUnsupported.map(item => JSON.stringify([item.pattern, item.filePath, item.line, item.column]));
  const unsupported = score(expectedUnsupported, actualUnsupported);
  const unsupportedProvenanceIssues = observedUnsupported.flatMap(item => {
    const match = labels.unsupportedPatterns.some(label => label.pattern === item.pattern && label.filePath === item.filePath &&
      expectedUnsupportedIdentity(label, sourceByPath.get(label.filePath) ?? '') ===
      JSON.stringify([item.pattern, item.filePath, item.line, item.column]));
    return match ? [] : [{ pattern: item.pattern, filePath: item.filePath, line: item.line, column: item.column }];
  });
  const violations: string[] = [];
  if (labelsSha256 !== policy.groundTruthSha256) violations.push('GROUND_TRUTH_CHANGED');
  if (behavior.expected !== policy.expectedClaims) violations.push('EXPECTED_CLAIM_UNIVERSE_CHANGED');
  if (behavior.falsePositive) violations.push('UNEXPECTED_BEHAVIOR_CLAIMS');
  if (behavior.falseNegative) violations.push('MISSING_BEHAVIOR_CLAIMS');
  if (provenance.issues.length) violations.push('BEHAVIOR_PROVENANCE_FAILURE');
  const unsupportedNames = labels.unsupportedPatterns.map(label => label.pattern).sort();
  if (JSON.stringify(unsupportedNames) !== JSON.stringify([...policy.unsupportedPatterns].sort())) {
    violations.push('UNSUPPORTED_PATTERN_BASELINE_CHANGED');
  }
  if (unsupported.expected !== policy.unsupportedPatterns.length || unsupported.falseNegative) violations.push('UNSUPPORTED_PATTERN_MISSED');
  if (unsupported.falsePositive) violations.push('UNEXPECTED_UNSUPPORTED_DIAGNOSTIC');
  if (unsupportedProvenanceIssues.length) violations.push('UNSUPPORTED_DIAGNOSTIC_PROVENANCE_FAILURE');
  if (leakage.length) violations.push('DEVELOPMENT_FIXTURE_LEAKAGE');
  return {
    schemaVersion: 1,
    status: violations.length ? 'FAIL' as const : 'PASS' as const,
    regression: { status: violations.length ? 'FAIL' as const : 'PASS' as const, violations },
    analyzerVersion: ANALYZER_VERSION,
    groundTruth: { corpusId: 'semantic-test-behavior-heldout-v1', sha256: labelsSha256,
      method: labels.groundTruthMethod, independentHumanReview: labels.independentHumanReview,
      labelReviewStatus: labels.labelReviewStatus, sourceHashPolicy: labels.sourceHashPolicy,
      commitContextKind: 'CONTENT_DERIVED_FIXTURE_SNAPSHOT_ID',
      commitSha: labels.commitSha, sourceFiles: labels.files, limitations: labels.limitations },
    behaviorClaims: behavior,
    provenance: { checkedClaims: provenance.checkedClaims, supportedClaims: provenance.supportedClaims,
      integrityRate: provenance.checkedClaims ? provenance.supportedClaims / provenance.checkedClaims : null,
      issues: provenance.issues },
    unsupportedPatterns: { ...unsupported, observedPatterns: observedUnsupported,
      provenanceIssues: unsupportedProvenanceIssues },
    performance: { scanMs: Math.round(prepared.scanMs * 100) / 100,
      memoryBeforeBytes: { rss: prepared.memoryBefore.rss, heapUsed: prepared.memoryBefore.heapUsed },
      memoryAfterBytes: { rss: prepared.memoryAfter.rss, heapUsed: prepared.memoryAfter.heapUsed },
      memoryDeltaBytes: { rss: prepared.memoryAfter.rss - prepared.memoryBefore.rss,
        heapUsed: prepared.memoryAfter.heapUsed - prepared.memoryBefore.heapUsed } },
    leakage,
    diagnostics: scan.diagnostics ?? [],
  };
}

function prepareBehaviorEvaluation(root: string) {
  const labelsPath = path.join(root, 'tests/evaluation/semantic-test-behavior.ground-truth.json');
  const labelsText = readFileSync(labelsPath, 'utf8');
  const labels = JSON.parse(labelsText) as Corpus;
  const policy = JSON.parse(readFileSync(path.join(root, 'tests/evaluation/semantic-test-behavior.regression.json'), 'utf8')) as Policy;
  const labelsSha256 = sha256(normalizeText(labelsText));
  if (labels.sourceHashPolicy !== 'SHA256_UTF8_CRLF_NORMALIZED_TO_LF') throw new Error('Unsupported source hash policy.');
  const fixtureRoot = path.resolve(root, labels.fixturePath);
  const sourceByPath = new Map<string, string>();
  for (const file of labels.files) {
    const filePath = safeFixturePath(fixtureRoot, file.path);
    const bytes = readFileSync(filePath);
    const sourceText = normalizeText(bytes.toString('utf8'));
    if (sha256(sourceText) !== file.sha256) throw new Error(`Held-out source pin mismatch: ${file.path}`);
    sourceByPath.set(file.path, sourceText);
  }
  const snapshotId = createHash('sha1').update(labels.files.map(file => `${file.path}\0${file.sha256}`).sort().join('\n')).digest('hex');
  if (snapshotId !== labels.commitSha) throw new Error('Held-out fixture commit context does not match pinned source files.');
  if (!/^[a-f0-9]{40}$/.test(labels.commitSha)) throw new Error('Invalid held-out fixture snapshot context.');

  const tsFiles = labels.files.filter(file => file.path.endsWith('.ts')).map(file => safeFixturePath(fixtureRoot, file.path));
  const memoryBefore = process.memoryUsage();
  const started = performance.now();
  const scan = scanProject({ fixturePath: fixtureRoot, tsFiles, commitSha: labels.commitSha });
  const scanMs = performance.now() - started;
  const memoryAfter = process.memoryUsage();
  const labeledCases = new Map(labels.cases.map(test => [caseIdentity(test), test]));
  const actualByCase = new Map<string, ScanArtifact[]>();
  for (const artifact of scan.artifacts) {
    if (!artifact.testCase) continue;
    const key = caseIdentity({ filePath: artifact.filePath, suitePath: artifact.testCase.suitePath, title: artifact.testCase.title });
    if (labeledCases.has(key)) actualByCase.set(key, [...(actualByCase.get(key) ?? []), artifact]);
  }
  const leakage = auditDevelopmentLeakage(root, fixtureRoot, labels.files, labels.cases, sourceByPath, actualByCase);
  return { labels, policy, labelsSha256, sourceByPath, scan, actualByCase, leakage,
    scanMs, memoryBefore, memoryAfter };
}

function expectedClaimIdentity(caseKey: string, label: Label, source: string): string {
  const normalizedSource = normalizeText(source), expectedText = normalizeText(label.sourceText);
  let offset = -1, searchFrom = 0;
  while (true) {
    const candidate = normalizedSource.indexOf(expectedText, searchFrom);
    if (candidate < 0) break;
    if (sourcePosition(normalizedSource, candidate).line === label.line) {
      if (offset >= 0) throw new Error(`Ground truth source anchor is ambiguous at line ${label.line}.`);
      offset = candidate;
    }
    searchFrom = candidate + 1;
  }
  if (offset < 0) {
    throw new Error(`Ground truth source anchor is missing or ambiguous at line ${label.line}.`);
  }
  const start = sourcePosition(normalizedSource, offset), end = sourcePosition(normalizedSource, offset + expectedText.length);
  return JSON.stringify([caseKey, label.kind, label.assertionKind ?? null, start.line, start.column, end.line, end.column, expectedText]);
}

function expectedUnsupportedIdentity(label: UnsupportedLabel, source: string): string {
  const normalizedSource = normalizeText(source), expectedText = normalizeText(label.sourceText);
  const lines = normalizedSource.split('\n');
  const line = lines[label.line - 1];
  if (!line) throw new Error(`Unsupported-pattern ground truth line is outside the source: ${label.line}`);
  const offset = line.indexOf(expectedText);
  if (offset < 0 || line.indexOf(expectedText, offset + 1) >= 0) {
    throw new Error(`Unsupported-pattern source anchor is missing or ambiguous at line ${label.line}.`);
  }
  return JSON.stringify([label.pattern, label.filePath, label.line, offset + 1]);
}

function auditClaimProvenance(cases: BehaviorCase[], actual: Map<string, ScanArtifact[]>, sources: Map<string, string>, commitSha: string) {
  let checkedClaims = 0, supportedClaims = 0;
  const issues: Array<{ case: string; kind: string; reason: string }> = [];
  for (const test of cases) {
    const key = caseIdentity(test), source = sources.get(test.filePath)!;
    for (const artifact of actual.get(key) ?? []) for (const claim of artifact.testCase?.behaviorEvidence ?? []) {
      checkedClaims++;
      const location = claim.sourceLocation;
      const start = sourcePosition(source, location.startOffset), end = sourcePosition(source, location.endOffset);
      const valid = claim.evidenceKind === 'STATIC_DECLARATION' && claim.commitSha === commitSha &&
        location.relativePath === test.filePath && location.startOffset >= 0 && location.endOffset <= source.length &&
        location.endOffset >= location.startOffset && source.slice(location.startOffset, location.endOffset) === claim.sourceText &&
        start.line === location.startLine && start.column === location.startColumn &&
        end.line === location.endLine && end.column === location.endColumn;
      if (valid) supportedClaims++;
      else issues.push({ case: key, kind: claim.kind, reason: 'SOURCE_OR_COMMIT_PROVENANCE_MISMATCH' });
    }
  }
  return { checkedClaims, supportedClaims, issues };
}

function auditDevelopmentLeakage(root: string, fixtureRoot: string, files: Corpus['files'], cases: BehaviorCase[],
  sources: Map<string, string>, actual: Map<string, ScanArtifact[]>): string[] {
  const developmentRoots = ['packages/analyzer/tests', 'tests/fixtures/jest-behavior'].map(item => path.resolve(root, item));
  if (developmentRoots.some(directory => isWithin(directory, fixtureRoot))) return ['FIXTURE_INSIDE_DEVELOPMENT_ROOT'];
  const devFiles = developmentRoots.flatMap(listTypeScriptFiles);
  const devHashes = new Set(devFiles.map(file => sha256(normalizeText(readFileSync(file, 'utf8')))));
  const devTexts = devFiles.map(file => readFileSync(file, 'utf8').replace(/\s+/g, ' '));
  const violations = files.filter(file => devHashes.has(sha256(normalizeText(readFileSync(safeFixturePath(fixtureRoot, file.path), 'utf8')))))
    .map(file => `DUPLICATE_DEVELOPMENT_FILE:${file.path}`);
  for (const test of cases) {
    const source = sources.get(test.filePath);
    if (!source) continue;
    for (const artifact of actual.get(caseIdentity(test)) ?? []) {
      if (!artifact.testBodySpan) continue;
      const body = source.slice(artifact.testBodySpan.start, artifact.testBodySpan.end).replace(/\s+/g, ' ').trim();
      if (body.length > 40 && devTexts.some(content => content.includes(body))) {
        violations.push(`DEVELOPMENT_TEST_BODY_OVERLAP:${test.title}`);
      }
    }
  }
  return violations.sort();
}

function listTypeScriptFiles(directory: string): string[] {
  try {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) return listTypeScriptFiles(child);
      return entry.isFile() && child.endsWith('.ts') ? [child] : [];
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

function safeFixturePath(root: string, relativePath: string): string {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.split(/[\\/]/).includes('..')) {
    throw new Error('Unsafe held-out fixture path.');
  }
  const resolved = path.resolve(root, relativePath);
  if (!isWithin(root, resolved)) throw new Error('Held-out fixture path escapes its root.');
  return resolved;
}

function isWithin(parent: string, child: string): boolean {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function sourcePosition(source: string, offset: number) {
  const prefix = source.slice(0, offset).split(/\r?\n/);
  return { line: prefix.length, column: prefix.at(-1)!.length + 1 };
}
