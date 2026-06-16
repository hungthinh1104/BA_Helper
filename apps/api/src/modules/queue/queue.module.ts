import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { requireEnv } from '../../bootstrap/runtime-config';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: requireEnv('REDIS_URL', 'redis://localhost:6379'),
      },
    }),
    BullModule.registerQueue({ name: 'impact-analysis' }),
    BullModule.registerQueue({ name: 'embedding' }),
    BullModule.registerQueue({ name: 'scan-job' }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
