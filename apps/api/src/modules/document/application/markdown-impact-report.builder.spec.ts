import { MarkdownImpactReportBuilder } from './markdown-impact-report.builder';
import { MermaidImpactDiagramBuilder } from './mermaid-impact-diagram.builder';

describe('MarkdownImpactReportBuilder', () => {
  let builder: MarkdownImpactReportBuilder;
  let mermaidBuilder: jest.Mocked<MermaidImpactDiagramBuilder>;

  beforeEach(() => {
    mermaidBuilder = {
      build: jest.fn().mockReturnValue({ mermaid: '```mermaid\nflowchart TD\n```', isTruncated: false }),
    } as unknown as jest.Mocked<MermaidImpactDiagramBuilder>;
    
    builder = new MarkdownImpactReportBuilder(mermaidBuilder);
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
  } as unknown as import('@prisma/client').ImpactAnalysis & { requirementRevision: any, snapshot: any, sourceTarget: any };

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
    expect(report).toContain('| X | Y | Z |');
    expect(report).toContain('Question 1 desc');
    expect(report).toContain('Unknown 1 desc');
    expect(report).toContain('AC 1 desc');

    // QA Scenario table formatting
    expect(report).toContain('| Scenario | Precondition | Action | Expected Result |');
    expect(report).toContain('|---|---|---|---|');
    expect(report).toContain('| QA 1 | X | Y | Z |');
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

  it('adds unreviewed acknowledged note if hasUnreviewedItems is true', () => {
    const report = builder.build({
      analysis: mockAnalysis,
      insights: [],
      traceabilityLinks: [],
      hasUnreviewedItems: true,
    });

    expect(report).toContain('> This report was finalized with unreviewed items acknowledged.');
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
});
