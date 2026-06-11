import { MergedMultiRepoReportDraftBuilder } from './merged-multi-repo-report-draft.builder';

describe('MergedMultiRepoReportDraftBuilder', () => {
  let builder: MergedMultiRepoReportDraftBuilder;

  beforeEach(() => {
    builder = new MergedMultiRepoReportDraftBuilder();
  });

  const baseParams = {
    runId: 'run-1',
    projectId: 'proj-1',
    requirementRevisionId: 'rev-1',
    requirementTitle: 'Test Req',
    requirementRawText: 'Do something',
    generatedAt: '2026-01-01T00:00:00Z',
    matrix: { rows: [] },
    reviewCoverage: {
      status: 'PASS' as const,
      summary: {
        acceptedRepositories: 1,
        totalRepositories: 1,
        impactedArtifacts: 0,
        uncoveredArtifacts: 0,
        risksWithoutQa: 0,
        warningGates: 0,
        blockingGates: 0,
      },
      gates: [],
    },
  };

  it('renders fallback when missing scan health', () => {
    const result = builder.build({
      ...baseParams,
      children: [
        {
          analysisId: 'a1',
          repositoryId: 'r1',
          repositoryDisplayName: 'repo-1',
          snapshotId: 's1',
          commitSha: 'c1',
          sourceTargetRef: 'main',
          latestReviewDecision: null,
          insights: [],
          traceabilityLinks: [],
        },
      ],
    });

    expect(result).toContain('#### Scan Health Summary');
    expect(result).toContain('- No scan health diagnostics available.');
  });

  it('renders Scan Health Summary with full/ready normalized', () => {
    const result = builder.build({
      ...baseParams,
      children: [
        {
          analysisId: 'a1',
          repositoryId: 'r1',
          repositoryDisplayName: 'repo-1',
          snapshotId: 's1',
          commitSha: 'c1',
          sourceTargetRef: 'main',
          latestReviewDecision: null,
          insights: [],
          traceabilityLinks: [],
          scanHealth: {
            coverageStatus: 'READY',
            scannerVersion: '0.2.0',
            scannedFileCount: 10,
            skippedFileCount: 0,
            artifactCount: 5,
          },
        },
      ],
    });

    expect(result).toContain('#### Scan Health Summary');
    expect(result).toContain('- **Coverage Status**: FULL');
    expect(result).toContain('- **Engine**: 0.2.0 / unknown');
    expect(result).toContain('- **Files**: 10 scanned, 0 skipped');
    expect(result).not.toContain('PARTIAL means');
  });

  it('renders PARTIAL advisory and sorts skippedSummary by count desc', () => {
    const result = builder.build({
      ...baseParams,
      children: [
        {
          analysisId: 'a1',
          repositoryId: 'r1',
          repositoryDisplayName: 'repo-1',
          snapshotId: 's1',
          commitSha: 'c1',
          sourceTargetRef: 'main',
          latestReviewDecision: null,
          insights: [],
          traceabilityLinks: [],
          scanHealth: {
            coverageStatus: 'PARTIAL',
            skippedSummary: {
              FILE_TOO_LARGE: 5,
              VENDOR_FILE: 100,
              UNKNOWN_REASON: 2,
            },
          },
        },
      ],
    });

    expect(result).toContain('#### Scan Health Summary');
    expect(result).toContain('- **Coverage Status**: PARTIAL');
    expect(result).toContain('> PARTIAL means the scanner completed with bounded skips');
    expect(result).toContain('**Top Skip Reasons**');
    
    // Vendor should come before File Too Large
    const vendorIdx = result.indexOf('Vendor dependencies');
    const sizeIdx = result.indexOf('Files too large');
    const unknownIdx = result.indexOf('UNKNOWN_REASON');
    
    expect(vendorIdx).toBeGreaterThan(-1);
    expect(sizeIdx).toBeGreaterThan(vendorIdx);
    expect(unknownIdx).toBeGreaterThan(sizeIdx);
  });
});
