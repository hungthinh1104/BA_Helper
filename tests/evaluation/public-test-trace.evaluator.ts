import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ANALYZER_VERSION, buildGraph, scanProject } from '@ba-helper/analyzer';
import type { GraphEdge, ScanArtifact, ScanResult } from '@ba-helper/analyzer';
import { evaluateSemanticTestBehavior } from './semantic-test-behavior.evaluator';
import { scoreReferenceSet } from './reference-set.scorer';

export { scoreReferenceSet } from './reference-set.scorer';

type TargetArtifact = { filePath: string; symbolName: string };
type Case = { filePath: string; suitePath: string[]; title: string; targetSymbols: string[]; targetArtifacts?: TargetArtifact[] };
export type TraceRepository = {
  id: string; repository: string; commitSha: string;
  files: Array<{ path: string; blobSha: string }>;
  cases: Case[]; calls: Array<{ fromSymbol: string; toSymbol: string }>;
};
type GroundTruth = {
  schemaVersion: number; independentHumanReview: boolean; groundTruthMethod: string;
  heldOutFromResolverDevelopment?: boolean; labelReviewStatus?: string;
  scope: string; repositories: TraceRepository[];
};

const caseIdentity = (value: Pick<Case, 'filePath' | 'suitePath' | 'title'>) =>
  JSON.stringify([value.filePath, value.suitePath, value.title]);
const edgeIdentity = (from: string, to: string) => JSON.stringify([from.startsWith('[') ? JSON.parse(from) : from, to]);

function verifySourcePins(root: string, repository: TraceRepository): string[] {
  if (!/^[a-f0-9]{40}$/.test(repository.commitSha)) throw new Error('Unpinned repository.');
  let isPinnedGitWorktree = false;
  try {
    const gitRoot = execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    isPinnedGitWorktree = path.resolve(gitRoot) === path.resolve(root);
  } catch {
    isPinnedGitWorktree = false;
  }
  if (isPinnedGitWorktree) {
    const head = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    const changes = execFileSync('git', ['-C', root, 'status', '--porcelain', '--untracked-files=all'],
      { encoding: 'utf8' }).trim();
    if (head !== repository.commitSha || changes) throw new Error('Corpus checkout is not clean at the pinned commit.');
  }
  const files = repository.files.filter(file => {
    if (!/^[\w./-]+$/.test(file.path) || file.path.split('/').includes('..') || path.isAbsolute(file.path)) {
      throw new Error('Unsafe corpus file path.');
    }
    let hash: string;
    if (isPinnedGitWorktree) {
      hash = execFileSync('git', ['-C', root, 'rev-parse', `${repository.commitSha}:${file.path}`], { encoding: 'utf8' }).trim();
    } else {
      const content = readFileSync(path.join(root, file.path));
      hash = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    }
    if (hash !== file.blobSha) throw new Error(`Upstream blob mismatch: ${repository.id}/${file.path}`);
    return true;
  });
  return files.filter(file => file.path.endsWith('.ts')).map(file => path.join(root, file.path));
}

export function auditSourceEvidence(root: string, repository: TraceRepository, edges: GraphEdge[],
  artifacts: Map<string, ScanArtifact>) {
  const selectedPaths = new Set(repository.files.filter(file => file.path.endsWith('.ts')).map(file => file.path));
  const sourceCache = new Map<string, string>();
  const findings: Array<{ edge: string; reason: string }> = [];
  const directEdges = edges.filter(edge => edge.type === 'CALLS' || edge.type === 'TESTS');
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const edge of directEdges) {
    const from = artifacts.get(edge.from), to = artifacts.get(edge.to);
    const key = `${edge.type}:${edge.from}->${edge.to}`;
    const locations = edge.provenance?.locations ?? [];
    if (edge.provenance?.resolver !== 'TS_AST_DIRECT_CALL') findings.push({ edge: key, reason: 'UNEXPECTED_RESOLVER' });
    if (!from || !to) {
      findings.push({ edge: key, reason: 'MISSING_ENDPOINT' });
      continue;
    }
    if (!locations.length) findings.push({ edge: key, reason: 'MISSING_LOCATION' });
    const targetMethod = to.symbolName.split('.').at(-1);
    const callPattern = targetMethod ? new RegExp(`(?:\\?\\.|\\.)\\s*${escapeRegExp(targetMethod)}\\s*(?:\\?\\.)?\\s*\\(`) : null;
    for (const location of locations) {
      if (location.sourcePath !== from.filePath || !selectedPaths.has(location.sourcePath)) {
        findings.push({ edge: key, reason: 'LOCATION_OUTSIDE_SOURCE_ARTIFACT' });
        continue;
      }
      if (!Number.isInteger(location.startLine) || !Number.isInteger(location.endLine) ||
        location.startLine < from.startLine || location.endLine > from.endLine || location.endLine < location.startLine) {
        findings.push({ edge: key, reason: 'LOCATION_OUTSIDE_ARTIFACT_RANGE' });
        continue;
      }
      const source = sourceCache.get(location.sourcePath) ??
        readFileSync(path.join(root, location.sourcePath), 'utf8');
      sourceCache.set(location.sourcePath, source);
      const excerpt = source.split(/\r?\n/).slice(location.startLine - 1, location.endLine).join('\n');
      if (!callPattern?.test(excerpt)) findings.push({ edge: key, reason: 'TARGET_CALL_NOT_AT_REPORTED_LOCATION' });
    }
  }

  return { checkedRelationships: directEdges.length, supportedRelationships: directEdges.length -
    new Set(findings.map(finding => finding.edge)).size, issues: findings };
}

type PrecomputedAnalysis = { scan: ScanResult; graph: ReturnType<typeof buildGraph> };

export function evaluateTraceRepository(root: string, repository: TraceRepository,
  precomputed?: PrecomputedAnalysis) {
  const tsFiles = verifySourcePins(root, repository);
  const started = performance.now();
  const scan = precomputed?.scan ?? scanProject({ fixturePath: root, tsFiles });
  const graph = precomputed?.graph ?? buildGraph(scan);
  const artifacts = new Map(scan.artifacts.map(artifact => [artifact.stableId, artifact]));
  const selectedSourcePaths = new Set(repository.files.filter(file => file.path.endsWith('.ts')).map(file => file.path));
  const selectedTestPaths = new Set(repository.cases.map(test => test.filePath));
  const expectedCases = repository.cases.map(caseIdentity);
  const actualCases = scan.artifacts.flatMap(artifact => artifact.testCase && selectedTestPaths.has(artifact.filePath) ? [caseIdentity({
    filePath: artifact.filePath, suitePath: artifact.testCase.suitePath, title: artifact.testCase.title,
  })] : []);
  const expectedTests = repository.cases.flatMap(test => (test.targetArtifacts
    ? test.targetArtifacts.map(target => edgeIdentity(caseIdentity(test), JSON.stringify([target.filePath, target.symbolName])))
    : test.targetSymbols.map(target => edgeIdentity(caseIdentity(test), target))));
  const expectedCalls = repository.calls.map(call => edgeIdentity(call.fromSymbol, call.toSymbol));
  const qualifiedTargets = repository.cases.flatMap(test => test.targetArtifacts ?? []);
  const qualifiedCaseKeys = new Set(repository.cases.filter(test => test.targetArtifacts !== undefined).map(caseIdentity));
  const unqualifiedSymbols = repository.cases.filter(test => !test.targetArtifacts)
    .flatMap(test => test.targetSymbols);
  for (const target of qualifiedTargets) {
    if (!repository.files.some(file => file.path === target.filePath)) {
      throw new Error(`Target artifact file is not source-pinned: ${repository.id}/${target.filePath}`);
    }
  }
  const gradedSymbols = new Set([
    ...repository.calls.flatMap(call => [call.fromSymbol, call.toSymbol]),
    ...unqualifiedSymbols,
  ]);
  const artifactsBySymbol = new Map<string, ScanArtifact[]>();
  for (const artifact of scan.artifacts) {
    if (artifact.testCase) continue;
    const matches = artifactsBySymbol.get(artifact.symbolName) ?? [];
    matches.push(artifact);
    artifactsBySymbol.set(artifact.symbolName, matches);
  }
  const identityAmbiguities = [...gradedSymbols].flatMap(symbolName => {
    const candidateFiles = (artifactsBySymbol.get(symbolName) ?? []).map(artifact => artifact.filePath).sort();
    return candidateFiles.length > 1 ? [{ symbolName, candidateFiles }] : [];
  });
  identityAmbiguities.push(...qualifiedTargets.flatMap(target => {
    const matches = scan.artifacts.filter(artifact => artifact.filePath === target.filePath && artifact.symbolName === target.symbolName);
    return matches.length === 1 ? [] : [{ symbolName: target.symbolName,
      candidateFiles: matches.map(artifact => artifact.filePath).sort() }];
  }));
  const actualTests: string[] = [], actualCalls: string[] = [];
  const scopedEdges = graph.edges.filter(edge => selectedSourcePaths.has(artifacts.get(edge.from)?.filePath ?? ''));
  for (const edge of scopedEdges) {
    const from = artifacts.get(edge.from), to = artifacts.get(edge.to);
    if (!from || !to) throw new Error('Graph returned an unknown endpoint.');
    if (edge.type === 'CALLS') actualCalls.push(edgeIdentity(from.symbolName, to.symbolName));
    if (edge.type === 'TESTS' && selectedTestPaths.has(from.filePath)) {
      const testIdentity = from.testCase ? caseIdentity({ filePath: from.filePath,
        suitePath: from.testCase.suitePath, title: from.testCase.title }) : `UNEXPECTED_FILE_TRACE:${from.filePath}`;
      const targetIdentity = from.testCase && qualifiedCaseKeys.has(testIdentity)
        ? JSON.stringify([to.filePath, to.symbolName]) : to.symbolName;
      actualTests.push(edgeIdentity(testIdentity, targetIdentity));
    }
  }
  const evidence = auditSourceEvidence(root, repository, scopedEdges, artifacts);
  const unsupportedDeclarations = (scan.diagnostics ?? [])
    .filter(item => item.code === 'JEST_UNSUPPORTED_DECLARATION')
    .reduce((total, item) => total + (item.count ?? 1), 0);
  const recognizedDeclarations = scan.artifacts.filter(artifact => artifact.testCase).length;
  const observedDeclarations = recognizedDeclarations + unsupportedDeclarations;
  return { id: repository.id, repository: repository.repository, commitSha: repository.commitSha,
    selectedFiles: tsFiles.length, durationMs: Math.round(performance.now() - started),
    identityAmbiguities,
    unsupportedPatterns: { recognizedDeclarations, diagnosedUnsupportedDeclarations: unsupportedDeclarations,
      observedDeclarations, observedRate: observedDeclarations ? unsupportedDeclarations / observedDeclarations : null },
    cases: scoreReferenceSet(expectedCases, actualCases), calls: scoreReferenceSet(expectedCalls, actualCalls),
    tests: scoreReferenceSet(expectedTests, actualTests), evidence, diagnostics: [...(scan.diagnostics ?? []), ...(graph.diagnostics ?? [])],
    raw: { expectedCases, actualCases, expectedTests, actualTests, expectedCalls, actualCalls } };
}

export function evaluateTestTraceCorpus(root: string, manifestName: string) {
  const truthSource = readFileSync(path.join(root, 'tests/evaluation', manifestName), 'utf8');
  const truth = JSON.parse(truthSource) as GroundTruth;
  const repositories = truth.repositories.map(repository => evaluateTraceRepository(
    path.join(root, 'tests/fixtures/public-test-trace', repository.id), repository));
  const scoped = (key: string, value: string) => JSON.stringify([key, JSON.parse(value)]);
  const combine = (expected: 'expectedCases' | 'expectedCalls' | 'expectedTests', actual: 'actualCases' | 'actualCalls' | 'actualTests') =>
    scoreReferenceSet(repositories.flatMap(repo => repo.raw[expected].map(value => scoped(repo.id, value))),
      repositories.flatMap(repo => repo.raw[actual].map(value => scoped(repo.id, value))));
  const totals = { cases: combine('expectedCases', 'actualCases'), calls: combine('expectedCalls', 'actualCalls'),
    tests: combine('expectedTests', 'actualTests') };
  const evidence = repositories.reduce((total, repo) => ({
    checkedRelationships: total.checkedRelationships + repo.evidence.checkedRelationships,
    supportedRelationships: total.supportedRelationships + repo.evidence.supportedRelationships,
    issues: [...total.issues, ...repo.evidence.issues.map(issue => ({ repositoryId: repo.id, ...issue }))],
  }), { checkedRelationships: 0, supportedRelationships: 0, issues: [] as Array<{ repositoryId: string; edge: string; reason: string }> });
  const unsupportedPatterns = repositories.reduce((total, repo) => ({
    recognizedDeclarations: total.recognizedDeclarations + repo.unsupportedPatterns.recognizedDeclarations,
    diagnosedUnsupportedDeclarations: total.diagnosedUnsupportedDeclarations + repo.unsupportedPatterns.diagnosedUnsupportedDeclarations,
  }), { recognizedDeclarations: 0, diagnosedUnsupportedDeclarations: 0 });
  const identityAmbiguities = repositories.flatMap(repo => repo.identityAmbiguities.map(ambiguity => ({
    repositoryId: repo.id, ...ambiguity,
  })));
  const observedDeclarations = unsupportedPatterns.recognizedDeclarations + unsupportedPatterns.diagnosedUnsupportedDeclarations;
  const complete = Object.values(totals).every(score => !score.falsePositive && !score.falseNegative) &&
    evidence.issues.length === 0 && identityAmbiguities.length === 0;
  return { schemaVersion: 1, analyzerVersion: ANALYZER_VERSION, groundTruthMethod: truth.groundTruthMethod,
    groundTruthSha256: createHash('sha256').update(truthSource).digest('hex'),
    independentHumanReview: truth.independentHumanReview, scope: truth.scope,
    status: complete ? 'PASS' : 'FAIL', totals,
    evidence: { ...evidence, integrityRate: evidence.checkedRelationships ? evidence.supportedRelationships / evidence.checkedRelationships : null },
    identityAmbiguities,
    unsupportedPatterns: { ...unsupportedPatterns, observedDeclarations,
      observedRate: observedDeclarations ? unsupportedPatterns.diagnosedUnsupportedDeclarations / observedDeclarations : null },
    repositories: repositories.map(({ raw, ...result }) => { void raw; return result; }) };
}

export function evaluatePublicTestTraces(root = process.cwd()) {
  const traces = evaluateTestTraceCorpus(root, 'public-test-trace.ground-truth.json');
  const semanticBehavior = evaluateSemanticTestBehavior(root);
  return { ...traces, semanticBehavior,
    status: traces.status === 'PASS' && semanticBehavior.status === 'PASS' ? 'PASS' as const : 'FAIL' as const };
}
