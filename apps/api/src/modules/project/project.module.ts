import { Module } from '@nestjs/common';
import { ProjectController } from './api/project.controller';
import { CreateProjectUseCase } from './application/create-project.usecase';
import { GetCurrentWorkspaceUseCase } from './application/get-current-workspace.usecase';
import { CURRENT_WORKSPACE_RESOLVERS } from './application/current-workspace.resolver';
import { DevSingleUserWorkspaceResolver } from './application/dev-single-user-workspace.resolver';
import { ProjectRepository } from './infrastructure/project.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { EventLogModule } from '../event-log/event-log.module';
import { EventLogService } from '../event-log/application/event-log.service';
import { WorkspaceController } from './api/workspace.controller';

@Module({
  imports: [PrismaModule, EventLogModule],
  controllers: [ProjectController, WorkspaceController],
  providers: [
    {
      provide: ProjectRepository,
      useFactory: (prisma: PrismaService) => new ProjectRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateProjectUseCase,
      useFactory: (repo: ProjectRepository, eventLog: EventLogService) =>
        new CreateProjectUseCase(repo, eventLog),
      inject: [ProjectRepository, EventLogService],
    },
    {
      provide: DevSingleUserWorkspaceResolver,
      useFactory: (repo: ProjectRepository, eventLog: EventLogService) =>
        new DevSingleUserWorkspaceResolver(repo, eventLog),
      inject: [ProjectRepository, EventLogService],
    },
    {
      provide: CURRENT_WORKSPACE_RESOLVERS,
      useFactory: (devSingleUserResolver: DevSingleUserWorkspaceResolver) => [
        devSingleUserResolver,
      ],
      inject: [DevSingleUserWorkspaceResolver],
    },
    {
      provide: GetCurrentWorkspaceUseCase,
      useFactory: (resolvers: DevSingleUserWorkspaceResolver[]) =>
        new GetCurrentWorkspaceUseCase(resolvers),
      inject: [CURRENT_WORKSPACE_RESOLVERS],
    },
  ],
})
export class ProjectModule {}
