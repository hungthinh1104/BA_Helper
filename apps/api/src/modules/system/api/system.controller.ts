import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import {
  systemLivenessResponseSchema,
  systemOperationsResponseSchema,
  systemReadinessResponseSchema,
} from '@ba-helper/contracts';
import { GetSystemHealthUseCase } from '../application/get-system-health.usecase';
import { Public } from '../../auth/application/jwt-auth.guard';
import { Roles } from '../../auth/api/roles.decorator';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import type { RequestUser } from '@ba-helper/contracts';
import { EventLogService } from '@ba-helper/backend-runtime';
import {
  QueueService,
  type RecoverableQueueName,
} from '@ba-helper/backend-runtime/queue';
import * as crypto from 'node:crypto';

@Controller('/api/v1/system')
export class SystemController {
  constructor(
    private readonly getSystemHealth: GetSystemHealthUseCase,
    private readonly queueService: QueueService,
    private readonly eventLog: EventLogService,
  ) {}

  /** Liveness — process only. Public. Leaks nothing operational. */
  @Get('/live')
  @Public()
  getLive() {
    return systemLivenessResponseSchema.parse(this.getSystemHealth.getLiveness());
  }

  /** Readiness — dependency up/down only. Public. No workspace config, no counts. */
  @Get('/ready')
  @Public()
  async getReady() {
    return systemReadinessResponseSchema.parse(
      await this.getSystemHealth.getReadiness(),
    );
  }

  /** Operations — queue counts + workspace config. ADMIN only. */
  @Get('/operations')
  @Roles('ADMIN')
  async getOperations() {
    return systemOperationsResponseSchema.parse(
      await this.getSystemHealth.getOperations(),
    );
  }

  @Post('/queues/:queueName/failed/:jobId/retry')
  @Roles('ADMIN')
  async retryFailedJob(
    @Param('queueName') queueName: RecoverableQueueName,
    @Param('jobId') jobId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    if (
      !['scan-job', 'embedding', 'impact-analysis', 'document-job'].includes(
        queueName,
      )
    ) {
      throw new BadRequestException(`Unsupported queue ${queueName}.`);
    }
    const result = await this.queueService.retryFailedJob(queueName, jobId);
    // Audit the operator action, keyed on the product entity (not the raw
    // BullMQ id) so the trail is meaningful.
    await this.eventLog.recordEvent({
      eventType: 'ADMIN_JOB_RETRIED',
      idempotencyKey: `admin-job-retried:${queueName}:${jobId}:${crypto.randomUUID()}`,
      payload: {
        queueName,
        jobId,
        productEntityId: result.productEntityId,
      },
      actorUserId: actor.id,
    });
    return result;
  }
}
