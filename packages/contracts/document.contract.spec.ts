import {
  approvedImpactReportResponseSchema,
  documentJobSchema,
  finalReviewedReportResponseSchema,
  multiRepoApprovedReportResponseSchema,
  reviewedReportSnapshotSchema,
} from './src';

const emptyEvidenceQualitySummary = {
  missingEvidence: 0,
  reviewRequired: 0,
  evidenced: 0,
  inferred: 0,
  weakEvidence: 0,
};

const reportSnapshot = {
  id: '00000000-0000-4000-8000-000000000021',
  analysisId: '00000000-0000-4000-8000-000000000022',
  reviewDecisionsSnapshot: [{
    itemType: 'TRACEABILITY_LINK',
    itemId: 'link-1',
    linkId: 'link-1',
    artifact: 'src/booking.service.ts:BookingService.cancel',
    quality: 'STRONG_SOURCE_EVIDENCE',
    reasons: ['persistedSourceEvidence'],
    reviewStatus: 'CONFIRMED',
    reviewDecision: null,
  }],
  evidenceQualitySummarySnapshot: {
    ...emptyEvidenceQualitySummary,
    strongSourceEvidence: 1,
    evidenced: 1,
  },
  evaluationContextSnapshot: null,
  createdAt: '2026-10-29T12:00:00.000Z',
};

const reviewCompletion = {
  analysisId: reportSnapshot.analysisId,
  totalLinks: 1,
  accepted: 1,
  rejected: 0,
  needsReview: 0,
  needsMoreEvidence: 0,
  unreviewed: 0,
  isComplete: true,
  hasReviewedSnapshot: true,
  blockingReasons: [],
};

describe('report domain pack provenance contracts', () => {
  it('accepts legacy single approved report domain provenance without digest fields', () => {
    const payload = {
      id: '00000000-0000-4000-8000-000000000001',
      impactAnalysisId: '00000000-0000-4000-8000-000000000002',
      requirementRevisionId: '00000000-0000-4000-8000-000000000003',
      snapshotId: '00000000-0000-4000-8000-000000000004',
      sourceTargetId: '00000000-0000-4000-8000-000000000005',
      type: 'IMPACT_REPORT',
      status: 'APPROVED',
      format: 'MARKDOWN',
      title: 'Refund report',
      markdown: '# Refund report',
      isStale: false,
      provenance: {
        analysisId: '00000000-0000-4000-8000-000000000002',
        projectId: '00000000-0000-4000-8000-000000000006',
        repositoryId: '00000000-0000-4000-8000-000000000007',
        targetRef: 'main',
        commitSha: 'abc123',
        snapshotId: '00000000-0000-4000-8000-000000000004',
        analyzerVersion: 'nestjs-ts/0.1.0',
        generatedDocumentId: '00000000-0000-4000-8000-000000000001',
        generatedAt: '2026-06-27T00:00:00.000Z',
        staleStatusAtReadTime: false,
        domainPack: {
          domainPackId: 'booking',
          domainPackVersion: '0.1.0',
          domainPackStatus: 'STABLE',
          selectedBy: 'EXPLICIT',
        },
      },
    };

    expect(approvedImpactReportResponseSchema.parse(payload)).toEqual(payload);
  });

  it('accepts legacy merged report domain provenance without digest fields', () => {
    const payload = {
      id: '00000000-0000-4000-8000-000000000011',
      runId: '00000000-0000-4000-8000-000000000012',
      projectId: '00000000-0000-4000-8000-000000000013',
      requirementRevisionId: '00000000-0000-4000-8000-000000000014',
      requirementTitle: 'Refund report',
      markdown: '# Merged report',
      approvedAt: '2026-06-27T00:00:00.000Z',
      mergedReportStatus: 'CURRENT',
      capabilities: {
        canFinalizeMergedReport: false,
        canRefreshMergedReport: false,
        canExportMergedReport: true,
        canReviewMergedReport: true,
        canOpenApprovedReport: true,
        blockedReasons: [],
      },
      isStale: false,
      provenance: {
        domainPack: {
          domainPackId: 'healthcare',
          domainPackVersion: '0.1.0',
          domainPackStatus: 'PARTIAL',
          selectedBy: 'EXPLICIT',
        },
        childAnalyses: [
          {
            analysisId: '00000000-0000-4000-8000-000000000015',
            latestReviewDecisionId: '00000000-0000-4000-8000-000000000016',
            snapshotId: '00000000-0000-4000-8000-000000000017',
            commitSha: 'abc123',
          },
        ],
      },
    };

    expect(multiRepoApprovedReportResponseSchema.parse(payload)).toEqual(payload);
  });
});

describe('document job response contract', () => {
  const baseJob = {
    id: '00000000-0000-4000-8000-000000000031',
    analysisId: '00000000-0000-4000-8000-000000000032',
    snapshotId: '00000000-0000-4000-8000-000000000033',
    documentType: 'IMPACT_REPORT' as const,
    status: 'FAILED' as const,
    progress: 0,
    attemptCount: 1,
    createdAt: '2026-10-29T12:00:00.000Z',
    updatedAt: '2026-10-29T12:00:00.000Z',
  };

  it('accepts only the stable public failure code and rejects persisted exception text', () => {
    expect(documentJobSchema.safeParse({
      ...baseJob,
      error: { code: 'DOCUMENT_GENERATION_FAILED' },
    }).success).toBe(true);
    expect(documentJobSchema.safeParse({
      ...baseJob,
      error: { message: 'redis://user:password@redis.invalid' },
    }).success).toBe(false);
  });
});

describe('reviewed report snapshot response contracts', () => {
  it('accepts the persisted evidence-quality snapshot shape', () => {
    expect(reviewedReportSnapshotSchema.parse(reportSnapshot)).toEqual(reportSnapshot);
    expect(finalReviewedReportResponseSchema.safeParse({
      analysisId: reportSnapshot.analysisId,
      snapshotId: reportSnapshot.id,
      locale: 'en',
      markdown: '# Frozen report',
      createdAt: reportSnapshot.createdAt,
      reviewCompletion,
      reviewDecisionsSnapshot: reportSnapshot.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: reportSnapshot.evidenceQualitySummarySnapshot,
      evaluationContextSnapshot: null,
      createdByUserId: null,
    }).success).toBe(true);
  });

  it('rejects malformed frozen decisions, quality summaries, and evaluation context', () => {
    for (const malformed of [
      { ...reportSnapshot, reviewDecisionsSnapshot: { silentlyOmitted: true } },
      { ...reportSnapshot, reviewDecisionsSnapshot: [{ artifact: 'missing quality and reasons' }] },
      { ...reportSnapshot, evidenceQualitySummarySnapshot: { EVIDENCED: 3 } },
      { ...reportSnapshot, evaluationContextSnapshot: { unsupported: 'shape' } },
    ]) {
      expect(reviewedReportSnapshotSchema.safeParse(malformed).success).toBe(false);
    }

    const malformedFinalReport = finalReviewedReportResponseSchema.safeParse({
      analysisId: reportSnapshot.analysisId,
      snapshotId: reportSnapshot.id,
      locale: 'en',
      markdown: '# Frozen report',
      createdAt: reportSnapshot.createdAt,
      reviewCompletion,
      reviewDecisionsSnapshot: [{ artifact: 'missing quality and reasons' }],
      evidenceQualitySummarySnapshot: emptyEvidenceQualitySummary,
      evaluationContextSnapshot: null,
      createdByUserId: null,
    });
    expect(malformedFinalReport.success).toBe(false);
  });

  it('validates the frozen clarification state and rejects unsupported statuses', () => {
    const clarification = {
      id: '00000000-0000-4000-8000-000000000024',
      question: 'When does the refund begin?',
      answer: null,
      status: 'OPEN',
      createdAt: '2026-10-29T12:00:00.000Z',
    };
    expect(reviewedReportSnapshotSchema.safeParse({
      ...reportSnapshot,
      clarificationsSnapshot: [clarification],
    }).success).toBe(true);
    expect(reviewedReportSnapshotSchema.safeParse({
      ...reportSnapshot,
      clarificationsSnapshot: [{ ...clarification, status: 'PENDING' }],
    }).success).toBe(false);
  });

  it('rejects a shape-valid decision array that contradicts the frozen quality counts', () => {
    const inconsistentSnapshot = reviewedReportSnapshotSchema.safeParse({
      ...reportSnapshot,
      reviewDecisionsSnapshot: [],
    });
    expect(inconsistentSnapshot.success).toBe(false);

    const inconsistentFinalReport = finalReviewedReportResponseSchema.safeParse({
      analysisId: reportSnapshot.analysisId,
      snapshotId: reportSnapshot.id,
      locale: 'en',
      markdown: '# Frozen report',
      createdAt: reportSnapshot.createdAt,
      reviewCompletion,
      reviewDecisionsSnapshot: [],
      evidenceQualitySummarySnapshot: reportSnapshot.evidenceQualitySummarySnapshot,
      evaluationContextSnapshot: null,
      createdByUserId: null,
    });
    expect(inconsistentFinalReport.success).toBe(false);
  });
});
