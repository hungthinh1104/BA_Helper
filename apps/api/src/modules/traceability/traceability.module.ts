import { Module } from '@nestjs/common';
import { TraceabilityController } from './api/traceability.controller';
import { ListTraceabilityUseCase } from './application/list-traceability.usecase';
import { ReviewTraceabilityUseCase } from './application/review-traceability.usecase';
import { UpdateTraceabilityReviewDecisionUseCase } from './application/update-traceability-review-decision.usecase';
import { DeleteTraceabilityReviewDecisionUseCase } from './application/delete-traceability-review-decision.usecase';
import { GetReviewCompletionUseCase } from './application/get-review-completion.usecase';
import { TraceabilityRepository } from './infrastructure/traceability.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { ProjectModule } from '../project/project.module';
import { InsightModule } from '../insight/insight.module';
import { InsightRepository } from '../insight/infrastructure/insight.repository';

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule, InsightModule],
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
    {
      provide: UpdateTraceabilityReviewDecisionUseCase,
      useFactory: (repo: TraceabilityRepository, eventLog: EventLogService) =>
        new UpdateTraceabilityReviewDecisionUseCase(repo, eventLog),
      inject: [TraceabilityRepository, EventLogService],
    },
    {
      provide: DeleteTraceabilityReviewDecisionUseCase,
      useFactory: (repo: TraceabilityRepository, eventLog: EventLogService) =>
        new DeleteTraceabilityReviewDecisionUseCase(repo, eventLog),
      inject: [TraceabilityRepository, EventLogService],
    },
    {
      provide: GetReviewCompletionUseCase,
      useFactory: (
        prisma: PrismaService,
        repo: TraceabilityRepository,
        insightRepo: InsightRepository,
      ) => new GetReviewCompletionUseCase(prisma, repo, insightRepo),
      inject: [PrismaService, TraceabilityRepository, InsightRepository],
    },
  ],
  exports: [TraceabilityRepository, GetReviewCompletionUseCase],
})
export class TraceabilityModule {}
