import { Body, Controller, Get, Param, Post, Inject } from '@nestjs/common';
import {
  scanJobCreateRequestSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';
import { CreateScanJobUseCase } from '../application/create-scan-job.usecase';
import { ScanJobRepository } from '../infrastructure/scan-job.repository';
import { AppError } from '../../../shared/app-error';

import { CurrentUser } from '../../auth/api/current-user.decorator';
import { RequestUser } from '@ba-helper/contracts';
import { ProjectPermissionService } from '../../project/application/project-permission.service';

@Controller('/api/v1/repositories/:repositoryId/scan-jobs')
export class ScanJobController {
  constructor(
    private readonly createScanJob: CreateScanJobUseCase,
    private readonly scanJobRepository: ScanJobRepository,
    private readonly permissions: ProjectPermissionService,
  ) {}

  @Get('/:scanJobId')
  async get(
    @Param('scanJobId') scanJobId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadScanJob(actor, scanJobId);
    const job = await this.scanJobRepository.findById(scanJobId);
    if (!job) {
      throw new AppError('SCAN_JOB_NOT_FOUND', 'Scan job not found.');
    }

    return scanJobResponseSchema.parse({
      id: job.id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      diagnostics: job.diagnostics ?? undefined,
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
  async create(
    @Param('repositoryId') repositoryId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertPermissionForRepository(
      actor,
      repositoryId,
      'scan:run',
    );
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
      diagnostics: job.diagnostics ?? undefined,
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
