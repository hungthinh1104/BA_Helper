import { EvidenceQualityAnnotator, TraceabilityLinkForAnnotation } from './evidence-quality.annotator';

describe('EvidenceQualityAnnotator', () => {
  const createMockLink = (overrides: Partial<TraceabilityLinkForAnnotation> = {}): TraceabilityLinkForAnnotation => ({
    id: 'test-link',
    impactAnalysisId: 'analysis-1',
    artifactId: 'artifact-1',
    linkType: 'AFFECTED',
    linkBasis: 'EVIDENCED',
    reviewStatus: 'CONFIRMED',
    confidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    retrievalMetadata: {},
    artifact: {
      id: 'artifact-1',
      snapshotId: 'snapshot-1',
      artifactKey: 'key',
      name: 'SymbolName',
      artifactType: 'CLASS',
      universalKind: 'CLASS',
      filePath: 'src/app.ts',
      startLine: 1,
      endLine: 10,
      language: 'ts',
      contentHash: 'hash',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    evidenceLinks: [
      {
        id: 'trace-ev-1',
        traceabilityLinkId: 'test-link',
        evidenceId: 'ev-1',
        evidence: {
          id: 'ev-1',
          provenanceKey: 'prov-1',
          sourceType: 'CODE',
          snapshotId: 'snapshot-1',
          artifactId: 'artifact-1',
          requirementRevisionId: null,
          sourcePath: 'src/app.ts',
          startLine: 1,
          endLine: 5,
          excerpt: 'console.log("hello");',
          contentHash: 'hash',
          isRedacted: false,
          redactionMetadata: null,
          createdAt: new Date(),
        },
      },
    ],
    ...overrides,
  });

  it('identifies strong evidence (EVIDENCED)', () => {
    const link = createMockLink({
      retrievalMetadata: { semanticScore: 0.85, signals: ['KEYWORD', 'BM25'] },
    });
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('EVIDENCED');
    expect(result.reasons).toContain('hasSourceSnippet');
    expect(result.reasons).toContain('hasFilePath');
    expect(result.reasons).toContain('hasSymbolName');
    expect(result.reasons).toContain('hasLineRange');
    expect(result.reasons).toContain('hasRetrieverScore');
    expect(result.reasons).toContain('hasMultipleSignals');
    expect(result.reasons).not.toContain('missingSourceQuote');
    expect(result.reasons).not.toContain('inferredOnly');
    expect(result.reasons).not.toContain('staleOrUnverified');
  });

  it('identifies inferred-only evidence (INFERRED)', () => {
    const link = createMockLink({
      linkBasis: 'INFERRED',
    });
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('INFERRED');
    expect(result.reasons).toContain('inferredOnly');
  });

  it('identifies weak evidence (WEAK_EVIDENCE) when missing line range, symbol name, and retriever score', () => {
    const link = createMockLink();
    link.artifact!.name = 'UNKNOWN_SYMBOL';
    link.evidenceLinks[0].evidence.startLine = null;
    link.evidenceLinks[0].evidence.endLine = null;
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('WEAK_EVIDENCE');
    expect(result.reasons).not.toContain('hasLineRange');
    expect(result.reasons).not.toContain('hasSymbolName');
  });

  it('identifies missing evidence (MISSING_EVIDENCE) when snippet is empty', () => {
    const link = createMockLink();
    link.evidenceLinks[0].evidence.excerpt = '';
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('MISSING_EVIDENCE');
    expect(result.reasons).toContain('missingSourceQuote');
  });

  it('identifies missing evidence (MISSING_EVIDENCE) when artifact file path is missing', () => {
    const link = createMockLink();
    link.artifact!.filePath = '';
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('MISSING_EVIDENCE');
    expect(result.reasons).not.toContain('hasFilePath');
  });

  it('identifies missing evidence (MISSING_EVIDENCE) when evidenceLinks is empty', () => {
    const link = createMockLink({ evidenceLinks: [] });
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('MISSING_EVIDENCE');
    expect(result.reasons).toContain('missingSourceQuote');
  });

  it('overrides with REVIEW_REQUIRED when stale or unverified', () => {
    const link = createMockLink({ reviewStatus: 'NEEDS_REVIEW' });
    
    const result = EvidenceQualityAnnotator.annotate(link);
    expect(result.label).toBe('REVIEW_REQUIRED');
    expect(result.reasons).toContain('staleOrUnverified');
  });
});
