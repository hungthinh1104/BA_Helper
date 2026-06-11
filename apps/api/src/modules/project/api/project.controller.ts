import { Body, Controller, Post } from '@nestjs/common';
import {
  projectCreateRequestSchema,
  projectCreateResponseSchema,
  type RequestUser,
} from '@ba-helper/contracts';
import { CurrentUser } from '../../auth/api/current-user.decorator';
import { Roles } from '../../auth/api/roles.decorator';
import { CreateProjectUseCase } from '../application/create-project.usecase';

@Controller('/api/v1/projects')
export class ProjectController {
  constructor(private readonly createProject: CreateProjectUseCase) {}

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
