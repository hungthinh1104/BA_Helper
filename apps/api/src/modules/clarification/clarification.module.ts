import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ClarificationController } from './api/clarification.controller';
import { ClarificationRepository } from './infrastructure/clarification.repository';
import { EnsureClarificationUseCase } from './application/ensure-clarification.usecase';
import { AnswerClarificationUseCase } from './application/answer-clarification.usecase';
import { DismissClarificationUseCase } from './application/dismiss-clarification.usecase';
import { ListClarificationsUseCase } from './application/list-clarifications.usecase';
import { ConvertClarificationToRevisionUseCase } from './application/convert-clarification-to-revision.usecase';
import { ImpactAnalysisRepository } from '../impact-analysis/infrastructure/impact-analysis.repository';
import { InsightRepository } from '../insight/infrastructure/insight.repository';
import { RequirementRepository } from '../requirement/infrastructure/requirement.repository';

@Module({
  imports: [PrismaModule],
  controllers: [ClarificationController],
  providers: [
    ClarificationRepository,
    ImpactAnalysisRepository,
    {
      provide: InsightRepository,
      useFactory: (prisma: PrismaService) => new InsightRepository(prisma),
      inject: [PrismaService],
    },
    EnsureClarificationUseCase,
    AnswerClarificationUseCase,
    DismissClarificationUseCase,
    ListClarificationsUseCase,
    ConvertClarificationToRevisionUseCase,
    {
      provide: RequirementRepository,
      useFactory: (prisma: PrismaService) => new RequirementRepository(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [ClarificationRepository],
})
export class ClarificationModule {}
