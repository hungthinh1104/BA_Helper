import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';
import { AppError } from '../../../shared/app-error';
import { GetReviewCompletionUseCase } from '../../traceability/application/get-review-completion.usecase';
import { GetLatestReviewedReportSnapshotUseCase } from './get-latest-reviewed-report-snapshot.usecase';
import { FinalReviewedReportResponse } from '@ba-helper/contracts';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GetFinalReviewedReportUseCase {
  constructor(
    private readonly getReviewCompletion: GetReviewCompletionUseCase,
    private readonly getLatestSnapshot: GetLatestReviewedReportSnapshotUseCase,
    private readonly prisma: PrismaService,
  ) {}

  async execute(analysisId: string): Promise<FinalReviewedReportResponse> {
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

    const markdown = await this.resolveSnapshotMarkdown(snapshot);

    return {
      analysisId,
      snapshotId: snapshot.id,
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
