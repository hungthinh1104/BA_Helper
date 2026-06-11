import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      },
    }),
    BullModule.registerQueue({ name: 'impact-analysis' }),
    BullModule.registerQueue({ name: 'embedding' }),
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
