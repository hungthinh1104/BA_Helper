import { Module } from '@nestjs/common';
import { InsightController } from './api/insight.controller';
import { ListInsightsUseCase } from './application/list-insights.usecase';
import { ReviewInsightUseCase } from './application/review-insight.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, InsightRepository, EventLogService } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule],
  controllers: [InsightController],
  providers: [
    {
      provide: InsightRepository,
      useFactory: (prisma: PrismaService) => new InsightRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ListInsightsUseCase,
      useFactory: (repo: InsightRepository) => new ListInsightsUseCase(repo),
      inject: [InsightRepository],
    },
    {
      provide: ReviewInsightUseCase,
      useFactory: (repo: InsightRepository, eventLog: EventLogService) =>
        new ReviewInsightUseCase(repo, eventLog),
      inject: [InsightRepository, EventLogService],
    },
  ],
  exports: [InsightRepository],
})
export class InsightModule {}
