import type { GraphEdge, ScanArtifact } from '@ba-helper/analyzer';
import type { AdversarialCase, Endpoint, ExpectedDiagnostic, ExpectedRelationship } from './cases';

export type Diagnostic = { code: string; reason: string; filePath: string; startLine: number | null };
export type Relationship = ExpectedRelationship;

export function compareRelationshipSets(expected: readonly Relationship[], observed: readonly Relationship[]) {
  const expectedKeys = expected.map(relationshipKey).sort();
  const observedKeys = observed.map(relationshipKey).sort();
  return { missing: difference(expectedKeys, observedKeys), unexpected: difference(observedKeys, expectedKeys) };
}

export function relationshipFromEdge(edge: GraphEdge, artifacts: Map<string, ScanArtifact>): Relationship {
  const from = artifacts.get(edge.from), to = artifacts.get(edge.to);
  if (!from || !to || (edge.type !== 'CALLS' && edge.type !== 'TESTS')) throw new Error('Graph returned an invalid edge endpoint.');
  return { type: edge.type, from: endpointFromArtifact(from), to: { filePath: to.filePath, symbolName: to.symbolName },
    locations: [...(edge.provenance?.locations ?? [])].map(location => ({ ...location }))
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) };
}

export function normalizeDiagnostic(diagnostic: {
  code: string; reason?: string; filePath?: string; sampleEvidence?: Array<{ startLine: number }>;
}): Diagnostic {
  return { code: diagnostic.code, reason: diagnostic.reason ?? diagnostic.code, filePath: diagnostic.filePath ?? '',
    startLine: diagnostic.sampleEvidence?.[0]?.startLine ?? null };
}

export function compareDiagnostics(expected: readonly ExpectedDiagnostic[], observed: readonly Diagnostic[]) {
  const key = (diagnostic: ExpectedDiagnostic | Diagnostic) =>
    JSON.stringify([diagnostic.code, diagnostic.reason, diagnostic.filePath, diagnostic.startLine]);
  return { missing: difference(expected.map(key).sort(), observed.map(key).sort()),
    unexpected: difference(observed.map(key).sort(), expected.map(key).sort()) };
}

export function compareLocations(expected: readonly Relationship[], observed: readonly Relationship[]): string[] {
  const expectedById = new Map(expected.map(edge => [relationshipKey(edge), locationsKey(edge.locations)]));
  const observedById = new Map(observed.map(edge => [relationshipKey(edge), locationsKey(edge.locations)]));
  return [...expectedById].flatMap(([id, locations]) => observedById.get(id) === locations ? [] : [id]);
}

export function relationshipDelta(baseline: readonly Relationship[], transformed: readonly Relationship[]) {
  const baselineById = new Map(baseline.map(edge => [relationshipKey(edge), edge]));
  const transformedById = new Map(transformed.map(edge => [relationshipKey(edge), edge]));
  const retained = [...baselineById.keys()].filter(id => transformedById.has(id)).sort();
  return {
    removed: [...baselineById.keys()].filter(id => !transformedById.has(id)).sort(),
    added: [...transformedById.keys()].filter(id => !baselineById.has(id)).sort(),
    locationsChanged: retained.filter(id => locationsKey(baselineById.get(id)!.locations) !==
      locationsKey(transformedById.get(id)!.locations)).sort(),
  };
}

export function isOutcomeConsistent(spec: AdversarialCase, delta: ReturnType<typeof relationshipDelta>): boolean {
  if (spec.outcome === 'PRESERVE') return !delta.removed.length && !delta.added.length && !delta.locationsChanged.length;
  if (spec.outcome === 'REMOVE') return delta.removed.length > 0;
  if (spec.outcome === 'REMAP') return spec.expectedBaseline.length > 0 && spec.expectedTransformed.length > 0 &&
    !!(delta.removed.length || delta.added.length || delta.locationsChanged.length);
  return spec.expectedTransformed.length === 0 && spec.expectedTransformedDiagnostics.length > 0;
}

export function relationshipKey(edge: Relationship): string { return JSON.stringify([edge.type, edge.from, edge.to]); }
function locationsKey(locations: Relationship['locations']): string { return JSON.stringify(locations); }

function endpointFromArtifact(artifact: ScanArtifact): Endpoint {
  return artifact.testCase
    ? { filePath: artifact.filePath, test: { suitePath: artifact.testCase.suitePath, title: artifact.testCase.title } }
    : { filePath: artifact.filePath, symbolName: artifact.symbolName };
}

function difference(left: string[], right: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of right) counts.set(value, (counts.get(value) ?? 0) + 1);
  return left.filter(value => {
    const count = counts.get(value) ?? 0;
    if (!count) return true;
    counts.set(value, count - 1);
    return false;
  });
}
