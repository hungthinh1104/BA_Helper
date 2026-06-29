import type {
  InsightForAnnotation,
  TraceabilityLinkForAnnotation,
} from './evidence-quality.annotator';
import { EvidenceQualityAnnotator } from './evidence-quality.annotator';
import { buildEvidenceQualityProjection } from './evidence-quality.projection';

describe('EvidenceQualityAnnotator', () => {
  const createMockLink = (
    overrides: Partial<TraceabilityLinkForAnnotation> = {},
  ): TraceabilityLinkForAnnotation => ({
    id: 'link-1',
    impactAnalysisId: 'analysis-1',
    artifactId: 'artifact-1',
    linkType: 'AFFECTED',
    linkBasis: 'EVIDENCED',
    reviewStatus: 'CONFIRMED',
    confidence: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    retrievalMetadata: {},
    reviewDecision: null,
    artifact: {
      id: 'artifact-1',
      snapshotId: 'snapshot-1',
      artifactKey: 'key',
      name: 'BookingService.cancel',
      artifactType: 'CLASS',
      universalKind: 'CLASS',
      filePath: 'src/booking.service.ts',
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
        traceabilityLinkId: 'link-1',
        evidenceId: 'ev-1',
        evidence: {
          id: 'ev-1',
          provenanceKey: 'snapshot:s1:artifact:key',
          sourceType: 'CODE',
          snapshotId: 'snapshot-1',
          artifactId: 'artifact-1',
          requirementRevisionId: null,
          sourcePath: 'src/booking.service.ts',
          startLine: 1,
          endLine: 5,
          excerpt: 'async cancelBooking(id: string) { return this.refunds.create(id); }',
          contentHash: 'hash',
          isRedacted: false,
          redactionMetadata: null,
          createdAt: new Date(),
        },
      },
    ],
    ...overrides,
  });

  const createMockInsight = (
    overrides: Partial<InsightForAnnotation> = {},
  ): InsightForAnnotation => ({
    id: 'insight-1',
    impactAnalysisId: 'analysis-1',
    insightKey: 'claim-1',
    insightType: 'CLAIM',
    certainty: 'EVIDENCED',
    reviewStatus: 'CONFIRMED',
    confidence: 0.8,
    title: 'Cancellation affects refund creation',
    description: 'Cancellation path calls refund creation.',
    reasoning: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    evidenceLinks: [
      {
        id: 'insight-ev-1',
        insightId: 'insight-1',
        evidenceId: 'ev-1',
        evidence: {
          id: 'ev-1',
          provenanceKey: 'snapshot:s1:artifact:key',
          sourceType: 'CODE',
          snapshotId: 'snapshot-1',
          artifactId: 'artifact-1',
          requirementRevisionId: null,
          sourcePath: 'src/booking.service.ts',
          startLine: 1,
          endLine: 5,
          excerpt: 'async cancelBooking(id: string) { return this.refunds.create(id); }',
          contentHash: 'hash',
          isRedacted: false,
          redactionMetadata: null,
          createdAt: new Date(),
          artifact: {
            id: 'artifact-1',
            snapshotId: 'snapshot-1',
            artifactKey: 'key',
            name: 'BookingService.cancel',
            artifactType: 'CLASS',
            universalKind: 'CLASS',
            filePath: 'src/booking.service.ts',
            startLine: 1,
            endLine: 10,
            language: 'ts',
            contentHash: 'hash',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        },
      },
    ],
    ...overrides,
  });

  it('classifies an EVIDENCED traceability link with code evidence and artifact link as strong source evidence', () => {
    const result = EvidenceQualityAnnotator.annotateTraceabilityLink(createMockLink());

    expect(result.label).toBe('STRONG_SOURCE_EVIDENCE');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'hasPersistedEvidence',
      'hasSourceEvidence',
      'hasArtifactLink',
      'hasLineRange',
      'hasSpecificExcerpt',
    ]));
  });

  it('classifies an EVIDENCED insight with short generic source excerpt as weak source evidence', () => {
    const insight = createMockInsight();
    insight.evidenceLinks[0].evidence.excerpt = 'ok';

    const result = EvidenceQualityAnnotator.annotateInsight(insight);

    expect(result.label).toBe('WEAK_SOURCE_EVIDENCE');
    expect(result.reasons).toContain('weakOrGenericExcerpt');
  });

  it('classifies an inferred link with artifact structure but no evidence excerpt as inferred from structure', () => {
    const result = EvidenceQualityAnnotator.annotateTraceabilityLink(createMockLink({
      linkBasis: 'INFERRED',
      evidenceLinks: [],
    }));

    expect(result.label).toBe('INFERRED_FROM_STRUCTURE');
    expect(result.reasons).toContain('inferredLinkBasis');
  });

  it('classifies domain-pack template support without persisted source evidence as domain hint only', () => {
    const result = EvidenceQualityAnnotator.annotateInsight(createMockInsight({
      certainty: 'UNKNOWN',
      insightType: 'UNKNOWN',
      reviewStatus: 'CONFIRMED',
      title: 'PARTIAL healthcare admin hint: prior authorization may block scheduling',
      description: 'Domain pack hint requires source-backed policy evidence.',
      evidenceLinks: [],
      metadata: { origin: 'DOMAIN_PACK_TEMPLATE', templateKey: 'prior-authorization-risk' },
    }));

    expect(result.label).toBe('DOMAIN_HINT_ONLY');
    expect(result.label).not.toBe('STRONG_SOURCE_EVIDENCE');
  });

  it('classifies an inferred traceability link with no evidence and no usable artifact as missing evidence', () => {
    const result = EvidenceQualityAnnotator.annotateTraceabilityLink(createMockLink({
      linkBasis: 'INFERRED',
      artifact: {
        ...createMockLink().artifact,
        filePath: '',
        name: 'UNKNOWN_SYMBOL',
      },
      evidenceLinks: [],
    }));

    expect(result.label).toBe('MISSING_EVIDENCE');
  });

  it('classifies conflicting insight as conflicting evidence', () => {
    const result = EvidenceQualityAnnotator.annotateInsight(createMockInsight({
      certainty: 'CONFLICTING',
    }));

    expect(result.label).toBe('CONFLICTING_EVIDENCE');
    expect(result.reasons).toContain('conflictingCertainty');
  });

  it('classifies unreviewed critical insight as review required', () => {
    const result = EvidenceQualityAnnotator.annotateInsight(createMockInsight({
      reviewStatus: 'NEEDS_REVIEW',
    }));

    expect(result.label).toBe('REVIEW_REQUIRED');
    expect(result.reasons).toContain('reviewRequired');
  });

  it('builds a mixed report-only quality projection with legacy summary aliases', () => {
    const projection = buildEvidenceQualityProjection({
      traceabilityLinks: [createMockLink()],
      insights: [
        createMockInsight({
          id: 'insight-strong',
        }),
        createMockInsight({
          id: 'insight-conflict',
          certainty: 'CONFLICTING',
        }),
      ],
    });

    expect(projection.summary.strongSourceEvidence).toBe(2);
    expect(projection.summary.conflictingEvidence).toBe(1);
    expect(projection.summary.evidenced).toBe(2);
    expect(projection.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemType: 'TRACEABILITY_LINK', quality: 'STRONG_SOURCE_EVIDENCE' }),
      expect.objectContaining({ itemType: 'INSIGHT', quality: 'CONFLICTING_EVIDENCE' }),
    ]));
  });
});
