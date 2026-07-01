import { Module } from '@nestjs/common';
import { ClarificationController } from './api/clarification.controller';
import { EnsureClarificationUseCase } from './application/ensure-clarification.usecase';
import { AnswerClarificationUseCase } from './application/answer-clarification.usecase';
import { DismissClarificationUseCase } from './application/dismiss-clarification.usecase';
import { ListClarificationsUseCase } from './application/list-clarifications.usecase';
import { ConvertClarificationToRevisionUseCase } from './application/convert-clarification-to-revision.usecase';
import { RequirementRepository } from '../requirement/infrastructure/requirement.repository';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, ImpactAnalysisRepository, InsightRepository, ClarificationRepository } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, ProjectModule],
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
