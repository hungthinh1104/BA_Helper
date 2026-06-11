import { Module } from '@nestjs/common';
import { InsightController } from './api/insight.controller';
import { ListInsightsUseCase } from './application/list-insights.usecase';
import { ReviewInsightUseCase } from './application/review-insight.usecase';
import { InsightRepository } from './infrastructure/insight.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { ProjectModule } from '../project/project.module';

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
