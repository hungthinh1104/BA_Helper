import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { QueueService } from '../../../queue/queue.service';
import { AppError } from '../../../../shared/app-error';

type DocumentJobTx = Prisma.TransactionClient | PrismaService;

@Injectable()
export class EnqueueDocumentJobUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async execute(params: {
    analysisId: string;
    documentType: 'IMPACT_REPORT';
    requestKey?: string;
    retry?: boolean;
  }) {
    const { job, shouldEnqueue } = await this.createOrReuseQueuedJob(params);
    if (shouldEnqueue) {
      await this.enqueueExistingJob(job.id);
    }
    return job;
  }

  async enqueueExistingJob(documentJobId: string) {
    await this.queueService.enqueueDocumentJob(documentJobId);
  }

  async createOrReuseQueuedJob(params: {
    analysisId: string;
    documentType: 'IMPACT_REPORT';
    requestKey?: string;
    retry?: boolean;
  }) {
    const analysis = await this.prisma.impactAnalysis.findUnique({
      where: { id: params.analysisId },
      include: {
        snapshot: true,
        sourceTarget: true,
      },
    });

    if (!analysis) {
      throw new AppError('IMPACT_ANALYSIS_NOT_FOUND', 'Impact analysis not found.');
    }

    // Gate Check 1: Review must be complete
    if (analysis.status !== 'COMPLETED') {
      throw new AppError('REVIEW_INCOMPLETE' as any, 'Cannot enqueue document job for incomplete review.');
    }

    // Gate Check 2: Stale check
    const isPinnedCommit = analysis.sourceTarget.resolvedRefType === 'COMMIT';
    const isStale =
      !isPinnedCommit &&
      !!analysis.sourceTarget.latestObservedCommitSha &&
      analysis.sourceTarget.latestObservedCommitSha !== analysis.snapshot.commitSha;

    if (isStale) {
      throw new AppError('ANALYSIS_STALE' as any, 'Cannot generate final report for stale snapshot.');
    }

    // Fetch the latest ReviewedReportSnapshot
    const snapshot = await this.prisma.reviewedReportSnapshot.findFirst({
      where: { analysisId: analysis.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!snapshot) {
      throw new AppError('SNAPSHOT_NOT_FOUND' as any, 'Reviewed report snapshot not found.');
    }

    return this.prisma.$transaction((tx) =>
      this.createOrReuseQueuedJobForSnapshot(tx, {
        analysisId: analysis.id,
        snapshotId: snapshot.id,
        documentType: params.documentType,
        requestKey: params.requestKey,
        retry: params.retry,
      }),
    );
  }

  async createOrReuseQueuedJobForSnapshot(
    tx: DocumentJobTx,
    params: {
      analysisId: string;
      snapshotId: string;
      documentType: 'IMPACT_REPORT';
      requestKey?: string;
      retry?: boolean;
    },
  ) {
    let job = await tx.documentJob.findUnique({
      where: {
        snapshotId_documentType: {
          snapshotId: params.snapshotId,
          documentType: params.documentType,
        },
      },
    });

    if (!job) {
      job = await tx.documentJob.create({
        data: {
          analysisId: params.analysisId,
          snapshotId: params.snapshotId,
          documentType: params.documentType,
          status: 'QUEUED',
          requestKey: params.requestKey,
          attemptCount: 1,
        },
      });
      return { job, shouldEnqueue: true };
    }

    if (job.status === 'FAILED' && params.retry) {
      job = await tx.documentJob.update({
        where: { id: job.id },
        data: {
          status: 'QUEUED',
          progress: 0,
          attemptCount: { increment: 1 },
          error: Prisma.DbNull,
          failedAt: null,
          ...(params.requestKey ? { requestKey: params.requestKey } : {}),
        },
      });
      return { job, shouldEnqueue: true };
    }

    return { job, shouldEnqueue: job.status === 'QUEUED' };
  }
}
