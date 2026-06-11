import { Module } from '@nestjs/common';
import { TraceabilityController } from './api/traceability.controller';
import { ListTraceabilityUseCase } from './application/list-traceability.usecase';
import { ReviewTraceabilityUseCase } from './application/review-traceability.usecase';
import { TraceabilityRepository } from './infrastructure/traceability.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule],
  controllers: [TraceabilityController],
  providers: [
    {
      provide: TraceabilityRepository,
      useFactory: (prisma: PrismaService) => new TraceabilityRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListTraceabilityUseCase,
      useFactory: (repo: TraceabilityRepository) => new ListTraceabilityUseCase(repo),
      inject: [TraceabilityRepository],
    },
    {
      provide: ReviewTraceabilityUseCase,
      useFactory: (repo: TraceabilityRepository, eventLog: EventLogService) =>
        new ReviewTraceabilityUseCase(repo, eventLog),
      inject: [TraceabilityRepository, EventLogService],
    },
  ],
})
export class TraceabilityModule {}
