import { Module } from '@nestjs/common';
import { RepositoryController } from './api/repository.controller';
import { RepositorySnapshotController } from './api/repository-snapshot.controller';
import { GetRepositorySnapshotDriftUseCase } from './application/get-repository-snapshot-drift.usecase';
import { CreateRepositoryUseCase } from './application/create-repository.usecase';
import { RepositoryRepository } from './infrastructure/repository.repository';
import { ListRepositoriesUseCase } from './application/list-repositories.usecase';
import { GetRepositoryUseCase } from './application/get-repository.usecase';
import { ProjectRepository } from '../project/infrastructure/project.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { ProjectModule } from '../project/project.module';

@Module({
  imports: [PrismaModule, EventLogModule, ProjectModule],
  controllers: [RepositoryController, RepositorySnapshotController],
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
    {
      provide: GetRepositorySnapshotDriftUseCase,
      useFactory: (prisma: PrismaService) => new GetRepositorySnapshotDriftUseCase(prisma),
      inject: [PrismaService],
    },
  ],
})
export class RepositoryModule {}
