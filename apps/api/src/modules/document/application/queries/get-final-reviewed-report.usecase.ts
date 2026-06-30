import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';
import { AppError } from '@ba-helper/shared';
import { GetReviewCompletionUseCase } from '../../../traceability/application/get-review-completion.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './get-latest-reviewed-report-snapshot.usecase';
import { FinalReviewedReportResponse } from '@ba-helper/contracts';
import { PrismaService } from '../../../prisma/prisma.service';

import { DEFAULT_REPORT_LOCALE, ReportLocale } from '../render/report-localization';
import { buildReportReviewCoverageSummaryFromSnapshot } from '../report-review-coverage.summary';
import { ApprovedReportContextReader } from './approved-report-context.reader';

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

    const markdown = await this.resolveSnapshotMarkdown(snapshot, locale);
    const reviewCoverageSummary = buildReportReviewCoverageSummaryFromSnapshot({
      reviewDecisionsSnapshot: snapshot.reviewDecisionsSnapshot,
      evidenceQualitySummarySnapshot: snapshot.evidenceQualitySummarySnapshot,
    });

    return {
      analysisId,
      snapshotId: snapshot.id,
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

    const { sourceContentHash: currentHash } = await this.contextReader.readContext(snapshot.analysisId);
    if (localized.sourceContentHash !== currentHash) {
      throw new AppError('LOCALIZED_REPORT_OUT_OF_SYNC', `Localized report for ${locale} is out of sync. Please regenerate.`);
    }

    return localized.contentMarkdown;
  }

  private async resolveDefaultSnapshotMarkdown(snapshot: {
    id: string;
    approvedDocumentId: string | null;
    markdown: string | null;
  }) {
    if (snapshot.approvedDocumentId) {
      const document = await this.prisma.generatedDocument.findUnique({
        where: { id: snapshot.approvedDocumentId },
      });
      if (document) {
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

    if (!job && snapshot.markdown) {
      return snapshot.markdown;
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
