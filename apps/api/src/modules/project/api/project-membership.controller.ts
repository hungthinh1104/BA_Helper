import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  projectMemberListResponseSchema,
  projectMemberUpsertRequestSchema,
  projectMemberUpdateRequestSchema,
  type RequestUser,
} from '@ba-helper/contracts';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { ProjectPermissionService } from '../application/project-permission.service';
import { ListProjectMembersUseCase } from '../application/list-project-members.usecase';
import { RemoveProjectMemberUseCase } from '../application/remove-project-member.usecase';
import { UpdateProjectMemberUseCase } from '../application/update-project-member.usecase';
import { UpsertProjectMemberUseCase } from '../application/upsert-project-member.usecase';

@Controller('/api/v1/projects/:projectId/members')
export class ProjectMembershipController {
  constructor(
    private readonly permissions: ProjectPermissionService,
    private readonly listMembers: ListProjectMembersUseCase,
    private readonly upsertMember: UpsertProjectMemberUseCase,
    private readonly updateMember: UpdateProjectMemberUseCase,
    private readonly removeMember: RemoveProjectMemberUseCase,
  ) {}

  @Get()
  async list(
    @Param('projectId') projectId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.permissions.assertCanReadProject(actor, projectId);
    const members = await this.listMembers.execute(projectId);

    return projectMemberListResponseSchema.parse({
      items: members.map((member) => ({
        createdAt: member.createdAt.toISOString(),
        email: member.user.email,
        name: member.user.name ?? null,
        role: member.role,
        userId: member.userId,
      })),
    });
  }

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    const input = projectMemberUpsertRequestSchema.parse(body);
    await this.upsertMember.execute(actor, projectId, input);
    return this.list(projectId, actor);
  }

  @Patch(':userId')
  async update(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
    @CurrentUser() actor: RequestUser,
  ) {
    const input = projectMemberUpdateRequestSchema.parse(body);
    await this.updateMember.execute(actor, projectId, userId, input);
    return this.list(projectId, actor);
  }

  @Delete(':userId')
  async remove(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    await this.removeMember.execute(actor, projectId, userId);
    return { removed: true };
  }
}
