import { Module } from '@nestjs/common';
import { TraceabilityController } from './api/traceability.controller';
import { ListTraceabilityUseCase } from './application/list-traceability.usecase';
import { ReviewTraceabilityUseCase } from './application/review-traceability.usecase';
import { UpdateTraceabilityReviewDecisionUseCase } from './application/update-traceability-review-decision.usecase';
import { DeleteTraceabilityReviewDecisionUseCase } from './application/delete-traceability-review-decision.usecase';
import { GetReviewCompletionUseCase } from './application/get-review-completion.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { ProjectModule } from '../project/project.module';
import { InsightModule } from '../insight/insight.module';
import { PrismaModule, PrismaService, TraceabilityRepository, InsightRepository, EventLogService } from "@ba-helper/backend-runtime";

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
