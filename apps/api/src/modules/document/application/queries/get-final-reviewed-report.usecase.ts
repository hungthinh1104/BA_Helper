import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';
import { AppError } from '@ba-helper/shared';
import { documentJobFailureCode, reportClarificationsSnapshotSchema } from '@ba-helper/contracts';
import { GetReviewCompletionUseCase } from '../../../traceability/application/get-review-completion.usecase';
import { FinalReviewedReportResponse } from '@ba-helper/contracts';
import { ApprovedReportContextReader } from './approved-report-context.reader';
import { DocumentRepository, DEFAULT_REPORT_LOCALE, ReportLocale, buildReportReviewCoverageSummaryFromSnapshot, readReportTestTrace } from "@ba-helper/backend-runtime";
import {
  findReviewCompletionMismatches,
  parseFrozenReportContent,
  reviewDecisionStatesMatch,
} from './reviewed-report-provenance';

@Injectable()
export class GetFinalReviewedReportUseCase {
  constructor(
    private readonly getReviewCompletion: GetReviewCompletionUseCase,
    private readonly documentRepository: DocumentRepository,
    private readonly contextReader: ApprovedReportContextReader,
  ) {}

  async execute(
    analysisId: string,
    params: { locale?: ReportLocale } = {},
  ): Promise<FinalReviewedReportResponse> {
    const locale = params.locale ?? DEFAULT_REPORT_LOCALE;
    const { completion, reviewDecisionsSnapshot } =
      await this.getReviewCompletion.executeWithReviewDecisions(analysisId);

    if (!completion.isComplete) {
      throw new AppError(
        'REVIEW_COMPLETION_REQUIRED' as any,
        'Impact analysis review is not complete',
        { blockingReasons: completion.blockingReasons },
      );
    }

    if (!completion.latestSnapshotId) {
      throw new AppError(
        'REVIEWED_SNAPSHOT_MISSING' as any,
        'Reviewed report snapshot is missing despite review completion indicating otherwise',
      );
    }

    const snapshot = await this.documentRepository.findReviewedReportSnapshotById(
      analysisId,
      completion.latestSnapshotId,
    );
    if (!snapshot) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'Review completion refers to a missing reviewed report snapshot.',
        { completionSnapshotId: completion.latestSnapshotId },
      );
    }

    const frozenContent = parseFrozenReportContent(snapshot);

    const reviewCoverageSummary = buildReportReviewCoverageSummaryFromSnapshot({
      reviewDecisionsSnapshot: frozenContent.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: frozenContent.evidenceQualitySummarySnapshot,
    });
    const mismatchedCompletionFields = findReviewCompletionMismatches(
      completion,
      reviewCoverageSummary.traceabilityLinks,
    );
    if (!reviewDecisionStatesMatch(reviewDecisionsSnapshot, frozenContent.reviewDecisionsSnapshot)) {
      mismatchedCompletionFields.push('reviewDecisionsSnapshot');
    }
    if (mismatchedCompletionFields.length > 0) {
      throw new AppError(
        'REPORT_PROVENANCE_MISMATCH',
        'Live review state no longer matches the frozen reviewed report snapshot.',
        { reportSnapshotId: snapshot.id, mismatchedCompletionFields },
      );
    }

    const markdown = await this.resolveSnapshotMarkdown(snapshot, locale);

    return {
      analysisId,
      snapshotId: snapshot.id,
      testTraceSnapshot: readReportTestTrace(snapshot.testTraceSnapshot, { analysisId }),
      clarificationsSnapshot: snapshot.clarificationsSnapshot == null
        ? null
        : reportClarificationsSnapshotSchema.parse(snapshot.clarificationsSnapshot),
      locale,
      markdown,
      createdAt: snapshot.createdAt.toISOString(),
      reviewCompletion: completion,
      reviewCoverageSummary,
      reviewDecisionsSnapshot: frozenContent.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: frozenContent.evidenceQualitySummarySnapshot,
      evaluationContextSnapshot: frozenContent.evaluationContextSnapshot,
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

    const localized = await this.documentRepository.findLocalizedReportArtifact(
      snapshot.approvedDocumentId,
      locale,
    );

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
      const completedJobs = await this.documentRepository.findCompletedJobsForApprovedReport(
        snapshot.analysisId,
        snapshot.approvedDocumentId,
      );
      if (completedJobs.some((job: { snapshotId: string }) => job.snapshotId !== snapshot.id)) {
        throw new AppError(
          'REPORT_PROVENANCE_MISMATCH',
          'The approved document was generated from a different reviewed snapshot.',
          { reportSnapshotId: snapshot.id, approvedDocumentId: snapshot.approvedDocumentId },
        );
      }

      const document = await this.documentRepository.findGeneratedDocumentById(snapshot.approvedDocumentId);
      if (document) {
        if (
          document.impactAnalysisId !== snapshot.analysisId ||
          (document.reviewedReportSnapshotId != null && document.reviewedReportSnapshotId !== snapshot.id) ||
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

    const job = await this.documentRepository.findLatestJobForSnapshot(snapshot.id);

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
          ...(job.error != null || job.status === DocumentJobStatus.FAILED
            ? { error: { code: documentJobFailureCode } }
            : {}),
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
