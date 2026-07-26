import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventLogService } from './application/event-log.service';
import { EventLogRepository } from './infrastructure/event-log.repository';
import { PrismaService } from '../prisma/prisma.service';

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
