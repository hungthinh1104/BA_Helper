import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { systemHealthResponseSchema } from '@ba-helper/contracts';
import { GetSystemHealthUseCase } from '../application/get-system-health.usecase';
import { Public } from '../../auth/application/jwt-auth.guard';
import { Roles } from '../../auth/api/roles.decorator';
import {
  QueueService,
  type RecoverableQueueName,
} from '@ba-helper/backend-runtime/queue';

@Controller('/api/v1/system')
export class SystemController {
  constructor(
    private readonly getSystemHealth: GetSystemHealthUseCase,
    private readonly queueService: QueueService,
  ) {}

  @Get('/health')
  @Public()
  async getHealth() {
    return systemHealthResponseSchema.parse(
      await this.getSystemHealth.execute(),
    );
  }

  @Post('/queues/:queueName/failed/:jobId/retry')
  @Roles('ADMIN')
  async retryFailedJob(
    @Param('queueName') queueName: RecoverableQueueName,
    @Param('jobId') jobId: string,
  ) {
    if (
      !['scan-job', 'embedding', 'impact-analysis', 'document-job'].includes(
        queueName,
      )
    ) {
      throw new BadRequestException(`Unsupported queue ${queueName}.`);
    }
    return this.queueService.retryFailedJob(queueName, jobId);
  }
}
