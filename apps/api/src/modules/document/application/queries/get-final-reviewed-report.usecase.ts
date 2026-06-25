import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';
import { AppError } from '@ba-helper/shared';
import { GetReviewCompletionUseCase } from '../../../traceability/application/get-review-completion.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './get-latest-reviewed-report-snapshot.usecase';
import { FinalReviewedReportResponse } from '@ba-helper/contracts';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReviewedSnapshotReportContextAdapter } from '../render/reviewed-snapshot-report-context.adapter';
import { MarkdownImpactReportBuilder } from '../render/markdown-impact-report.builder';
import { DEFAULT_REPORT_LOCALE, ReportLocale } from '../render/report-localization';

@Injectable()
export class GetFinalReviewedReportUseCase {
  constructor(
    private readonly getReviewCompletion: GetReviewCompletionUseCase,
    private readonly getLatestSnapshot: GetLatestReviewedReportSnapshotUseCase,
    private readonly prisma: PrismaService,
    private readonly contextAdapter: ReviewedSnapshotReportContextAdapter,
    private readonly reportBuilder: MarkdownImpactReportBuilder,
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

    return {
      analysisId,
      snapshotId: snapshot.id,
      locale,
      markdown,
      createdAt: snapshot.createdAt.toISOString(),
      reviewCompletion: completion,
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
  }, locale: ReportLocale) {
    const defaultMarkdown = await this.resolveDefaultSnapshotMarkdown(snapshot);
    if (locale === DEFAULT_REPORT_LOCALE) {
      return defaultMarkdown;
    }

    return this.renderLocalizedSnapshotMarkdown(snapshot, locale);
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

  private async renderLocalizedSnapshotMarkdown(snapshot: {
    id: string;
    analysisId: string;
  }, locale: ReportLocale) {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: snapshot.analysisId },
      include: {
        snapshot: { include: { repository: true, profile: true } },
        sourceTarget: true,
        requirementRevision: { include: { requirement: true } },
        insights: true,
      },
    });

    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    const context = await this.contextAdapter.buildContext(snapshot, analysis, locale);
    return this.reportBuilder.build(context);
  }
}
