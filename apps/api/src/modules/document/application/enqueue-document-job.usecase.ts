import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { AppError } from '../../../shared/app-error';

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

    return await this.prisma.$transaction(async (tx) => {
      let job = await tx.documentJob.findUnique({
        where: {
          snapshotId_documentType: {
            snapshotId: snapshot.id,
            documentType: params.documentType,
          },
        },
      });

      if (!job) {
        // Create new job
        job = await tx.documentJob.create({
          data: {
            analysisId: analysis.id,
            snapshotId: snapshot.id,
            documentType: params.documentType,
            status: 'QUEUED',
            requestKey: params.requestKey,
            attemptCount: 1,
          },
        });
        await this.queueService.enqueueDocumentJob({
          snapshotId: snapshot.id,
          documentType: params.documentType,
          requestKey: params.requestKey,
        });
        return job;
      }

      // Job exists
      if (job.status === 'FAILED' && params.retry) {
        job = await tx.documentJob.update({
          where: { id: job.id },
          data: {
            status: 'QUEUED',
            attemptCount: { increment: 1 },
            error: require('@prisma/client').Prisma.DbNull,
            failedAt: null,
            // Only update requestKey if provided
            ...(params.requestKey ? { requestKey: params.requestKey } : {}),
          },
        });
        await this.queueService.enqueueDocumentJob({
          snapshotId: snapshot.id,
          documentType: params.documentType,
          requestKey: params.requestKey,
        });
        return job;
      }

      return job;
    });
  }
}
