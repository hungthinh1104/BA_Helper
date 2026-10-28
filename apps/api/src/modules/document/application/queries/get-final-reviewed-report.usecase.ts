import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';
import { AppError } from '@ba-helper/shared';
import { GetReviewCompletionUseCase } from '../../../traceability/application/get-review-completion.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './get-latest-reviewed-report-snapshot.usecase';
import { FinalReviewedReportResponse } from '@ba-helper/contracts';
import { ApprovedReportContextReader } from './approved-report-context.reader';
import { PrismaService, DEFAULT_REPORT_LOCALE, ReportLocale, buildReportReviewCoverageSummaryFromSnapshot, readReportTestTrace } from "@ba-helper/backend-runtime";

@Injectable()
export class GetFinalReviewedReportUseCase {
  constructor(
    private readonly getReviewCompletion: GetReviewCompletionUseCase,
    private readonly getLatestSnapshot: GetLatestReviewedReportSnapshotUseCase,
    private readonly prisma: PrismaService,
    private readonly contextReader: ApprovedReportContextReader,
  ) {}

  async execute(
    analysisId: string,
    params: { locale?: ReportLocale } = {},
  ): Promise<FinalReviewedReportResponse> {
    const locale = params.locale ?? DEFAULT_REPORT_LOCALE;
    const completion = await this.getReviewCompletion.execute(analysisId);

    if (!completion.isComplete) {
      throw new AppError(
        'REVIEW_COMPLETION_REQUIRED' as any,
        'Impact analysis review is not complete',
        { blockingReasons: completion.blockingReasons },
      );
    }

    const snapshot = await this.getLatestSnapshot.execute(analysisId);
    if (!snapshot) {
      throw new AppError(
        'REVIEWED_SNAPSHOT_MISSING' as any,
        'Reviewed report snapshot is missing despite review completion indicating otherwise',
      );
    }

    if (completion.latestSnapshotId && completion.latestSnapshotId !== snapshot.id) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'Review completion and final report refer to different reviewed snapshots.',
        { completionSnapshotId: completion.latestSnapshotId, reportSnapshotId: snapshot.id },
      );
    }

    const reviewCoverageSummary = buildReportReviewCoverageSummaryFromSnapshot({
      reviewDecisionsSnapshot: snapshot.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: snapshot.evidenceQualitySummarySnapshot,
    });
    const mismatchedCompletionFields = findReviewCompletionMismatches(
      completion,
      reviewCoverageSummary.traceabilityLinks,
    );
    if (mismatchedCompletionFields.length > 0) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'Live review counts no longer match the frozen reviewed report snapshot.',
        { reportSnapshotId: snapshot.id, mismatchedCompletionFields },
      );
    }

    const markdown = await this.resolveSnapshotMarkdown(snapshot, locale);

    return {
      analysisId,
      snapshotId: snapshot.id,
      testTraceSnapshot: readReportTestTrace(snapshot.testTraceSnapshot, { analysisId }),
      locale,
      markdown,
      createdAt: snapshot.createdAt.toISOString(),
      reviewCompletion: completion,
      reviewCoverageSummary,
      reviewDecisionsSnapshot: snapshot.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: snapshot.evidenceQualitySummarySnapshot,
      evaluationContextSnapshot: snapshot.evaluationContextSnapshot,
      createdByUserId: snapshot.createdByUserId,
    };
  }

  private async resolveSnapshotMarkdown(snapshot: {
    id: string;
    analysisId: string;
    approvedDocumentId: string | null;
    markdown: string | null;
    reviewDecisionsSnapshot: any;
    evidenceQualitySummarySnapshot: any;
  }, locale: ReportLocale) {
    const defaultMarkdown = await this.resolveDefaultSnapshotMarkdown(snapshot);
    if (locale === DEFAULT_REPORT_LOCALE) {
      return defaultMarkdown;
    }

    if (!snapshot.approvedDocumentId) {
      throw new AppError('LOCALIZED_REPORT_NOT_READY', 'The canonical report has not been approved yet.');
    }

    const localized = await this.prisma.localizedReportArtifact.findUnique({
      where: {
        sourceDocumentId_locale: {
          sourceDocumentId: snapshot.approvedDocumentId,
          locale,
        }
      }
    });

    if (!localized) {
      throw new AppError('LOCALIZED_REPORT_NOT_READY', `Localized report for ${locale} is not ready yet.`);
    }

    if (localized.localizationStatus === 'FAILED') {
      throw new AppError('LOCALIZED_REPORT_FAILED', `Localization failed for ${locale}. Please retry.`);
    }

    if (localized.localizationStatus !== 'COMPLETED' || !localized.contentMarkdown) {
      throw new AppError('LOCALIZED_REPORT_NOT_READY', `Localization for ${locale} is still in progress.`);
    }

    const { sourceContentHash: currentHash } = await this.contextReader.readContext(snapshot.analysisId, snapshot.id);
    if (localized.sourceContentHash !== currentHash) {
      throw new AppError('LOCALIZED_REPORT_OUT_OF_SYNC', `Localized report for ${locale} is out of sync. Please regenerate.`);
    }

    return localized.contentMarkdown;
  }

  private async resolveDefaultSnapshotMarkdown(snapshot: {
    id: string;
    analysisId: string;
    approvedDocumentId: string | null;
    markdown: string | null;
  }) {
    if (snapshot.markdown !== null) {
      return snapshot.markdown;
    }

    if (snapshot.approvedDocumentId) {
      const completedJobs = await this.prisma.documentJob.findMany({
        where: {
          analysisId: snapshot.analysisId,
          generatedDocumentId: snapshot.approvedDocumentId,
          status: DocumentJobStatus.COMPLETED,
        },
        select: { snapshotId: true },
      });
      if (completedJobs.some((job: { snapshotId: string }) => job.snapshotId !== snapshot.id)) {
        throw new AppError(
          'REPORT_PROVENANCE_MISMATCH',
          'The approved document was generated from a different reviewed snapshot.',
          { reportSnapshotId: snapshot.id, approvedDocumentId: snapshot.approvedDocumentId },
        );
      }

      const document = await this.prisma.generatedDocument.findUnique({
        where: { id: snapshot.approvedDocumentId },
        select: { id: true, impactAnalysisId: true, type: true, status: true, content: true },
      });
      if (document) {
        if (
          document.impactAnalysisId !== snapshot.analysisId ||
          document.type !== 'IMPACT_REPORT' ||
          document.status !== 'APPROVED'
        ) {
          throw new AppError(
            'REPORT_PROVENANCE_MISMATCH',
            'The reviewed snapshot points to a document outside its approved analysis report.',
            { reportSnapshotId: snapshot.id, approvedDocumentId: document.id },
          );
        }
        return document.content;
      }
    }

    const job = await this.prisma.documentJob.findFirst({
      where: {
        snapshotId: snapshot.id,
        documentType: 'IMPACT_REPORT',
      },
      orderBy: { updatedAt: 'desc' },
      include: { generatedDocument: true },
    });

    if (job?.status === DocumentJobStatus.COMPLETED && job.generatedDocument) {
      return job.generatedDocument.content;
    }

    if (job) {
      throw new AppError(
        'DOCUMENT_JOB_NOT_READY',
        'Final reviewed report document is not ready yet.',
        {
          documentJobId: job.id,
          status: job.status,
          failedAt: job.failedAt?.toISOString(),
          error: job.error,
        },
      );
    }

    throw new AppError(
      'DOCUMENT_JOB_NOT_READY',
      'Final reviewed report document has not been generated yet.',
      { status: 'MISSING' },
    );
  }

}

function findReviewCompletionMismatches(
  completion: {
    totalLinks: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    needsMoreEvidence: number;
    unreviewed: number;
  },
  snapshot: {
    total: number;
    accepted: number;
    rejected: number;
    needsReview: number;
    needsMoreEvidence: number;
    unreviewed: number;
  },
): string[] {
  const fields = [
    ['totalLinks', completion.totalLinks, snapshot.total],
    ['accepted', completion.accepted, snapshot.accepted],
    ['rejected', completion.rejected, snapshot.rejected],
    ['needsReview', completion.needsReview, snapshot.needsReview],
    ['needsMoreEvidence', completion.needsMoreEvidence, snapshot.needsMoreEvidence],
    ['unreviewed', completion.unreviewed, snapshot.unreviewed],
  ] as const;
  return fields
    .filter(([, liveCount, snapshotCount]) => liveCount !== snapshotCount)
    .map(([field]) => field);
}
