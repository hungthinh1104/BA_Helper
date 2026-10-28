import { Module } from '@nestjs/common';
import {
  PrismaModule,
  PrismaService,
  TraceabilityRepository,
  InsightRepository,
  ReviewNoteRepository,
  EventLogService,
} from '@ba-helper/backend-runtime';
import { ReviewDecisionController } from './api/review-decision.controller';
import { SubmitReviewItemDecisionUseCase } from './application/submit-review-item-decision.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule],
  controllers: [ReviewDecisionController],
  providers: [
    {
      provide: TraceabilityRepository,
      useFactory: (prisma: PrismaService) => new TraceabilityRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: InsightRepository,
      useFactory: (prisma: PrismaService) => new InsightRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ReviewNoteRepository,
      useFactory: (prisma: PrismaService) => new ReviewNoteRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: SubmitReviewItemDecisionUseCase,
      useFactory: (
        traceabilityRepo: TraceabilityRepository,
        insightRepo: InsightRepository,
        reviewNoteRepo: ReviewNoteRepository,
        eventLog: EventLogService,
        prisma: PrismaService,
      ) =>
        new SubmitReviewItemDecisionUseCase(
          traceabilityRepo,
          insightRepo,
          reviewNoteRepo,
          eventLog,
          prisma,
        ),
      inject: [
        TraceabilityRepository,
        InsightRepository,
        ReviewNoteRepository,
        EventLogService,
        PrismaService,
      ],
    },
  ],
})
export class ReviewModule {}
