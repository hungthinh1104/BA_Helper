import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  scanJobCreateRequestSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';
import { CreateScanJobUseCase } from '../application/create-scan-job.usecase';
import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { AppError } from '../../../shared/app-error';

@Controller('/api/v1/repositories/:repositoryId/scan-jobs')
export class ScanJobController {
  constructor(
    private readonly createScanJob: CreateScanJobUseCase,
    private readonly scanJobRepository: ScanJobRepository,
  ) {}

  @Get('/api/v1/scan-jobs/:scanJobId')
  async get(@Param('scanJobId') scanJobId: string) {
    const job = await this.scanJobRepository.findById(scanJobId);
    if (!job) {
      throw new AppError('SCAN_JOB_NOT_FOUND', 'Scan job not found.');
    }

    return scanJobResponseSchema.parse({
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      error: job.errorCode
        ? { code: job.errorCode, message: job.errorMessage ?? '' }
        : null,
      result: {
        sourceTargetId: job.sourceTargetId,
        snapshotId: job.snapshotId,
        snapshotCoverageStatus: null,
      },
      capabilities: {
        canCancel: job.status === 'QUEUED' || job.status === 'RUNNING',
        canRerun:
          job.status === 'FAILED' ||
          job.status === 'CANCELLED' ||
          job.status === 'COMPLETED',
      },
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });
  }

  @Post()
  async create(@Param('repositoryId') repositoryId: string, @Body() body: unknown) {
    const input = scanJobCreateRequestSchema.parse(body);
    const job = await this.createScanJob.execute({
      repositoryId,
      requestKey: input.requestKey,
      requestedRef: input.ref,
    });

    const response = scanJobResponseSchema.parse({
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      error: job.errorCode
        ? { code: job.errorCode, message: job.errorMessage ?? '' }
        : null,
      result: {
        sourceTargetId: job.sourceTargetId,
        snapshotId: job.snapshotId,
        snapshotCoverageStatus: null,
      },
      capabilities: {
        canCancel: job.status === 'QUEUED' || job.status === 'RUNNING',
        canRerun:
          job.status === 'FAILED' ||
          job.status === 'CANCELLED' ||
          job.status === 'COMPLETED',
      },
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    });

    return response;
  }
}
