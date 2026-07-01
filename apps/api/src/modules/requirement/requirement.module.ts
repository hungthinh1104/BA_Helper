import { Module } from '@nestjs/common';
import { RequirementController } from './api/requirement.controller';
import { RequirementRepository } from './infrastructure/requirement.repository';
import { CreateRequirementUseCase } from './application/create-requirement.usecase';
import { CreateRequirementRevisionUseCase } from './application/create-revision.usecase';
import { QualifyRequirementRevisionUseCase } from './application/qualify-revision.usecase';
import { ListRequirementsUseCase } from './application/list-requirements.usecase';
import { GetRequirementUseCase } from './application/get-requirement.usecase';
import { EventLogModule } from '../event-log/event-log.module';
import { ProjectRepository } from '../project/infrastructure/project.repository';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, EventLogService } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule],
  controllers: [RequirementController],
  providers: [
    {
      provide: RequirementRepository,
      useFactory: (prisma: PrismaService) => new RequirementRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ProjectRepository,
      useFactory: (prisma: PrismaService) => new ProjectRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateRequirementUseCase,
      useFactory: (
        repo: RequirementRepository,
        projectRepo: ProjectRepository,
        eventLog: EventLogService,
      ) => new CreateRequirementUseCase(repo, projectRepo, eventLog),
      inject: [RequirementRepository, ProjectRepository, EventLogService],
    },
    {
      provide: CreateRequirementRevisionUseCase,
      useFactory: (repo: RequirementRepository) =>
        new CreateRequirementRevisionUseCase(repo),
      inject: [RequirementRepository],
    },
    {
      provide: QualifyRequirementRevisionUseCase,
      useFactory: (repo: RequirementRepository) =>
        new QualifyRequirementRevisionUseCase(repo),
      inject: [RequirementRepository],
    },
    {
      provide: ListRequirementsUseCase,
      useFactory: (repo: RequirementRepository, projectRepo: ProjectRepository) =>
        new ListRequirementsUseCase(repo, projectRepo),
      inject: [RequirementRepository, ProjectRepository],
    },
    {
      provide: GetRequirementUseCase,
      useFactory: (repo: RequirementRepository) => new GetRequirementUseCase(repo),
      inject: [RequirementRepository],
    },
  ],
})
export class RequirementModule {}
