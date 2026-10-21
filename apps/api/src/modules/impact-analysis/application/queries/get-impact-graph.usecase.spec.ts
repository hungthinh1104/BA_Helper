import { GetImpactGraphUseCase } from './get-impact-graph.usecase';
import { ImpactGraphReadModelBuilder } from './impact-graph-read-model.builder';
import { AppError } from '@ba-helper/shared';
import { PrismaService } from "@ba-helper/backend-runtime";
import { impactGraphResponseSchema } from '@ba-helper/contracts';

// ── Helper builders ──────────────────────────────────────────────────────────

const makeArtifact = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Symbol_${id}`,
  artifactKey: `key-${id}`,
  artifactType: 'SERVICE',
  universalKind: 'DOMAIN_SERVICE',
  filePath: `src/${id}.ts`,
  ...overrides,
});

const makeTraceabilityLink = (id: string, artifact: ReturnType<typeof makeArtifact>, overrides: Record<string, unknown> = {}) => ({
  id,
  artifactId: artifact.id,
  linkType: 'AFFECTED',
  linkBasis: 'LEXICAL',
  reviewStatus: 'NEEDS_REVIEW',
  confidence: 0.8,
  retrievalMetadata: { method: 'HYBRID', signals: ['VECTOR', 'LEXICAL'] },
  artifact,
  ...overrides,
});

const makeInsight = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  insightKey: `key-${id}`,
  insightType: 'CLAIM',
  certainty: 'EVIDENCED',
  reviewStatus: 'NEEDS_REVIEW',
  title: `Insight ${id}`,
  description: 'Some description',
  evidenceLinks: [],
  ...overrides,
});

const makeAnalysis = (overrides: Record<string, unknown> = {}) => ({
  id: 'analysis-1',
  status: 'COMPLETED',
  snapshotId: 'snapshot-1',
  snapshot: { commitSha: 'test-commit-sha' },
  requirementRevision: {
    id: 'rev-1',
    title: 'Cancel paid bookings and receive refund',
    requirement: { id: 'req-1', title: 'Paid cancellation refund' },
  },
  traceabilityLinks: [] as ReturnType<typeof makeTraceabilityLink>[],
  insights: [] as ReturnType<typeof makeInsight>[],
  ...overrides,
});

// ── Mock PrismaService ────────────────────────────────────────────────────────

function makePrisma(analysis: ReturnType<typeof makeAnalysis> | null, deps: unknown[] = []) {
  return {
    impactAnalysis: {
      findUnique: jest.fn().mockResolvedValue(analysis),
    },
    dependencyEdge: {
      findMany: jest.fn().mockResolvedValue(deps),
    },
  } as unknown as PrismaService;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('GetImpactGraphUseCase', () => {
  it.each([null, undefined, { method: 'UNSUPPORTED' }])('omits unavailable retrieval metadata from the wire response: %#', async metadata => {
    const artifact = makeArtifact('artifact');
    const analysis = makeAnalysis({ traceabilityLinks: [makeTraceabilityLink('link', artifact, { retrievalMetadata: metadata })] });
    const result = await new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis))).execute('analysis-1');
    expect(result.nodes.find(node => node.artifactKey === artifact.artifactKey)?.retrieval).toBeUndefined();
    expect(impactGraphResponseSchema.safeParse(result).success).toBe(true);
  });

  it('preserves persisted static provenance without reversing the evidence origin for TESTS', async () => {
    const service = makeArtifact('svc');
    const testCase = { framework: 'jest', suitePath: ['Booking'], title: 'cancels',
      modifier: 'NORMAL', declaredModifier: 'NORMAL', parentFileArtifactKey: 'test:src.booking.spec.ts' };
    const test = makeArtifact('test', { artifactType: 'JEST_TEST_CASE', universalKind: 'TEST_CASE',
      metadata: { testCase } });
    const analysis = makeAnalysis({ traceabilityLinks: [makeTraceabilityLink('link', service)] });
    const provenance = { kind: 'STATIC_SOURCE_REFERENCE', resolver: 'TS_AST_DIRECT_CALL',
      evidenceProvenanceKey: 'snapshot:snapshot-1:artifact:test-key',
      locations: [{ sourcePath: 'src/booking.spec.ts', startLine: 12, endLine: 12 }] };
    const deps = [{ id: 'dep', fromArtifactId: 'test', toArtifactId: 'svc',
      fromArtifact: test, toArtifact: service, type: 'TESTS', confidence: 0, metadata: provenance }];
    const result = await new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis, deps))).execute('analysis-1');
    expect(result.edges.find(e => e.id === 'edge-dep-dep')).toMatchObject({
      source: 'artifact-svc', target: 'artifact-test', displayDirectionReversed: true,
      confidence: 0, provenance,
    });
    expect(result.nodes.find(n => n.id === 'artifact-test')).toMatchObject({ type: 'TEST', testCase });
  });

  it('preserves case metadata on traceability nodes and renders file containers as tests', async () => {
    const testCase = { framework: 'jest', suitePath: [], title: 'later', modifier: 'TODO',
      declaredModifier: 'TODO', parentFileArtifactKey: 'test:src.booking.spec.ts' };
    const test = makeArtifact('case', { artifactType: 'JEST_TEST_CASE', metadata: { testCase } });
    const file = makeArtifact('file', { artifactType: 'SPRING_TEST', universalKind: 'TEST_FILE' });
    const analysis = makeAnalysis({ traceabilityLinks: [makeTraceabilityLink('l1', test), makeTraceabilityLink('l2', file)] });
    const result = await new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis))).execute('analysis-1');
    expect(result.nodes.find(n => n.id === 'artifact-case')).toMatchObject({ type: 'TEST', testCase });
    expect(result.nodes.find(n => n.id === 'artifact-file')).toMatchObject({ type: 'TEST' });
    expect(result.nodes.find(n => n.id === 'artifact-file')?.testCase).toBeUndefined();
  });

  it('UC-GRAPH-01: throws IMPACT_ANALYSIS_NOT_FOUND when analysis is missing', async () => {
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(null) as any));
    await expect(useCase.execute('nonexistent')).rejects.toMatchObject({
      code: 'IMPACT_ANALYSIS_NOT_FOUND',
    });
  });

  it('UC-GRAPH-02: returns Requirement and Analysis root nodes always', async () => {
    const analysis = makeAnalysis();
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const types = result.nodes.map(n => n.type);
    expect(types).toContain('REQUIREMENT');
    expect(types).toContain('ANALYSIS');
    expect(result.edges.some(e => e.type === 'AFFECTS' && e.sourceKind === 'ROOT_LINK')).toBe(true);
  });

  it('UC-GRAPH-03: root node uses requirementRevision.title for Requirement label', async () => {
    const analysis = makeAnalysis();
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const reqNode = result.nodes.find(n => n.type === 'REQUIREMENT');
    expect(reqNode?.label).toBe('Cancel paid bookings and receive refund');
  });

  it('UC-GRAPH-04: includes artifact nodes for TraceabilityLinks', async () => {
    const artifact = makeArtifact('art-1', { artifactType: 'CONTROLLER' });
    const analysis = makeAnalysis({ traceabilityLinks: [makeTraceabilityLink('link-1', artifact)] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const artNode = result.nodes.find(n => n.id === `artifact-${artifact.id}`);
    expect(artNode).toBeDefined();
    expect(artNode?.type).toBe('CONTROLLER');
    expect(artNode?.filePath).toBe('src/art-1.ts');
    expect(artNode?.artifactKey).toBe('key-art-1');
  });

  it('maps legacy raw artifact types via universalKind fallback', async () => {
    const artifact = makeArtifact('art-legacy', {
      artifactType: 'CLASS',
      universalKind: 'DATA_MODEL',
    });
    const analysis = makeAnalysis({ traceabilityLinks: [makeTraceabilityLink('link-legacy', artifact)] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const artNode = result.nodes.find((n) => n.id === `artifact-${artifact.id}`);
    expect(artNode?.type).toBe('ENTITY');
  });

  it('UC-GRAPH-05: AFFECTS edge from Analysis to each artifact node', async () => {
    const artifact = makeArtifact('art-1');
    const analysis = makeAnalysis({ traceabilityLinks: [makeTraceabilityLink('link-1', artifact)] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const affectsEdge = result.edges.find(e => e.type === 'AFFECTS' && e.target === `artifact-${artifact.id}`);
    expect(affectsEdge).toBeDefined();
    expect(affectsEdge?.sourceKind).toBe('TRACEABILITY');
  });

  it('UC-GRAPH-06: carries retrievalMetadata into artifact node', async () => {
    const artifact = makeArtifact('art-1');
    const link = makeTraceabilityLink('link-1', artifact, {
      retrievalMetadata: { method: 'HYBRID', signals: ['VECTOR', 'LEXICAL'], score: { final: 0.92 } },
    });
    const analysis = makeAnalysis({ traceabilityLinks: [link] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const artNode = result.nodes.find(n => n.id === `artifact-${artifact.id}`);
    expect((artNode?.retrieval as Record<string, unknown>)?.method).toBe('HYBRID');
  });

  it('UC-GRAPH-07: includes DEPENDENCY edges only when both endpoints are included nodes', async () => {
    const artA = makeArtifact('art-A', { artifactType: 'CONTROLLER' });
    const artB = makeArtifact('art-B', { artifactType: 'SERVICE' });
    const analysis = makeAnalysis({
      traceabilityLinks: [
        makeTraceabilityLink('link-A', artA),
        makeTraceabilityLink('link-B', artB),
      ],
    });
    const deps = [{ id: 'dep-1', fromArtifactId: 'art-A', toArtifactId: 'art-B', type: 'CALLS' }];
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis, deps) as any));
    const result = await useCase.execute('analysis-1');

    const depEdge = result.edges.find(e => e.id === 'edge-dep-dep-1');
    expect(depEdge).toBeDefined();
    expect(depEdge?.type).toBe('CALLS');
    expect(depEdge?.sourceKind).toBe('DEPENDENCY');
  });

  it('UC-GRAPH-08: TESTS edge is swapped and marked displayDirectionReversed=true', async () => {
    const testArt = makeArtifact('art-test', { artifactType: 'TEST' });
    const svcArt = makeArtifact('art-svc', { artifactType: 'SERVICE' });
    const analysis = makeAnalysis({
      traceabilityLinks: [
        makeTraceabilityLink('link-test', testArt),
        makeTraceabilityLink('link-svc', svcArt),
      ],
    });
    // Semantic: test -> service (TESTS direction)
    const deps = [{ id: 'dep-tests', fromArtifactId: 'art-test', toArtifactId: 'art-svc', type: 'TESTS' }];
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis, deps) as any));
    const result = await useCase.execute('analysis-1');

    const testsEdge = result.edges.find(e => e.type === 'TESTS');
    expect(testsEdge).toBeDefined();
    // Visual layout: svc → test (reversed)
    expect(testsEdge?.source).toBe('artifact-art-svc');
    expect(testsEdge?.target).toBe('artifact-art-test');
    // Flag must be set so consumers know the direction is swapped
    expect(testsEdge?.displayDirectionReversed).toBe(true);
  });

  it('UC-GRAPH-09: insight node is added and linked to matched artifact', async () => {
    const artifact = makeArtifact('art-1');
    const insight = makeInsight('ins-1', {
      evidenceLinks: [{
        evidence: { id: 'ev-1', artifactId: 'art-1', excerpt: 'BookingService.cancel was called' },
      }],
    });
    const analysis = makeAnalysis({
      traceabilityLinks: [makeTraceabilityLink('link-1', artifact)],
      insights: [insight],
    });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const insightNode = result.nodes.find(n => n.id === `insight-${insight.id}`);
    expect(insightNode).toBeDefined();
    expect(insightNode?.type).toBe('INSIGHT');
    expect(insightNode?.evidenceSummary).toBe('BookingService.cancel was called');

    const insightEdge = result.edges.find(e => e.target === `insight-${insight.id}`);
    expect(insightEdge?.source).toBe(`artifact-${artifact.id}`);
    expect(insightEdge?.sourceKind).toBe('EVIDENCE_LINK');
  });

  it('UC-GRAPH-10: UNKNOWN insight mapped to UNKNOWN node type with RAISES_UNKNOWN edge', async () => {
    const insight = makeInsight('ins-unknown', { insightType: 'UNKNOWN', evidenceLinks: [] });
    const analysis = makeAnalysis({ insights: [insight] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const unknownNode = result.nodes.find(n => n.id === `insight-${insight.id}`);
    expect(unknownNode?.type).toBe('UNKNOWN');

    const edge = result.edges.find(e => e.target === `insight-${insight.id}`);
    expect(edge?.type).toBe('RAISES_UNKNOWN');
  });

  it('UC-GRAPH-11: REJECTED insight appears in graph as muted node (reviewStatus=REJECTED), not removed', async () => {
    const insight = makeInsight('ins-rejected', { reviewStatus: 'REJECTED', evidenceLinks: [] });
    const analysis = makeAnalysis({ insights: [insight] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const rejectedNode = result.nodes.find(n => n.id === `insight-${insight.id}`);
    expect(rejectedNode).toBeDefined(); // must NOT be silently removed
    expect(rejectedNode?.reviewStatus).toBe('REJECTED');
  });

  it('UC-GRAPH-12: CONFIRMED insights ranked before REJECTED when truncating', async () => {
    // Fill up to near-cap with dummy artifacts
    const confirmedInsight = makeInsight('confirmed', { reviewStatus: 'CONFIRMED', evidenceLinks: [] });
    const rejectedInsight = makeInsight('rejected', { reviewStatus: 'REJECTED', evidenceLinks: [] });

    // Create 48 artifact nodes to push total to ~52 with root + insights → triggers cap
    const manyLinks = Array.from({ length: 48 }, (_, i) => {
      const art = makeArtifact(`art-${i}`);
      return makeTraceabilityLink(`link-${i}`, art);
    });

    const analysis = makeAnalysis({
      traceabilityLinks: manyLinks,
      // Insights beyond cap: CONFIRMED first, REJECTED second
      insights: [rejectedInsight, confirmedInsight],
    });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    const nodeCount = result.nodes.length;
    expect(nodeCount).toBeLessThanOrEqual(50); // hard cap respected

    // Root nodes must always be present
    expect(result.nodes.some(n => n.type === 'REQUIREMENT')).toBe(true);
    expect(result.nodes.some(n => n.type === 'ANALYSIS')).toBe(true);
  });

  it('UC-GRAPH-13: valid response with empty traceability links', async () => {
    const analysis = makeAnalysis({ traceabilityLinks: [], insights: [] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    expect(result.nodes.length).toBe(2); // only root nodes
    expect(result.edges.length).toBe(1); // only root edge
    expect(result.analysisId).toBe('analysis-1');
    expect(result.snapshotId).toBe('snapshot-1');
  });

  it('UC-GRAPH-14: respects max node cap of 50', async () => {
    const manyLinks = Array.from({ length: 60 }, (_, i) => {
      const art = makeArtifact(`art-${i}`);
      return makeTraceabilityLink(`link-${i}`, art, {
        retrievalMetadata: { method: 'HYBRID', score: { final: 1.0 - i * 0.01 } },
      });
    });
    const analysis = makeAnalysis({ traceabilityLinks: manyLinks });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    expect(result.nodes.length).toBeLessThanOrEqual(50);
    // Root nodes must always be present even when truncated
    expect(result.nodes.some(n => n.type === 'REQUIREMENT')).toBe(true);
    expect(result.nodes.some(n => n.type === 'ANALYSIS')).toBe(true);
  });

  it('UC-GRAPH-15: truncation priority — high score artifacts retained over low score', async () => {
    const highScoreLink = makeTraceabilityLink('link-high', makeArtifact('art-high'), {
      retrievalMetadata: { method: 'HYBRID', score: { final: 0.99 } },
    });
    const lowScoreLinks = Array.from({ length: 60 }, (_, i) =>
      makeTraceabilityLink(`link-low-${i}`, makeArtifact(`art-low-${i}`), {
        retrievalMetadata: { method: 'LEXICAL', score: { final: 0.01 } },
      })
    );
    const analysis = makeAnalysis({ traceabilityLinks: [highScoreLink, ...lowScoreLinks] });
    const useCase = new GetImpactGraphUseCase(new ImpactGraphReadModelBuilder(makePrisma(analysis) as any));
    const result = await useCase.execute('analysis-1');

    // The high-score artifact must survive truncation
    expect(result.nodes.some(n => n.id === 'artifact-art-high')).toBe(true);
  });
});
