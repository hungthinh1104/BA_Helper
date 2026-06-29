import { MarkdownImpactReportBuilder } from './markdown-impact-report.builder';
import type { MermaidImpactDiagramBuilder } from '../mermaid-impact-diagram.builder';
import type { EvaluationContextAdapter } from '../evaluation-context.adapter';

describe('MarkdownImpactReportBuilder', () => {
  let builder: MarkdownImpactReportBuilder;
  let mermaidBuilder: jest.Mocked<MermaidImpactDiagramBuilder>;
  let evalContextAdapter: jest.Mocked<EvaluationContextAdapter>;

  beforeEach(() => {
    mermaidBuilder = {
      build: jest.fn().mockReturnValue({ mermaid: '```mermaid\nflowchart TD\n```', isTruncated: false }),
    } as unknown as jest.Mocked<MermaidImpactDiagramBuilder>;
    
    evalContextAdapter = {
      getEvaluationContext: jest.fn().mockReturnValue(null),
    } as unknown as jest.Mocked<EvaluationContextAdapter>;
    
    builder = new MarkdownImpactReportBuilder(mermaidBuilder, evalContextAdapter);
  });

  const mockAnalysis = {
    id: 'test-id',
    requirementRevision: {
      title: 'Paid booking cancellation refund',
      rawText: 'Allow users to cancel paid bookings and receive refund.',
    },
    snapshot: {
      commitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
      repository: {
        canonicalUrl: 'https://github.com/ndmen/booking',
      },
    },
    sourceTarget: {
      requestedRef: 'main',
    },
  } as unknown as any;

  it('generates header and requirement text correctly', () => {
    const report = builder.build({
      analysis: mockAnalysis,
      insights: [],
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    expect(report).toContain('# Impact Analysis Report: Paid booking cancellation refund');
    expect(report).toContain('**Requirement:** Paid booking cancellation refund');
    expect(report).toContain('**Snapshot Commit:** `f26cd56837cd10a1c00bb89d74d97519abc6f732`');
    expect(report).toContain('**Repository:** `https://github.com/ndmen/booking`');
    expect(report).toContain('**Target Ref:** `main`');
    expect(report).toContain('## Requirement');
    expect(report).toContain('> Allow users to cancel paid bookings and receive refund.');
  });

  it('excludes REJECTED insights and adds a note', () => {
    const insights = [
      {
        insightType: 'CLAIM',
        reviewStatus: 'REJECTED',
        certainty: 'EVIDENCED',
        title: 'This should be excluded',
        description: 'This should be excluded',
        evidenceLinks: [],
      },
      {
        insightType: 'CLAIM',
        reviewStatus: 'CONFIRMED',
        certainty: 'EVIDENCED',
        title: 'This should be included',
        description: 'This should be included',
        evidenceLinks: [],
      },
    ] as unknown as any[];

    const report = builder.build({
      analysis: mockAnalysis,
      insights,
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    expect(report).not.toContain('This should be excluded');
    expect(report).toContain('This should be included');
    expect(report).toContain('> Rejected insights are excluded from this approved report.');
  });

  it('groups insights correctly into sections', () => {
    const insights = [
      { insightType: 'CLAIM', title: 'Claim 1', description: 'Claim 1 desc', certainty: 'EVIDENCED', reviewStatus: 'CONFIRMED', evidenceLinks: [] },
      { insightType: 'QA_SCENARIO', title: 'QA 1', description: 'Given X When Y Then Z', certainty: 'INFERRED', reviewStatus: 'CONFIRMED', evidenceLinks: [] },
      { insightType: 'QUESTION', title: 'Question 1', description: 'Question 1 desc', certainty: 'UNKNOWN', reviewStatus: 'CONFIRMED', evidenceLinks: [] },
      { insightType: 'UNKNOWN', title: 'Unknown 1', description: 'Unknown 1 desc', certainty: 'UNKNOWN', reviewStatus: 'CONFIRMED', evidenceLinks: [] },
      { insightType: 'ACCEPTANCE_CRITERIA', title: 'AC 1', description: 'AC 1 desc', certainty: 'INFERRED', reviewStatus: 'CONFIRMED', evidenceLinks: [] },
    ] as unknown as any[];

    const report = builder.build({
      analysis: mockAnalysis,
      insights,
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    // Sections should exist
    expect(report).toContain('## Evidence-backed Impacts');
    expect(report).toContain('## QA Scenarios');
    expect(report).toContain('## Open Questions / Unknowns');
    expect(report).toContain('## Acceptance Criteria');

    // Items should be in right places
    expect(report).toContain('Claim 1 desc');
    expect(report).toContain('- **Given:** X');
    expect(report).toContain('- **When:** Y');
    expect(report).toContain('- **Then:** Z');
    expect(report).toContain('Question 1 desc');
    expect(report).toContain('Unknown 1 desc');
    expect(report).toContain('AC 1 desc');

    // QA Scenario formatting
    expect(report).not.toContain('| Scenario | Precondition | Action | Expected Result |');
    expect(report).toContain('- **Given:** X');
  });

  it('handles missing evidence gracefully', () => {
    const insights = [
      {
        insightType: 'CLAIM',
        reviewStatus: 'CONFIRMED',
        certainty: 'EVIDENCED',
        title: 'Claim with no evidence',
        description: 'Claim with no evidence desc',
        evidenceLinks: [],
      },
    ] as unknown as any[];

    const report = builder.build({
      analysis: mockAnalysis,
      insights,
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    expect(report).toContain('_No evidence attached._');
  });

  it('renders evidence appendix when evidence exists', () => {
    const insights = [
      {
        insightType: 'CLAIM',
        reviewStatus: 'CONFIRMED',
        certainty: 'EVIDENCED',
        title: 'Claim with evidence',
        description: 'Claim with evidence desc',
        evidenceLinks: [
          {
            evidence: {
              id: 'ev-1',
              sourcePath: 'src/app.ts',
              startLine: 1,
              endLine: 5,
              excerpt: 'console.log("hello");',
            },
          },
        ],
      },
    ] as unknown as any[];

    const report = builder.build({
      analysis: mockAnalysis,
      insights,
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    expect(report).toContain('## Evidence Appendix');
    expect(report).toContain('### `app.ts`');
    expect(report).toContain('**File:** `src/app.ts`');
    expect(report).toContain('**Lines:** 1–5');
    expect(report).toContain('console.log("hello");');
    expect(report).toContain('> Secrets were redacted');
  });

  it('renders Vietnamese report chrome while preserving raw evidence and source text', () => {
    const viAnalysis = {
      ...mockAnalysis,
      metadata: {
        domainPack: {
          id: 'booking',
          version: '0.1.0',
          status: 'STABLE',
          selectedBy: 'REPOSITORY_PROFILE',
        },
      },
      snapshot: {
        ...mockAnalysis.snapshot,
        profile: { domain: 'BOOKING' },
      },
    };
    const rawEvidence = 'booking.status = BookingStatus.CANCELLED;';

    const report = builder.build({
      locale: 'vi',
      analysis: viAnalysis,
      insights: [
        {
          insightType: 'CLAIM',
          reviewStatus: 'CONFIRMED',
          certainty: 'EVIDENCED',
          title: 'Booking reaches CANCELLED status',
          description: 'Booking reaches CANCELLED status',
          evidenceLinks: [
            {
              evidence: {
                id: 'ev-vi-1',
                sourcePath: 'src/booking/booking.service.ts',
                startLine: 12,
                endLine: 14,
                excerpt: rawEvidence,
              },
            },
          ],
        },
      ] as unknown as any[],
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    expect(report).toContain('# Báo cáo phân tích tác động: Paid booking cancellation refund');
    expect(report).toContain('## Yêu cầu');
    expect(report).toContain('## Thuật ngữ domain');
    expect(report).toContain('- refund: hoàn tiền');
    expect(report).toContain('## Tác động có bằng chứng');
    expect(report).toContain('## Phụ lục bằng chứng');
    expect(report).toContain('**File:** `src/booking/booking.service.ts`');
    expect(report).toContain(rawEvidence);
    expect(report).toContain('> Allow users to cancel paid bookings and receive refund.');
  });

  it('renders terminology from the selected domain pack glossary', () => {
    const viAnalysis = {
      ...mockAnalysis,
      metadata: {
        domainPack: {
          id: 'rental',
          version: '0.1.0',
          status: 'PARTIAL',
          selectedBy: 'EXPLICIT',
        },
      },
      snapshot: {
        ...mockAnalysis.snapshot,
        profile: { domain: 'UNKNOWN' },
      },
    };

    const report = builder.build({
      locale: 'vi',
      analysis: viAnalysis,
      insights: [],
      traceabilityLinks: [],
      hasUnreviewedItems: false,
    });

    expect(report).toContain('## Thuật ngữ domain');
    expect(report).toContain('- rentalContract: hợp đồng thuê phòng');
    expect(report).toContain('- deposit: tiền cọc');
    expect(report).not.toContain('- refund: hoàn tiền');
  });

  it('adds unreviewed acknowledged note if hasUnreviewedItems is true', () => {
    const report = builder.build({
      analysis: mockAnalysis,
      insights: [],
      traceabilityLinks: [],
      hasUnreviewedItems: true,
    });

    expect(report).toContain('> This report was finalized with unreviewed items acknowledged.');
  });

  it('uses universalKind fallback in impacted area labels', () => {
    const report = builder.build({
      analysis: mockAnalysis,
      insights: [],
      traceabilityLinks: [
        {
          id: 'link-1',
          reviewStatus: 'CONFIRMED',
          artifact: {
            id: 'artifact-1',
            name: 'BookingAggregate',
            artifactType: 'CLASS',
            universalKind: 'DATA_MODEL',
            filePath: 'src/booking.aggregate.ts',
          },
        },
      ] as unknown as any[],
      hasUnreviewedItems: false,
    });

    expect(report).toContain('The primary impacted areas are **data model** layers.');
    expect(report).toContain('- `BookingAggregate` in `src/booking.aggregate.ts` — **Confirmed**');
  });

  it('includes a provenance block when metadata is provided', () => {
    const report = builder.build({
      analysis: mockAnalysis,
      insights: [],
      traceabilityLinks: [],
      hasUnreviewedItems: false,
      metadata: {
        analysisId: 'analysis-1',
        title: 'Paid booking cancellation refund',
        projectId: 'project-1',
        repositoryId: 'repo-1',
        targetRef: 'main',
        commitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
        snapshotId: 'snapshot-1',
        analyzerVersion: '1.0.0',
        generatedDocumentId: 'document-1',
        generatedAt: '2026-06-06T00:00:00.000Z',
        finalizedAt: '2026-06-06T00:00:00.000Z',
        staleStatusAtReadTime: false,
      },
    });

    expect(report).toContain('## Provenance');
    expect(report).toContain('Generated Document ID: `document-1`');
    expect(report).toContain('Project ID: `project-1`');
    expect(report).toContain('Snapshot ID: `snapshot-1`');
    expect(report).toContain('Analyzer Version: `1.0.0`');
  });

  describe('Scanner Capability Profile & Diagnostics', () => {
    it('renders capability profile and diagnostics when present', () => {
      const goAnalysis = {
        ...mockAnalysis,
        snapshot: {
          ...mockAnalysis.snapshot,
          diagnostics: [
            {
              code: 'SCANNER_CAPABILITY_SUMMARY',
              message: 'Scanner capability profile injected',
              severity: 'INFO',
              category: 'SCANNER',
              payload: {
                language: 'go',
                status: 'EXPERIMENTAL',
                confidence: 'LOW',
              },
            },
            {
              code: 'GO_DYNAMIC_ROUTE_UNSUPPORTED',
              message: 'Dynamic route variables are not supported',
              severity: 'WARN',
              category: 'SCANNER',
            },
          ] as unknown as any,
        },
      } as unknown as any;

      const report = builder.build({
        analysis: goAnalysis,
        insights: [],
        traceabilityLinks: [
          {
            id: 'link-1',
            reviewStatus: 'CONFIRMED',
            artifact: {
              id: 'artifact-1',
              name: 'UNKNOWN /api/v1/payment -> updatePaymentHandler',
              artifactType: 'HTTP_ENDPOINT',
              universalKind: 'HTTP_ENDPOINT',
              filePath: 'src/main.go',
              stableId: 'go_http_endpoint__net_http__UNKNOWN__route_hash__handler',
            },
          },
        ] as unknown as any[],
        hasUnreviewedItems: false,
      });

      // Assert section headers
      expect(report).toContain('## Scanner Capability Profile');
      expect(report).toContain('## Scanner Diagnostics & Risks');

      // Assert Capability details
      expect(report).toContain('- **Language:** go');
      expect(report).toContain('- **Maturity Status:** EXPERIMENTAL');
      expect(report).toContain('- **Confidence Level:** LOW');

      // Assert Diagnostics details
      expect(report).toContain('- **GO_DYNAMIC_ROUTE_UNSUPPORTED**: Dynamic route variables are not supported');

      // Assert Artifact labels
      // 1. EXPERIMENTAL flag (derived from capability summary payload)
      // 2. [Method: UNKNOWN] flag
      expect(report).toContain('`UNKNOWN /api/v1/payment -> updatePaymentHandler` (EXPERIMENTAL) **[Method: UNKNOWN]**');
    });

    it('renders diagnostic-derived UNKNOWN risks in Open Questions and not in Impacted Artifacts', () => {
      const insights = [
        {
          insightType: 'UNKNOWN',
          title: 'Unsupported Scanner Pattern in main.go',
          description: 'Unsupported Router Group',
          certainty: 'UNKNOWN',
          reviewStatus: 'CONFIRMED',
          evidenceLinks: [],
          metadata: {
            origin: 'SCANNER_DIAGNOSTIC',
            evidenceMode: 'DIAGNOSTIC_ONLY',
            diagnosticPayload: {
              relativePath: 'main.go',
              candidateTerms: ['refunds'],
            },
          },
        },
      ] as unknown as any[];

      const report = builder.build({
        analysis: mockAnalysis,
        insights,
        traceabilityLinks: [],
        hasUnreviewedItems: false,
      });

      // It should be in Open Questions / Unknowns
      expect(report).toContain('## Open Questions / Unknowns');
      expect(report).toContain('Unsupported Scanner Pattern in main.go');
      expect(report).toContain('Unsupported Router Group');
      expect(report).toContain('_Derived from scanner diagnostic_');

      // It should NOT be in Impacted Artifacts
      expect(report).not.toContain('## Impacted Artifacts');
    });

    it('does not crash when insight metadata is null', () => {
      const insights = [
        {
          insightType: 'UNKNOWN',
          title: 'Old unknown insight',
          description: 'No metadata available',
          certainty: 'UNKNOWN',
          reviewStatus: 'CONFIRMED',
          evidenceLinks: [],
          metadata: null,
        },
      ] as unknown as any[];

      expect(() => {
        builder.build({
          analysis: mockAnalysis,
          insights,
          traceabilityLinks: [],
          hasUnreviewedItems: false,
        });
      }).not.toThrow();
    });
  });

  describe('Evidence Quality & Dataset Readiness', () => {
    it('renders Evidence Quality section with table and summary when traceability links exist', () => {
      const links = [
        {
          id: 'link-1',
          linkType: 'AFFECTED',
          linkBasis: 'EVIDENCED',
          reviewStatus: 'CONFIRMED',
          retrievalMetadata: { semanticScore: 0.9 },
          artifact: {
            id: 'art-1',
            filePath: 'src/app.ts',
            name: 'AppModule',
          },
          evidenceLinks: [
            {
              evidence: {
                sourceType: 'CODE',
                artifactId: 'art-1',
                sourcePath: 'src/app.ts',
                excerpt: 'export class AppModule configures booking cancellation providers',
                startLine: 1,
                endLine: 2,
              }
            }
          ]
        },
        {
          id: 'link-2',
          linkType: 'AFFECTED',
          linkBasis: 'INFERRED',
          reviewStatus: 'NEEDS_REVIEW',
          retrievalMetadata: {},
          artifact: {
            id: 'art-2',
            filePath: 'src/main.ts',
            name: 'main',
          },
          evidenceLinks: []
        }
      ] as unknown as any[];

      const report = builder.build({
        analysis: mockAnalysis,
        insights: [],
        traceabilityLinks: links,
        hasUnreviewedItems: true,
      });

      expect(report).toContain('## Evidence Quality & Dataset Readiness');
      expect(report).toContain('- Strong source evidence: 1');
      expect(report).toContain('- Weak source evidence: 0');
      expect(report).toContain('- Inferred from structure: 0'); // Because link-2 is REVIEW_REQUIRED (precedence override)
      expect(report).toContain('- Review required: 1');
      
      expect(report).toContain('| Artifact | Quality | Reason |');
      expect(report).toMatch(/\| `src\/app\.ts` \| STRONG_SOURCE_EVIDENCE \| .*hasPersistedEvidence.*hasSourceEvidence.*hasArtifactLink.*hasLineRange.*hasSpecificExcerpt.* \|/);
      expect(report).toMatch(/\| `src\/main\.ts` \| REVIEW_REQUIRED \| .*reviewRequired.* \|/);
    });

    it('omits Evidence Quality section when no traceability links exist', () => {
      const report = builder.build({
        analysis: mockAnalysis,
        insights: [],
        traceabilityLinks: [],
        hasUnreviewedItems: false,
      });

      expect(report).not.toContain('## Evidence Quality & Dataset Readiness');
    });
  });

  describe('Evaluation Context', () => {
    it('omits Evaluation Context when adapter returns null', () => {
      evalContextAdapter.getEvaluationContext.mockReturnValue(null);
      const report = builder.build({
        analysis: mockAnalysis,
        insights: [],
        traceabilityLinks: [],
        hasUnreviewedItems: false,
      });

      expect(report).not.toContain('## Evaluation Context');
    });

    it('appends Evaluation Context when adapter returns context', () => {
      evalContextAdapter.getEvaluationContext.mockReturnValue({
        datasetVersion: 'v0',
        subsetId: 'clean-vector-ready-v0',
        subsetSize: '1/6',
        interpretation: 'ILLUSTRATIVE_ONLY',
        knownLimits: ['Limit A'],
        evidenceQualityNotes: ['Note B'],
        datasetExpansionRecommendations: ['Rec C'],
        researchFindingsArtifact: 'e13.json',
        sameSubsetComparisonArtifact: 'comp.json'
      });

      const report = builder.build({
        analysis: mockAnalysis,
        insights: [],
        traceabilityLinks: [],
        hasUnreviewedItems: false,
      });

      expect(report).toContain('## Evaluation Context');
      expect(report).toContain('**Dataset Version**: `v0`');
      expect(report).toContain('**Subset Size**: `1/6` (Illustrative Only)');
      expect(report).toContain('### Known Limits');
      expect(report).toContain('- Limit A');
      expect(report).toContain('### Evidence Quality Notes');
      expect(report).toContain('- Note B');
      expect(report).toContain('### Dataset Expansion Recommendations');
      expect(report).toContain('- Rec C');
    });
  });

  describe('Golden Characterization Snapshot', () => {
    it('matches the golden characterization snapshot for a full comprehensive report', () => {
      evalContextAdapter.getEvaluationContext.mockReturnValue({
        datasetVersion: 'v0-golden',
        subsetId: 'clean-vector-ready-v0',
        subsetSize: '1/6',
        interpretation: 'ILLUSTRATIVE_ONLY',
        knownLimits: ['Golden Limit A'],
        evidenceQualityNotes: ['Golden Note B'],
        datasetExpansionRecommendations: ['Golden Rec C'],
        researchFindingsArtifact: 'e13-golden.json',
        sameSubsetComparisonArtifact: 'comp-golden.json'
      });

      const goldenAnalysis = {
        ...mockAnalysis,
        snapshot: {
          ...mockAnalysis.snapshot,
          diagnostics: [
            {
              code: 'SCANNER_CAPABILITY_SUMMARY',
              message: 'Scanner capability profile injected',
              severity: 'INFO',
              category: 'SCANNER',
              payload: {
                language: 'typescript',
                framework: 'nestjs',
                status: 'STABLE',
                confidence: 'HIGH',
              },
            },
            {
              code: 'TS_DYNAMIC_IMPORT_UNSUPPORTED',
              message: 'Dynamic imports are not supported',
              severity: 'WARN',
              category: 'SCANNER',
            },
          ] as unknown as any,
        },
      } as unknown as any;

      const report = builder.build({
        analysis: goldenAnalysis,
        insights: [
          {
            id: 'insight-1',
            insightType: 'CLAIM',
            title: 'Golden Claim',
            description: 'This is a golden claim',
            certainty: 'EVIDENCED',
            reviewStatus: 'CONFIRMED',
            reasoning: 'Because it is golden',
            evidenceLinks: [
              {
                evidence: {
                  id: 'ev-golden-1',
                  sourcePath: 'src/golden.ts',
                  startLine: 10,
                  endLine: 12,
                  excerpt: 'const golden = true;',
                },
              },
            ],
          },
          {
            id: 'insight-2',
            insightType: 'QA_SCENARIO',
            title: 'Golden QA',
            description: 'Given golden When testing Then pass',
            certainty: 'INFERRED',
            reviewStatus: 'CONFIRMED',
            evidenceLinks: [],
          },
          {
            id: 'insight-3',
            insightType: 'UNKNOWN',
            title: 'Golden Unknown',
            description: 'Why is it golden?',
            certainty: 'UNKNOWN',
            reviewStatus: 'CONFIRMED',
            reasoning: 'Need to investigate',
            metadata: {
              origin: 'SCANNER_DIAGNOSTIC',
            },
            evidenceLinks: [],
          },
          {
            id: 'insight-4',
            insightType: 'ACCEPTANCE_CRITERIA',
            title: 'Golden AC',
            description: 'Must be golden',
            certainty: 'INFERRED',
            reviewStatus: 'CONFIRMED',
            evidenceLinks: [],
          },
        ] as unknown as any[],
        traceabilityLinks: [
          {
            id: 'link-golden-1',
            linkType: 'AFFECTED',
            linkBasis: 'EVIDENCED',
            reviewStatus: 'CONFIRMED',
            retrievalMetadata: { semanticScore: 0.99 },
            artifact: {
              id: 'art-golden-1',
              filePath: 'src/golden.ts',
              name: 'GoldenService',
              artifactType: 'CLASS',
              universalKind: 'SERVICE',
            },
            evidenceLinks: [
              {
                evidence: {
                  id: 'ev-golden-1',
                  sourcePath: 'src/golden.ts',
                  startLine: 10,
                  endLine: 12,
                  excerpt: 'const golden = true;',
                },
              },
            ],
          },
        ] as unknown as any[],
        reviewNotes: [
          {
            id: 'note-1',
            traceabilityLinkId: 'link-golden-1',
            body: 'Reviewed the golden link',
            createdAt: new Date('2026-01-01T12:00:00.000Z'),
          },
          {
            id: 'note-2',
            insightId: 'insight-1',
            body: 'Reviewed the golden claim',
            createdAt: new Date('2026-01-01T12:05:00.000Z'),
          },
        ] as unknown as any[],
        hasUnreviewedItems: true,
        dependencyEdges: [
          {
            fromId: 'art-golden-1',
            toId: 'art-golden-2',
            type: 'CALLS',
          },
        ] as unknown as any[],
        clarifications: [
          {
            id: 'clar-1',
            question: 'Is it golden?',
            status: 'ANSWERED',
            answer: 'Yes',
            reason: 'User requested',
          },
        ] as unknown as any[],
        reviewDecisions: [
          {
            id: 'decision-1',
            reviewedBy: 'John Doe',
            decision: 'APPROVED',
            note: 'Looks golden',
            createdAt: new Date('2026-01-01T13:00:00.000Z'),
          },
        ] as unknown as any[],
        diff: {
          baseAnalysisId: 'base-golden-1',
          summary: {
            addedImpacts: 1,
            removedImpacts: 0,
            resolvedUnknowns: 1,
            newUnknowns: 0,
            addedQaScenarios: 1,
          },
          addedArtifacts: [
            {
              name: 'GoldenAdded',
              artifactType: 'CLASS',
              filePath: 'src/added.ts',
            },
          ],
          removedArtifacts: [],
          resolvedUnknowns: [
            {
              statement: 'Resolved golden',
            },
          ],
          newUnknowns: [],
          addedQaScenarios: [
            {
              insightKey: 'QA-NEW',
              statement: 'New golden QA',
            },
          ],
        },
        metadata: {
          title: 'Paid booking cancellation refund',
          analysisId: 'analysis-demo-001',
          generatedDocumentId: 'doc-demo-001',
          projectId: 'project-demo-001',
          repositoryId: 'repo-demo-001',
          snapshotId: 'snapshot-demo-001',
          targetRef: 'main',
          commitSha: 'f26cd56837cd10a1c00bb89d74d97519abc6f732',
          analyzerVersion: '1.0.0',
          generatedAt: '2026-01-01T00:00:00.000Z',
          finalizedAt: '2026-01-01T00:00:00.000Z',
          staleStatusAtReadTime: false,
        },
      });

      // Semantic assertions to protect against blind approvals
      expect(report).toContain('# Impact Analysis Report: Paid booking cancellation refund');
      expect(report).toContain('## Provenance');
      expect(report).toContain('## Scanner Capability Profile');
      expect(report).toContain('## Scanner Diagnostics & Risks');
      expect(report).toContain('## Impact Flow Diagram');
      expect(report).toContain('## Executive Summary');
      expect(report).toContain('## Impacted Areas');
      expect(report).toContain('## Evidence-backed Impacts');
      expect(report).toContain('## Acceptance Criteria');
      expect(report).toContain('## QA Scenarios');
      expect(report).toContain('## Open Questions / Unknowns');
      expect(report).toContain('## Clarifications');
      expect(report).toContain('## Evidence Appendix');
      expect(report).toContain('## Review Decision History');
      expect(report).toContain('## Evidence Quality & Dataset Readiness');
      expect(report).toContain('## Evaluation Context');
      expect(report).toContain('## Impact Diff Snapshot');

      // Golden snapshot match
      expect(report).toMatchSnapshot();
    });
  });
});
