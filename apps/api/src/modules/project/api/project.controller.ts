import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  projectListResponseSchema,
  projectCreateRequestSchema,
  projectCreateResponseSchema,
  type RequestUser,
} from '@ba-helper/contracts';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { Roles } from '../../auth/api/roles.decorator';
import { CreateProjectUseCase } from '../application/create-project.usecase';
import { ListProjectsUseCase } from '../application/list-projects.usecase';

@Controller('/api/v1/projects')
export class ProjectController {
  constructor(
    private readonly createProject: CreateProjectUseCase,
    private readonly listProjects: ListProjectsUseCase,
  ) {}

  @Get()
  async list(@CurrentUser() actor: RequestUser) {
    const projects = await this.listProjects.execute(actor);
    return projectListResponseSchema.parse({
      items: projects.map((project) => ({
        createdAt: project.createdAt.toISOString(),
        isSelected: project.isSelected,
        membershipRole: project.membershipRole,
        name: project.name,
        projectId: project.projectId,
      })),
    });
  }

  @Post()
  @Roles('ADMIN')
  async create(@Body() body: unknown, @CurrentUser() actor: RequestUser) {
    const input = projectCreateRequestSchema.parse(body);
    const project = await this.createProject.execute({
      name: input.name,
      actor,
    });

    const response = projectCreateResponseSchema.parse({
      projectId: project.id,
      name: project.name,
      createdAt: project.createdAt.toISOString(),
    });

    return response;
  }
}
