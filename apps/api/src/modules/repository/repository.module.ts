import { Module } from '@nestjs/common';
import { RepositoryController } from './api/repository.controller';
import { RepositorySnapshotController } from './api/repository-snapshot.controller';
import { GetRepositorySnapshotDriftUseCase } from './application/get-repository-snapshot-drift.usecase';
import { ListRepositorySnapshotsUseCase } from './application/list-repository-snapshots.usecase';
import { CreateRepositoryUseCase } from './application/create-repository.usecase';
import { ListRepositoriesUseCase } from './application/list-repositories.usecase';
import { GetRepositoryUseCase } from './application/get-repository.usecase';
import { ProjectRepository } from '../project/infrastructure/project.repository';
import { EventLogModule } from '../event-log/event-log.module';
import { ProjectModule } from '../project/project.module';
import { PrismaModule, PrismaService, RepositoryRepository, EventLogService } from "@ba-helper/backend-runtime";

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
    {
      provide: ListRepositorySnapshotsUseCase,
      useFactory: (prisma: PrismaService) => new ListRepositorySnapshotsUseCase(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [GetRepositorySnapshotDriftUseCase],
})
export class RepositoryModule {}
