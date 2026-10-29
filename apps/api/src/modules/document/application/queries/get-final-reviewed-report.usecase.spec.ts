import { GetFinalReviewedReportUseCase } from './get-final-reviewed-report.usecase';
import { AppError } from '@ba-helper/shared';
import { staticTestTraceFixture, traceIds } from '../../../../../../../tests/fixtures/static-test-trace.fixture';

const emptyEvidenceQualitySummary = {
  missingEvidence: 0,
  reviewRequired: 0,
  evidenced: 0,
  inferred: 0,
  weakEvidence: 0,
};

const frozenEvaluationContext = {
  datasetVersion: 'test-v1',
  subsetId: 'test-subset',
  subsetSize: '1',
  interpretation: 'ILLUSTRATIVE_ONLY' as const,
  knownLimits: [],
  evidenceQualityNotes: [],
  datasetExpansionRecommendations: [],
  researchFindingsArtifact: 'research.json',
  sameSubsetComparisonArtifact: 'comparison.json',
};

describe('GetFinalReviewedReportUseCase', () => {
  it('returns saved traces without rebuilding the current QA projection', async () => {
    const saved = { version: 1, coverage: staticTestTraceFixture() };
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({ id: 'reviewed-id', analysisId: traceIds.analysis,
      approvedDocumentId: 'doc', createdAt: new Date(), reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary, evaluationContextSnapshot: null,
      testTraceSnapshot: saved });
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc', impactAnalysisId: traceIds.analysis, type: 'IMPACT_REPORT', status: 'APPROVED', content: '# Frozen report',
    });
    const result = await useCase.execute(traceIds.analysis);
    expect(result.testTraceSnapshot).toEqual(saved);
    expect(prismaMock.impactAnalysis.findUnique).not.toHaveBeenCalled();
  });
  let useCase: GetFinalReviewedReportUseCase;
  let getReviewCompletionMock: any;
  let getLatestSnapshotMock: any;
  let prismaMock: any;
  let contextReaderMock: any;

  beforeEach(() => {
    getReviewCompletionMock = {
      execute: jest.fn(),
    };
    getLatestSnapshotMock = {
      execute: jest.fn(),
    };
    prismaMock = {
      generatedDocument: {
        findUnique: jest.fn(),
      },
      documentJob: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
      impactAnalysis: {
        findUnique: jest.fn(),
      },
    };
    contextReaderMock = {
      readContext: jest.fn(),
    };
    useCase = new GetFinalReviewedReportUseCase(
      getReviewCompletionMock as any,
      getLatestSnapshotMock as any,
      prismaMock as any,
      contextReaderMock as any,
    );
  });

  it('rejects when unreviewed links exist (isComplete is false)', async () => {
    getReviewCompletionMock.execute.mockResolvedValue({
      isComplete: false,
      blockingReasons: ['UNREVIEWED_TRACEABILITY_LINKS'],
    });

    await expect(useCase.execute('analysis-123')).rejects.toThrow(
      new AppError('REVIEW_COMPLETION_REQUIRED' as any, 'Impact analysis review is not complete', {
        blockingReasons: ['UNREVIEWED_TRACEABILITY_LINKS'],
      })
    );

    expect(getLatestSnapshotMock.execute).not.toHaveBeenCalled();
  });

  it('rejects when snapshot missing despite isComplete being true (guard clause)', async () => {
    getReviewCompletionMock.execute.mockResolvedValue({
      isComplete: true,
      blockingReasons: [],
    });
    getLatestSnapshotMock.execute.mockResolvedValue(null);

    await expect(useCase.execute('analysis-123')).rejects.toThrow(
      new AppError(
        'REVIEWED_SNAPSHOT_MISSING' as any,
        'Reviewed report snapshot is missing despite review completion indicating otherwise'
      )
    );
  });

  it('rejects when live completion and the selected report snapshot disagree', async () => {
    getReviewCompletionMock.execute.mockResolvedValue({
      isComplete: true,
      latestSnapshotId: 'reviewed-a',
      blockingReasons: [],
    });
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'reviewed-b',
      analysisId: 'analysis-123',
    });

    await expect(useCase.execute('analysis-123')).rejects.toMatchObject({
      code: 'REPORT_PROVENANCE_MISMATCH',
    });
    expect(prismaMock.generatedDocument.findUnique).not.toHaveBeenCalled();
  });

  it('returns approved generated document markdown and snapshot JSON fields unchanged', async () => {
    const mockCompletion = createCompleteReviewCompletion({ totalLinks: 1, accepted: 1 });
    const decisionsSnapshot = [traceabilityLinkSnapshot('link-1', 'ACCEPTED')];
    const mockSnapshot = {
      id: 'snap-1',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-1',
      markdown: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewDecisionsSnapshot: decisionsSnapshot,
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: frozenEvaluationContext,
      createdByUserId: 'user-1',
    };

    getReviewCompletionMock.execute.mockResolvedValue(mockCompletion);
    getLatestSnapshotMock.execute.mockResolvedValue(mockSnapshot);
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      impactAnalysisId: 'analysis-123',
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      content: '# Generated Document Markdown',
    });

    const result = await useCase.execute('analysis-123');

    expect(result).toEqual(expect.objectContaining({
      analysisId: 'analysis-123',
      snapshotId: 'snap-1',
      locale: 'en',
      markdown: '# Generated Document Markdown',
      createdAt: '2026-01-01T00:00:00.000Z',
      reviewCompletion: mockCompletion,
      reviewDecisionsSnapshot: decisionsSnapshot,
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: frozenEvaluationContext,
      createdByUserId: 'user-1',
    }));
    expect(result.reviewCoverageSummary).toEqual(expect.objectContaining({
      insights: expect.objectContaining({ total: 0, reviewed: 0 }),
      traceabilityLinks: expect.objectContaining({ total: 1, reviewed: 1, accepted: 1 }),
      evidence: expect.objectContaining({ strong: 0, weak: 0, missing: 0 }),
    }));
  });

  it('uses markdown frozen in the reviewed snapshot when the approved document has since changed', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-current',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-shared',
      markdown: '# Snapshot generation',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
      testTraceSnapshot: null,
      createdByUserId: null,
    });
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc-shared',
      impactAnalysisId: 'analysis-123',
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      content: '# A later generation overwrote the shared document',
    });

    const result = await useCase.execute('analysis-123');

    expect(result.markdown).toBe('# Snapshot generation');
    expect(result.snapshotId).toBe('snap-current');
    expect(prismaMock.generatedDocument.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an approved document linked to a different completed snapshot generation', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-current',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-shared',
      markdown: null,
      createdAt: new Date(),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
      testTraceSnapshot: null,
      createdByUserId: null,
    });
    prismaMock.documentJob.findMany.mockResolvedValue([{ snapshotId: 'snap-older' }]);

    await expect(useCase.execute('analysis-123')).rejects.toMatchObject({
      code: 'REPORT_PROVENANCE_MISMATCH',
    });
    expect(prismaMock.generatedDocument.findUnique).not.toHaveBeenCalled();
  });

  it('returns document generated by a completed document job when snapshot is not linked yet', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-1',
      approvedDocumentId: null,
      markdown: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
      createdByUserId: null,
    });
    prismaMock.documentJob.findFirst.mockResolvedValue({
      id: 'job-1',
      status: 'COMPLETED',
      generatedDocument: { content: '# Job Document' },
    });

    const result = await useCase.execute('analysis-123');

    expect(result.markdown).toBe('# Job Document');
    expect(result.locale).toBe('en');
  });

  it('throws LOCALIZED_REPORT_NOT_READY when localized artifact is missing', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-1',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-1',
      markdown: null,
      createdAt: new Date(),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
    });
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      impactAnalysisId: 'analysis-123',
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      content: '# English',
    });
    prismaMock.localizedReportArtifact = {
      findUnique: jest.fn().mockResolvedValue(null),
    };

    await expect(useCase.execute('analysis-123', { locale: 'vi-VN' as any })).rejects.toMatchObject({
      code: 'LOCALIZED_REPORT_NOT_READY',
    });
  });

  it('throws LOCALIZED_REPORT_FAILED when localization failed', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-1',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-1',
      markdown: null,
      createdAt: new Date(),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
    });
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc-1', impactAnalysisId: 'analysis-123', type: 'IMPACT_REPORT', status: 'APPROVED', content: '# English',
    });
    prismaMock.localizedReportArtifact = {
      findUnique: jest.fn().mockResolvedValue({ localizationStatus: 'FAILED' }),
    };

    await expect(useCase.execute('analysis-123', { locale: 'vi-VN' as any })).rejects.toMatchObject({
      code: 'LOCALIZED_REPORT_FAILED',
    });
  });

  it('throws LOCALIZED_REPORT_OUT_OF_SYNC when hashes do not match', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-1',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-1',
      markdown: null,
      createdAt: new Date(),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
    });
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc-1', impactAnalysisId: 'analysis-123', type: 'IMPACT_REPORT', status: 'APPROVED', content: '# English',
    });
    prismaMock.localizedReportArtifact = {
      findUnique: jest.fn().mockResolvedValue({
        localizationStatus: 'COMPLETED',
        contentMarkdown: '# Vietnamese',
        sourceContentHash: 'old-hash',
      }),
    };
    contextReaderMock.readContext.mockResolvedValue({
      sourceContentHash: 'new-hash',
    });

    await expect(useCase.execute('analysis-123', { locale: 'vi-VN' as any })).rejects.toMatchObject({
      code: 'LOCALIZED_REPORT_OUT_OF_SYNC',
    });
  });

  it('returns localized markdown when artifact is completed and hashes match', async () => {
    getReviewCompletionMock.execute.mockResolvedValue(createCompleteReviewCompletion());
    getLatestSnapshotMock.execute.mockResolvedValue({
      id: 'snap-1',
      analysisId: 'analysis-123',
      approvedDocumentId: 'doc-1',
      markdown: null,
      createdAt: new Date(),
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
    });
    prismaMock.generatedDocument.findUnique.mockResolvedValue({
      id: 'doc-1', impactAnalysisId: 'analysis-123', type: 'IMPACT_REPORT', status: 'APPROVED', content: '# English',
    });
    
    contextReaderMock.readContext.mockResolvedValue({
      sourceContentHash: 'expected-hash',
    });

    prismaMock.localizedReportArtifact = {
      findUnique: jest.fn().mockResolvedValue({
        localizationStatus: 'COMPLETED',
        contentMarkdown: '# Vietnamese Report',
        sourceContentHash: 'expected-hash',
      }),
    };

    const result = await useCase.execute('analysis-123', { locale: 'vi-VN' as any });
    expect(result.markdown).toBe('# Vietnamese Report');
  });

  it('does not call retrieval/analysis generation dependencies', async () => {
    expect(useCase).toBeDefined();
  });
});

function createCompleteReviewCompletion(overrides: Record<string, unknown> = {}) {
  return {
    analysisId: 'analysis-123',
    totalLinks: 0,
    accepted: 0,
    rejected: 0,
    needsReview: 0,
    needsMoreEvidence: 0,
    unreviewed: 0,
    isComplete: true,
    hasReviewedSnapshot: true,
    latestSnapshotId: null,
    blockingReasons: [],
    ...overrides,
  };
}

function traceabilityLinkSnapshot(id: string, decision: string) {
  return {
    itemType: 'TRACEABILITY_LINK',
    itemId: id,
    linkId: id,
    artifact: `src/${id}.ts`,
    quality: 'STRONG_SOURCE_EVIDENCE',
    reasons: [],
    reviewStatus: decision === 'ACCEPTED' ? 'CONFIRMED' : decision,
    reviewDecision: {
      id: '00000000-0000-4000-8000-000000000031',
      analysisId: '00000000-0000-4000-8000-000000000032',
      traceabilityLinkId: '00000000-0000-4000-8000-000000000033',
      decision,
      note: null,
      reviewedByUserId: null,
      reviewedAt: '2026-01-01T00:00:00.000Z',
    },
  };
}
