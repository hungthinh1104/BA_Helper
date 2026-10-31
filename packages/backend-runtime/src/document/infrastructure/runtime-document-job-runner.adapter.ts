import { Injectable } from '@nestjs/common';
import { DocumentJobStatus } from '@prisma/client';;
import { documentJobFailureCode } from '@ba-helper/contracts';
import {
  DocumentJobRunnerPort,
  type DocumentJobRunResult,
} from '@ba-helper/application/document';
import { PrismaService } from '../../prisma/prisma.service';
import { MarkdownImpactReportBuilder } from '../application/render/markdown-impact-report.builder';
import { InsightRepository } from '../../insight/infrastructure/insight.repository';
import { TraceabilityRepository } from '../../traceability/infrastructure/traceability.repository';
import { ReviewNoteRepository } from '../../impact-analysis/infrastructure/review-note.repository';
import { GraphRepository } from '../../graph/infrastructure/graph.repository';
import { ReviewClarificationRepository } from '../../impact-analysis/infrastructure/review-clarification.repository';
import { ReviewDecisionRepository } from '../../impact-analysis/infrastructure/review-decision.repository';
import { GetImpactDiffUseCase } from '../../impact-analysis/infrastructure/get-impact-diff.provider';
import { DocumentRepository } from './document.repository';
import { ReviewedSnapshotReportContextAdapter } from '../application/render/reviewed-snapshot-report-context.adapter';
import { AppError } from '@ba-helper/shared';
import { classifyWorkerError } from '@ba-helper/application/worker';

@Injectable()
export class RuntimeDocumentJobRunnerAdapter extends DocumentJobRunnerPort {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reportBuilder: MarkdownImpactReportBuilder,
    private readonly documentRepo: DocumentRepository,
    private readonly contextAdapter: ReviewedSnapshotReportContextAdapter,
  ) {
    super();
  }

  async run(params: {
    documentJobId: string;
    attemptNumber?: number;
    maxAttempts?: number;
  }): Promise<DocumentJobRunResult> {
    const docJob = await this.markRunning(params.documentJobId);
    if (docJob.status === DocumentJobStatus.COMPLETED && docJob.generatedDocumentId) {
      return { success: true, generatedDocumentId: docJob.generatedDocumentId };
    }

    try {
      const snapshot = await this.prisma.reviewedReportSnapshot.findUnique({
        where: { id: docJob.snapshotId },
      });
      if (!snapshot) {
        throw new AppError('SNAPSHOT_NOT_FOUND', 'Reviewed report snapshot not found.');
      }

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

      const context = await this.contextAdapter.buildContext(snapshot, analysis);
      const markdown = this.reportBuilder.build(context);
      const persistedReport = await this.publishReport({
        documentJobId: docJob.id,
        analysisId: analysis.id,
        snapshotId: snapshot.id,
        markdown,
      });

      return { success: true, generatedDocumentId: persistedReport.id };
    } catch (error) {
      const attemptNumber = params.attemptNumber ?? 1;
      const maxAttempts = params.maxAttempts ?? attemptNumber;
      const retryable = classifyWorkerError(error) === 'RETRYABLE';
      if (!retryable || attemptNumber >= maxAttempts) {
        await this.prisma.documentJob.updateMany({
          where: { id: docJob.id, status: DocumentJobStatus.RUNNING },
          data: {
            status: DocumentJobStatus.FAILED,
            error: { code: documentJobFailureCode },
            failedAt: new Date(),
          },
        });
      }
      throw error;
    }
  }

  private async markRunning(documentJobId: string) {
    const job = await this.prisma.documentJob.findUnique({
      where: { id: documentJobId },
    });

    if (!job) {
      throw new AppError('DOCUMENT_JOB_NOT_FOUND', 'Document job not found.');
    }

    if (job.status === DocumentJobStatus.COMPLETED && job.generatedDocumentId) {
      return job;
    }

    if (job.status !== DocumentJobStatus.QUEUED && job.status !== DocumentJobStatus.RUNNING) {
      throw new AppError('DOCUMENT_JOB_NOT_READY', 'Document job is not queued or running.', {
        status: job.status,
      });
    }

    const claim = await this.prisma.documentJob.updateMany({
      where: { id: documentJobId, status: job.status },
      data: {
        status: DocumentJobStatus.RUNNING,
        lastStartedAt: new Date(),
      },
    });

    if (claim.count > 0) {
      return { ...job, status: DocumentJobStatus.RUNNING };
    }

    const current = await this.prisma.documentJob.findUnique({
      where: { id: documentJobId },
    });
    if (current?.status === DocumentJobStatus.COMPLETED && current.generatedDocumentId) {
      return current;
    }
    if (current?.status === DocumentJobStatus.RUNNING) {
      return current;
    }

    throw new AppError('DOCUMENT_JOB_NOT_READY', 'Document job state changed before a worker could start.', {
      status: current?.status,
    });
  }

  private async publishReport(params: {
    documentJobId: string;
    analysisId: string;
    snapshotId: string;
    markdown: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.documentJob.updateMany({
        where: { id: params.documentJobId, status: DocumentJobStatus.RUNNING },
        data: {
          status: DocumentJobStatus.COMPLETED,
          progress: 100,
          completedAt: new Date(),
        },
      });

      if (claim.count === 0) {
        const currentJob = await tx.documentJob.findUnique({
          where: { id: params.documentJobId },
          select: { status: true, generatedDocumentId: true },
        });
        if (currentJob?.status === DocumentJobStatus.COMPLETED && currentJob.generatedDocumentId) {
          return { id: currentJob.generatedDocumentId };
        }
        throw new AppError('DOCUMENT_JOB_NOT_READY', 'Document job was no longer running when report publication began.');
      }

      const report = await this.documentRepo.upsertApproved({
        impactAnalysisId: params.analysisId,
        reviewedReportSnapshotId: params.snapshotId,
        content: params.markdown,
      }, tx);
      await tx.documentJob.update({
        where: { id: params.documentJobId },
        data: {
          generatedDocumentId: report.id,
          generatedDocumentAnalysisId: params.analysisId,
        },
      });
      await tx.reviewedReportSnapshot.update({
        where: { id: params.snapshotId },
        data: {
          approvedDocumentId: report.id,
          approvedDocumentAnalysisId: params.analysisId,
          markdown: report.content,
        },
      });

      return report;
    });
  }

}
