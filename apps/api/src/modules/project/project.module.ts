import { Module } from '@nestjs/common';
import { ProjectController } from './api/project.controller';
import { CreateProjectUseCase } from './application/create-project.usecase';
import { GetCurrentWorkspaceUseCase } from './application/get-current-workspace.usecase';
import { CURRENT_WORKSPACE_RESOLVERS } from './application/current-workspace.resolver';
import { DevSingleUserWorkspaceResolver } from './application/dev-single-user-workspace.resolver';
import { ProjectRepository } from './infrastructure/project.repository';
import { EventLogModule } from '../event-log/event-log.module';
import { WorkspaceController } from './api/workspace.controller';
import { AuthModule } from '../auth/auth.module';
import { ProjectScopeRepository } from './infrastructure/project-scope.repository';
import { ProjectPermissionService } from './application/project-permission.service';
import { ListProjectsUseCase } from './application/list-projects.usecase';
import { SelectProjectUseCase } from './application/select-project.usecase';
import { ProjectMembershipController } from './api/project-membership.controller';
import { ListProjectMembersUseCase } from './application/list-project-members.usecase';
import { UpsertProjectMemberUseCase } from './application/upsert-project-member.usecase';
import { UpdateProjectMemberUseCase } from './application/update-project-member.usecase';
import { RemoveProjectMemberUseCase } from './application/remove-project-member.usecase';
import { PrismaModule, PrismaService, EventLogService } from "@ba-helper/backend-runtime";

@Module({
  imports: [PrismaModule, EventLogModule, AuthModule],
  controllers: [ProjectController, WorkspaceController, ProjectMembershipController],
  providers: [
    ProjectScopeRepository,
    {
      provide: ProjectRepository,
      useFactory: (prisma: PrismaService) => new ProjectRepository(prisma),
      inject: [PrismaService],
    },
    ProjectPermissionService,
    {
      provide: CreateProjectUseCase,
      useFactory: (repo: ProjectRepository, eventLog: EventLogService) =>
        new CreateProjectUseCase(repo, eventLog),
      inject: [ProjectRepository, EventLogService],
    },
    {
      provide: ListProjectsUseCase,
      useFactory: (repo: ProjectRepository) => new ListProjectsUseCase(repo),
      inject: [ProjectRepository],
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
    {
      provide: SelectProjectUseCase,
      useFactory: (
        repo: ProjectRepository,
        eventLog: EventLogService,
        getCurrentWorkspace: GetCurrentWorkspaceUseCase,
      ) => new SelectProjectUseCase(repo, eventLog, getCurrentWorkspace),
      inject: [ProjectRepository, EventLogService, GetCurrentWorkspaceUseCase],
    },
    {
      provide: ListProjectMembersUseCase,
      useFactory: (repo: ProjectRepository) => new ListProjectMembersUseCase(repo),
      inject: [ProjectRepository],
    },
    {
      provide: UpsertProjectMemberUseCase,
      useFactory: (
        repo: ProjectRepository,
        permissions: ProjectPermissionService,
        eventLog: EventLogService,
      ) => new UpsertProjectMemberUseCase(repo, permissions, eventLog),
      inject: [ProjectRepository, ProjectPermissionService, EventLogService],
    },
    {
      provide: UpdateProjectMemberUseCase,
      useFactory: (
        repo: ProjectRepository,
        permissions: ProjectPermissionService,
        eventLog: EventLogService,
      ) => new UpdateProjectMemberUseCase(repo, permissions, eventLog),
      inject: [ProjectRepository, ProjectPermissionService, EventLogService],
    },
    {
      provide: RemoveProjectMemberUseCase,
      useFactory: (
        repo: ProjectRepository,
        permissions: ProjectPermissionService,
        eventLog: EventLogService,
      ) => new RemoveProjectMemberUseCase(repo, permissions, eventLog),
      inject: [ProjectRepository, ProjectPermissionService, EventLogService],
    },
  ],
  exports: [ProjectPermissionService, ProjectRepository, ProjectScopeRepository],
})
export class ProjectModule {}
