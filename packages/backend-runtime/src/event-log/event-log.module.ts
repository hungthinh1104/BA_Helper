import { Module } from '@nestjs/common';
import { PrismaModule } from '../index';
import { EventLogService } from './application/event-log.service';
import { EventLogRepository } from '../index';
import { PrismaService } from '../index';

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: EventLogService,
      useFactory: (repo: EventLogRepository) => new EventLogService(repo),
      inject: [EventLogRepository],
    },
    {
      provide: EventLogRepository,
      useFactory: (prisma: PrismaService) => new EventLogRepository(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [EventLogService],
})
export class EventLogModule {}
