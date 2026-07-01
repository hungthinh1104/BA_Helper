import { Body, Controller, Get, Param, Post, Inject } from '@nestjs/common';
import {
  scanJobCreateRequestSchema,
  scanJobResponseSchema,
} from '@ba-helper/contracts';
import { CreateScanJobUseCase } from '../application/create-scan-job.usecase';
import { AppError } from '@ba-helper/shared';

import { CurrentUser } from '../../auth/api/current-user.decorator';
import { RequestUser } from '@ba-helper/contracts';
import { ProjectPermissionService } from '../../project/application/project-permission.service';
import { ScanJobRepository, EventLogService } from "@ba-helper/backend-runtime";

@Controller('/api/v1/repositories/:repositoryId/scan-jobs')
export class ScanJobController {
  constructor(
    private readonly createScanJob: CreateScanJobUseCase,
    private readonly scanJobRepository: ScanJobRepository,
    private readonly permissions: ProjectPermissionService,
    private readonly eventLogService: EventLogService,
  ) {}

  private toResponse(job: any) {
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
        snapshotCoverageStatus: job.snapshot?.coverageStatus ?? null,
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

    return this.toResponse(job);
  }

  @Get('/:scanJobId/events')
  async getEvents(
    @Param('scanJobId') scanJobId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadScanJob(actor, scanJobId);
    // ensure job exists
    const job = await this.scanJobRepository.findById(scanJobId);
    if (!job) {
      throw new AppError('SCAN_JOB_NOT_FOUND', 'Scan job not found.');
    }

    const events = await this.eventLogService.getScanJobEvents(scanJobId);
    return { items: events };
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

    return this.toResponse(job as any);
  }
}
