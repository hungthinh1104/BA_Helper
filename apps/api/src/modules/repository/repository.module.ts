import { Module } from '@nestjs/common';
import { RepositoryController } from './api/repository.controller';
import { CreateRepositoryUseCase } from './application/create-repository.usecase';
import { RepositoryRepository } from './infrastructure/repository.repository';
import { ListRepositoriesUseCase } from './application/list-repositories.usecase';
import { GetRepositoryUseCase } from './application/get-repository.usecase';
import { ProjectRepository } from '../project/infrastructure/project.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';

@Module({
  imports: [PrismaModule, EventLogModule],
  controllers: [RepositoryController],
  providers: [
    {
      provide: RepositoryRepository,
      useFactory: (prisma: PrismaService) => new RepositoryRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ProjectRepository,
      useFactory: (prisma: PrismaService) => new ProjectRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateRepositoryUseCase,
      useFactory: (
        repo: RepositoryRepository,
        projectRepo: ProjectRepository,
        eventLog: EventLogService,
      ) => new CreateRepositoryUseCase(repo, projectRepo, eventLog),
      inject: [RepositoryRepository, ProjectRepository, EventLogService],
    },
    {
      provide: ListRepositoriesUseCase,
      useFactory: (repo: RepositoryRepository, projectRepo: ProjectRepository) =>
        new ListRepositoriesUseCase(repo, projectRepo),
      inject: [RepositoryRepository, ProjectRepository],
    },
    {
      provide: GetRepositoryUseCase,
      useFactory: (repo: RepositoryRepository) => new GetRepositoryUseCase(repo),
      inject: [RepositoryRepository],
    },
  ],
})
export class RepositoryModule {}
